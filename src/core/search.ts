import type { Archive, CloudMessage, Conversation, FrameArtifact, MemoryFile, Message, Project } from './types';
import { truncate } from './utils';

export interface ConversationHit {
  conversation: Conversation;
  score: number;
  snippet: string;
}

export interface SimpleHit {
  id: string;
  title: string;
  subtitle?: string;
  snippet: string;
  score: number;
  kind: 'conversation' | 'project' | 'frame' | 'memory' | 'cloud';
}

interface ConversationSearchEntry {
  conversation: Conversation;
  title: string;
  text: string;
}

let cacheArray: readonly Conversation[] | null = null;
let cacheIncludeToolResults = false;
let cacheEntries: ConversationSearchEntry[] = [];

function blockText(block: Record<string, unknown>, includeToolResults: boolean): string {
  const type = String(block.type ?? '');
  if (type === 'text') return String(block.text ?? '');
  if (type === 'thinking') return String(block.thinking ?? '');
  if (type === 'tool_use') {
    const input = block.input as Record<string, unknown> | undefined;
    return [String(block.name ?? ''), String(input?.title ?? ''), String(input?.id ?? '')].join(' ');
  }
  if (type === 'tool_result') {
    if (!includeToolResults) return '';
    const content = block.content;
    if (Array.isArray(content)) {
      return content
        .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).text ?? '') : ''))
        .join(' ');
    }
    return String(content ?? '');
  }
  if (type === 'document') return String(block.title ?? '');
  if (type === 'image') return 'изображение';
  return '';
}

function messageText(message: Message, includeToolResults: boolean): string {
  const parts: string[] = [message.text ?? ''];
  for (const block of message.content) parts.push(blockText(block, includeToolResults));
  for (const attachment of message.attachments) parts.push(attachment.file_name, attachment.extracted_content ?? '');
  for (const file of message.files) parts.push(file.file_name);
  return parts.join('\n');
}

function ensureConversationCache(conversations: readonly Conversation[], includeToolResults: boolean): void {
  if (cacheArray === conversations && cacheIncludeToolResults === includeToolResults) return;
  cacheEntries = conversations.map((conversation) => ({
    conversation,
    title: conversation.name.toLowerCase(),
    text: conversation.chat_messages.map((message) => messageText(message, includeToolResults)).join('\n').toLowerCase(),
  }));
  cacheArray = conversations;
  cacheIncludeToolResults = includeToolResults;
}

export function makeSnippet(text: string, query: string, radius = 90): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return truncate(normalized, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(normalized.length, index + query.length + radius);
  return `${start > 0 ? '…' : ''}${normalized.slice(start, end).trim()}${end < normalized.length ? '…' : ''}`;
}

export function searchConversations(
  conversations: readonly Conversation[],
  query: string,
  includeToolResults = false,
): ConversationHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  ensureConversationCache(conversations, includeToolResults);
  const hits: ConversationHit[] = [];
  for (const entry of cacheEntries) {
    const titleIndex = entry.title.indexOf(q);
    const textIndex = entry.text.indexOf(q);
    if (titleIndex === -1 && textIndex === -1) continue;
    const occurrences = entry.text.split(q).length - 1;
    hits.push({
      conversation: entry.conversation,
      score: (titleIndex !== -1 ? 1000 : 0) + occurrences,
      snippet: titleIndex !== -1 && textIndex === -1
        ? entry.conversation.summary || entry.conversation.name
        : makeSnippet(entry.text.slice(Math.max(0, textIndex - 200), textIndex + 400), q),
    });
  }
  return hits.sort((a, b) => b.score - a.score);
}

export function searchProjects(projects: Project[], query: string): SimpleHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return projects
    .map((project): SimpleHit | null => {
      const haystack = [
        project.name,
        project.description,
        project.prompt_template,
        ...project.docs.map((doc) => `${doc.filename}\n${doc.content}`),
      ]
        .join('\n')
        .toLowerCase();
      const index = haystack.indexOf(q);
      if (index === -1) return null;
      return {
        id: project.uuid,
        title: project.name,
        subtitle: `${project.docs.length} документов`,
        snippet: makeSnippet(haystack, q),
        score: project.name.toLowerCase().includes(q) ? 100 : 1,
        kind: 'project',
      };
    })
    .filter((hit): hit is SimpleHit => hit !== null)
    .sort((a, b) => b.score - a.score);
}

export function searchMemories(memories: MemoryFile[], query: string): SimpleHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return memories
    .map((memory): SimpleHit | null => {
      const haystack = `${memory.path}\n${memory.content}`.toLowerCase();
      const index = haystack.indexOf(q);
      if (index === -1) return null;
      return {
        id: memory.path,
        title: memory.path,
        subtitle: memory.updated_at,
        snippet: makeSnippet(haystack, q),
        score: 1,
        kind: 'memory',
      };
    })
    .filter((hit): hit is SimpleHit => hit !== null);
}

export function searchFrames(frames: FrameArtifact[], query: string): SimpleHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return frames
    .map((artifact): SimpleHit | null => {
      const latest = artifact.versions[0];
      const haystack = [
        latest?.title ?? '',
        latest?.description ?? '',
        artifact.kind,
        ...artifact.versions.flatMap((version) => version.files.map((file) => file.path)),
      ]
        .join('\n')
        .toLowerCase();
      const index = haystack.indexOf(q);
      if (index === -1) return null;
      return {
        id: artifact.id,
        title: latest?.title || artifact.id,
        subtitle: `${artifact.kind} · ${artifact.versions.length} версий`,
        snippet: makeSnippet(haystack, q),
        score: 1,
        kind: 'frame',
      };
    })
    .filter((hit): hit is SimpleHit => hit !== null);
}

export function searchCloudMessages(messages: CloudMessage[], query: string): SimpleHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return messages
    .map((message): SimpleHit | null => {
      const haystack = `${message.text ?? ''}\n${message.notice?.text ?? ''}`.toLowerCase();
      const index = haystack.indexOf(q);
      if (index === -1) return null;
      return {
        id: message.message_id,
        title: message.text?.slice(0, 80) || 'Сообщение',
        subtitle: message.created_at,
        snippet: makeSnippet(haystack, q),
        score: 1,
        kind: 'cloud',
      };
    })
    .filter((hit): hit is SimpleHit => hit !== null)
    .slice(0, 100);
}

export function searchArchive(archive: Archive, query: string, includeToolResults = false): SimpleHit[] {
  const conversations = searchConversations(archive.conversations, query, includeToolResults).slice(0, 50).map((hit) => ({
    id: hit.conversation.uuid,
    title: hit.conversation.name,
    subtitle: `Чат · ${hit.conversation.chat_messages.length} сообщений`,
    snippet: hit.snippet,
    score: hit.score,
    kind: 'conversation' as const,
  }));
  return [
    ...conversations,
    ...searchProjects(archive.projects, query),
    ...searchFrames(archive.frames, query),
    ...searchMemories(archive.memories, query),
    ...searchCloudMessages(archive.cloud.messages, query),
  ].sort((a, b) => b.score - a.score);
}
