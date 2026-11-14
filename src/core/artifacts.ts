import type { Conversation, InlineArtifact, InlineArtifactVersion } from './types';

interface ArtifactToolInput {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  command?: unknown;
  content?: unknown;
  old_str?: unknown;
  new_str?: unknown;
  language?: unknown;
  version_uuid?: unknown;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function applyPatch(content: string, oldStr: string, newStr: string): { content: string; error?: string } {
  if (!oldStr) {
    return { content: newStr, error: 'Пустой old_str: замена не может быть проверена.' };
  }
  const index = content.indexOf(oldStr);
  if (index === -1) {
    return { content, error: 'old_str не найден в текущей версии артефакта.' };
  }
  return { content: content.slice(0, index) + newStr + content.slice(index + oldStr.length) };
}

export function reconstructInlineArtifacts(conversations: Conversation[]): InlineArtifact[] {
  const result: InlineArtifact[] = [];

  for (const conversation of conversations) {
    const artifacts = new Map<string, InlineArtifact>();

    for (const message of conversation.chat_messages) {
      for (const block of message.content) {
        if (block.type !== 'tool_use' || block.name !== 'artifacts') continue;
        const input = (block.input ?? {}) as ArtifactToolInput;
        const id = str(input.id);
        if (!id) continue;

        let artifact = artifacts.get(id);
        if (!artifact) {
          artifact = {
            id,
            title: str(input.title) ?? id,
            type: str(input.type),
            language: str(input.language),
            conversationUuid: conversation.uuid,
            conversationName: conversation.name,
            versions: [],
            content: '',
          };
          artifacts.set(id, artifact);
        }

        if (str(input.title)) artifact.title = str(input.title) as string;
        if (str(input.type)) artifact.type = str(input.type);
        if (str(input.language)) artifact.language = str(input.language);

        const command = str(input.command) ?? 'unknown';
        const content = str(input.content);
        const oldStr = str(input.old_str);
        const newStr = str(input.new_str);
        let nextContent = artifact.content;
        let error: string | undefined;

        if (command === 'create' || command === 'rewrite' || (command !== 'update' && content !== undefined)) {
          nextContent = content ?? '';
        } else if (command === 'update') {
          if (newStr !== undefined) {
            const patched = applyPatch(artifact.content, oldStr ?? '', newStr);
            nextContent = patched.content;
            error = patched.error;
          } else if (content !== undefined) {
            nextContent = content;
          }
        }

        const version: InlineArtifactVersion = {
          version_uuid: str(input.version_uuid) ?? `${message.uuid}:${artifact.versions.length + 1}`,
          command,
          title: str(input.title),
          type: str(input.type),
          language: str(input.language),
          content: nextContent,
          createdAt: str(block.start_timestamp) ?? message.created_at,
          messageUuid: message.uuid,
          conversationUuid: conversation.uuid,
          error,
        };

        artifact.versions.push(version);
        artifact.content = nextContent;
        if (error) artifact.error = error;
      }
    }

    for (const artifact of artifacts.values()) {
      if (artifact.versions.length === 0) continue;
      artifact.versions.sort(
        (a, b) => (Date.parse(a.createdAt || '') || 0) - (Date.parse(b.createdAt || '') || 0),
      );
      result.push(artifact);
    }
  }

  result.sort((a, b) => {
    const da = Date.parse(a.versions[a.versions.length - 1]?.createdAt || '') || 0;
    const db = Date.parse(b.versions[b.versions.length - 1]?.createdAt || '') || 0;
    return db - da;
  });

  return result;
}

const TYPE_EXTENSIONS: Record<string, string> = {
  'text/markdown': 'md',
  'text/html': 'html',
  'text/plain': 'txt',
  'image/svg+xml': 'svg',
  'application/vnd.ant.code': 'txt',
  'application/vnd.ant.mermaid': 'mmd',
  'application/vnd.ant.react': 'jsx',
  'application/vnd.ant.chart': 'json',
  'application/json': 'json',
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',
  python: 'py',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'md',
  sql: 'sql',
  bash: 'sh',
  shell: 'sh',
  yaml: 'yml',
  xml: 'xml',
  svg: 'svg',
  mermaid: 'mmd',
  text: 'txt',
};

export function artifactExtension(type?: string, language?: string): string {
  if (type && TYPE_EXTENSIONS[type]) return TYPE_EXTENSIONS[type];
  if (language && LANGUAGE_EXTENSIONS[language.toLowerCase()]) return LANGUAGE_EXTENSIONS[language.toLowerCase()];
  return 'txt';
}
