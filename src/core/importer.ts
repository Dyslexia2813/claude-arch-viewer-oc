import type {
  Archive,
  ArchiveFileEntry,
  ArchiveStats,
  CloudData,
  Conversation,
  FeedbackArchive,
  FrameArtifact,
  ImportProgressCallback,
  LoginEvent,
  Manifest,
  MemoryFile,
  Message,
  Project,
  Reflection,
  User,
} from './types';
import { reconstructInlineArtifacts } from './artifacts';
import { isManifest, manifestFileKey, parseManifest } from './manifest';
import { parseCloud, emptyCloudData } from './parsers/cloud';
import { parseConversations } from './parsers/conversations';
import { parseFeedbackArchive } from './parsers/feedback';
import { parseFrames } from './parsers/frames';
import { parseMemoryArchive } from './parsers/memories';
import { parseLoginHistory, parseUsers } from './parsers/metadata';
import { parseProjects } from './parsers/projects';
import { detectCategoryFromFilename, readJsonEntry, unzipArchive, type ZipEntry } from './zip';

interface ParsedZip {
  conversations: Conversation[];
  projects: Project[];
  memories: MemoryFile[];
  reflections: Reflection[];
  users: User[];
  loginEvents: LoginEvent[];
  frames: FrameArtifact[];
  cloud: CloudData | null;
  warnings: string[];
}

function emptyStats(): ArchiveStats {
  return {
    conversations: 0,
    messages: 0,
    projects: 0,
    frames: 0,
    frameVersions: 0,
    inlineArtifacts: 0,
    memories: 0,
    reflections: 0,
    cloudChannels: 0,
    cloudMessages: 0,
    cloudTranscripts: 0,
    files: 0,
    totalBytes: 0,
    missingFiles: 0,
    blockCounts: {},
  };
}

export function emptyArchive(): Archive {
  return {
    conversations: [],
    projects: [],
    frames: [],
    inlineArtifacts: [],
    memories: [],
    reflections: [],
    users: [],
    loginEvents: [],
    cloud: emptyCloudData(),
    files: [],
    sources: [],
    warnings: [],
    stats: emptyStats(),
    rawFiles: new Map(),
  };
}

function projectArray(raw: unknown): Project[] {
  if (Array.isArray(raw)) return parseProjects(raw);
  if (raw && typeof raw === 'object') {
    const item = raw as Record<string, unknown>;
    if (Array.isArray(item.projects)) return parseProjects(item.projects);
    return parseProjects([raw]);
  }
  return [];
}

function memoryArray(raw: unknown): MemoryFile[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => parseMemoryArchive(entry));
  }
  return parseMemoryArchive(raw);
}

function feedbackArray(raw: unknown): Reflection[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => parseFeedbackArchive(entry));
  }
  return parseFeedbackArchive(raw);
}

function parseZipEntries(entries: ZipEntry[]): ParsedZip {
  const result: ParsedZip = {
    conversations: [],
    projects: [],
    memories: [],
    reflections: [],
    users: [],
    loginEvents: [],
    frames: [],
    cloud: null,
    warnings: [],
  };
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));

  const conversationEntry = byPath.get('conversations.json');
  if (conversationEntry) {
    try {
      result.conversations = parseConversations(readJsonEntry(conversationEntry));
    } catch (error) {
      result.warnings.push(`Не удалось разобрать conversations.json: ${(error as Error).message}`);
    }
  }

  const projectEntries = entries.filter(
    (entry) => entry.path === 'projects.json' || /^projects\/[^/]+\.json$/.test(entry.path),
  );
  for (const entry of projectEntries) {
    try {
      result.projects.push(...projectArray(readJsonEntry(entry)));
    } catch (error) {
      result.warnings.push(`Не удалось разобрать ${entry.path}: ${(error as Error).message}`);
    }
  }

  const memoryEntries = entries.filter((entry) => /^memories\/[^/]+\.json$/.test(entry.path));
  for (const entry of memoryEntries) {
    try {
      result.memories.push(...memoryArray(readJsonEntry(entry)));
    } catch (error) {
      result.warnings.push(`Не удалось разобрать ${entry.path}: ${(error as Error).message}`);
    }
  }

  const feedbackEntries = entries.filter((entry) => /^reflections\/[^/]+\.json$/.test(entry.path));
  for (const entry of feedbackEntries) {
    try {
      result.reflections.push(...feedbackArray(readJsonEntry(entry)));
    } catch (error) {
      result.warnings.push(`Не удалось разобрать ${entry.path}: ${(error as Error).message}`);
    }
  }

  const usersEntry = byPath.get('users.json');
  if (usersEntry) {
    try {
      result.users = parseUsers(readJsonEntry(usersEntry));
    } catch (error) {
      result.warnings.push(`Не удалось разобрать users.json: ${(error as Error).message}`);
    }
  }

  const loginEntry = byPath.get('login_history.json');
  if (loginEntry) {
    try {
      result.loginEvents = parseLoginHistory(readJsonEntry(loginEntry));
    } catch (error) {
      result.warnings.push(`Не удалось разобрать login_history.json: ${(error as Error).message}`);
    }
  }

  if (entries.some((entry) => /^artifacts\/[^/]+\/artifact\.json$/.test(entry.path))) {
    const parsed = parseFrames(entries);
    result.frames.push(...parsed.artifacts);
    result.warnings.push(...parsed.warnings);
  }

  if (entries.some((entry) => entry.path.startsWith('claude_code_cloud/'))) {
    result.cloud = parseCloud(entries);
  }

  return result;
}

function newer<T extends { updated_at?: string }>(a: T, b: T): T {
  const da = Date.parse(a.updated_at || '') || 0;
  const db = Date.parse(b.updated_at || '') || 0;
  return db > da ? b : a;
}

function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of a) byId.set(message.uuid, message);
  for (const message of b) {
    if (!byId.has(message.uuid)) byId.set(message.uuid, message);
  }
  return [...byId.values()].sort((x, y) => (Date.parse(x.created_at) || 0) - (Date.parse(y.created_at) || 0));
}

function mergeConversation(a: Conversation, b: Conversation): Conversation {
  const base = newer(a, b);
  return {
    ...base,
    name: base.name || a.name || b.name,
    summary: base.summary || a.summary || b.summary,
    chat_messages: mergeMessages(a.chat_messages, b.chat_messages),
  };
}

function mergeConversations(target: Map<string, Conversation>, incoming: Conversation[]): void {
  for (const conversation of incoming) {
    const existing = target.get(conversation.uuid);
    target.set(conversation.uuid, existing ? mergeConversation(existing, conversation) : conversation);
  }
}

function mergeProjects(target: Map<string, Project>, incoming: Project[]): void {
  for (const project of incoming) {
    const existing = target.get(project.uuid);
    if (!existing) {
      target.set(project.uuid, project);
      continue;
    }
    const base = newer(existing, project);
    const docs = new Map(existing.docs.map((doc) => [doc.uuid || doc.filename, doc]));
    for (const doc of project.docs) docs.set(doc.uuid || doc.filename, doc);
    target.set(project.uuid, { ...base, docs: [...docs.values()] });
  }
}

function mergeMemories(target: Map<string, MemoryFile>, incoming: MemoryFile[]): void {
  for (const file of incoming) {
    const existing = target.get(file.path);
    if (!existing) {
      target.set(file.path, file);
      continue;
    }
    target.set(file.path, newer(existing, file));
  }
}

function mergeReflections(target: Map<string, Reflection>, incoming: Reflection[]): void {
  for (const reflection of incoming) {
    const existing = target.get(reflection.period);
    if (!existing) {
      target.set(reflection.period, reflection);
      continue;
    }
    target.set(reflection.period, newer(existing, reflection));
  }
}

function mergeFrames(target: Map<string, FrameArtifact>, incoming: FrameArtifact[]): void {
  for (const artifact of incoming) {
    const existing = target.get(artifact.id);
    if (!existing) {
      target.set(artifact.id, artifact);
      continue;
    }
    const versions = new Map(existing.versions.map((version) => [version.id, version]));
    for (const version of artifact.versions) versions.set(version.id, version);
    const base = (Date.parse(artifact.updatedAt || '') || 0) > (Date.parse(existing.updatedAt || '') || 0)
      ? artifact
      : existing;
    target.set(artifact.id, {
      ...base,
      versions: [...versions.values()].sort(
        (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
      ),
      activeVersion: base.activeVersion ?? existing.activeVersion,
    });
  }
}

function mergeCloud(target: CloudData, incoming: CloudData): CloudData {
  const mergeBy = <T>(a: T[], b: T[], key: (item: T) => string): T[] => {
    const map = new Map<string, T>();
    for (const item of a) map.set(key(item), item);
    for (const item of b) map.set(key(item), item);
    return [...map.values()];
  };

  return {
    channels: mergeBy(target.channels, incoming.channels, (item) => item.channel_id),
    memberships: mergeBy(
      target.memberships,
      incoming.memberships,
      (item) => `${item.channel_id}|${item.account_uuid}`,
    ),
    messages: mergeBy(target.messages, incoming.messages, (item) => item.message_id).sort(
      (a, b) => (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0),
    ),
    agents: mergeBy(target.agents, incoming.agents, (item) => item.agent_id),
    routines: mergeBy(target.routines, incoming.routines, (item) => item.routine_id),
    routineRuns: mergeBy(
      target.routineRuns,
      incoming.routineRuns,
      (item) => `${item.routine_id}|${item.scheduled_for ?? ''}`,
    ),
    projectFiles: mergeBy(
      target.projectFiles,
      incoming.projectFiles,
      (item) => `${item.project_id}|${item.path}`,
    ),
    memoryFiles: mergeBy(
      target.memoryFiles,
      incoming.memoryFiles,
      (item) => `${item.channel}|${item.path}`,
    ),
    transcripts: mergeBy(
      target.transcripts,
      incoming.transcripts,
      (item) => JSON.stringify(item),
    ).sort((a, b) => {
      if (a.session_id !== b.session_id) return a.session_id.localeCompare(b.session_id);
      if (a.part !== b.part) return a.part - b.part;
      return (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);
    }),
  };
}

function mergeUsers(target: Map<string, User>, incoming: User[]): void {
  for (const user of incoming) target.set(user.uuid, user);
}

function mergeLoginEvents(target: Map<string, LoginEvent>, incoming: LoginEvent[]): void {
  for (const event of incoming) {
    target.set(`${event.timestamp}|${event.ip_address}|${event.method}`, event);
  }
}

function computeStats(archive: Archive): ArchiveStats {
  const blockCounts: Record<string, number> = {};
  let messages = 0;
  let missingFiles = 0;

  for (const conversation of archive.conversations) {
    for (const message of conversation.chat_messages) {
      messages += 1;
      missingFiles += message.files.length;
      for (const attachment of message.attachments) {
        if (!attachment.extracted_content) missingFiles += 1;
      }
      for (const block of message.content) {
        blockCounts[block.type] = (blockCounts[block.type] ?? 0) + 1;
        if (block.type === 'image' || block.type === 'document') missingFiles += 1;
      }
    }
  }

  const frameVersions = archive.frames.reduce((sum, artifact) => sum + artifact.versions.length, 0);
  return {
    conversations: archive.conversations.length,
    messages,
    projects: archive.projects.length,
    frames: archive.frames.length,
    frameVersions,
    inlineArtifacts: archive.inlineArtifacts.length,
    memories: archive.memories.length,
    reflections: archive.reflections.length,
    cloudChannels: archive.cloud.channels.length,
    cloudMessages: archive.cloud.messages.length,
    cloudTranscripts: archive.cloud.transcripts.length,
    files: archive.files.length,
    totalBytes: archive.files.reduce((sum, file) => sum + file.size, 0),
    missingFiles,
    blockCounts,
  };
}

export interface ImportOptions {
  existing?: Archive;
  onProgress?: ImportProgressCallback;
}

export async function importFiles(files: File[], options: ImportOptions = {}): Promise<Archive> {
  const archive = options.existing ?? emptyArchive();
  const progress = options.onProgress ?? (() => undefined);

  let manifest: Manifest | undefined;
  const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith('.json'));
  for (const file of jsonFiles) {
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      if (isManifest(raw)) {
        manifest = parseManifest(raw);
        break;
      }
    } catch {
      // Не manifest — возможно, это отдельный JSON из архива. Обработаем позже.
    }
  }
  if (manifest) archive.manifest = manifest;

  const manifestByFilename = new Map<string, Manifest['data_files'][number]>();
  if (manifest) {
    for (const item of manifest.data_files) {
      manifestByFilename.set(item.filename.toLowerCase(), item);
    }
  }

  const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith('.zip'));
  if (zipFiles.length === 0) {
    archive.warnings.push('Не найдено ни одного ZIP-файла архива.');
  }

  const loadedCategories = new Set<string>();
  let index = 0;

  for (const zip of zipFiles) {
    index += 1;
    progress({
      stage: 'Распаковка',
      current: index,
      total: zipFiles.length,
      detail: zip.name,
    });

    try {
      const data = new Uint8Array(await zip.arrayBuffer());
      const manifestEntry = manifestByFilename.get(zip.name.toLowerCase());
      const categoryHint = manifestEntry?.category ?? detectCategoryFromFilename(zip.name);
      if (archive.sources.some((source) => source.filename === zip.name && source.size === data.length)) {
        archive.warnings.push(`${zip.name} уже загружен, пропускаю повторный импорт.`);
        if (categoryHint) loadedCategories.add(categoryHint);
        continue;
      }
      const unzipped = unzipArchive(data, categoryHint);
      const sourceId = `${zip.name}:${index}`;

      for (const entry of unzipped.entries) {
        archive.rawFiles.set(`${sourceId}/${entry.path}`, entry.data);
      }
      for (const file of unzipped.files) {
        archive.files.push({ ...file, source: zip.name, sourceId });
      }

      archive.sources.push({
        id: sourceId,
        filename: zip.name,
        category: categoryHint ?? 'unknown',
        size: data.length,
        importedAt: new Date().toISOString(),
        entries: unzipped.entries.length,
      });
      if (categoryHint) loadedCategories.add(categoryHint);

      progress({
        stage: 'Разбор',
        current: index,
        total: zipFiles.length,
        detail: `${zip.name}: ${unzipped.entries.length} файлов`,
      });
      const parsed = parseZipEntries(unzipped.entries);
      archive.warnings.push(...parsed.warnings);

      const conversationMap = new Map(archive.conversations.map((item) => [item.uuid, item]));
      mergeConversations(conversationMap, parsed.conversations);
      archive.conversations = [...conversationMap.values()].sort(
        (a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0),
      );

      const projectMap = new Map(archive.projects.map((item) => [item.uuid, item]));
      mergeProjects(projectMap, parsed.projects);
      archive.projects = [...projectMap.values()].sort((a, b) => a.name.localeCompare(b.name));

      const memoryMap = new Map(archive.memories.map((item) => [item.path, item]));
      mergeMemories(memoryMap, parsed.memories);
      archive.memories = [...memoryMap.values()].sort((a, b) => a.path.localeCompare(b.path));

      const reflectionMap = new Map(archive.reflections.map((item) => [item.period, item]));
      mergeReflections(reflectionMap, parsed.reflections);
      archive.reflections = [...reflectionMap.values()].sort(
        (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
      );

      const userMap = new Map(archive.users.map((item) => [item.uuid, item]));
      mergeUsers(userMap, parsed.users);
      archive.users = [...userMap.values()];

      const loginMap = new Map(
        archive.loginEvents.map((item) => [`${item.timestamp}|${item.ip_address}|${item.method}`, item]),
      );
      mergeLoginEvents(loginMap, parsed.loginEvents);
      archive.loginEvents = [...loginMap.values()].sort(
        (a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0),
      );

      const frameMap = new Map(archive.frames.map((item) => [item.id, item]));
      mergeFrames(frameMap, parsed.frames);
      archive.frames = [...frameMap.values()].sort((a, b) => {
        const da = Date.parse(a.versions[0]?.created_at || a.updatedAt || '') || 0;
        const db = Date.parse(b.versions[0]?.created_at || b.updatedAt || '') || 0;
        return db - da;
      });

      if (parsed.cloud) archive.cloud = mergeCloud(archive.cloud, parsed.cloud);
    } catch (error) {
      archive.warnings.push(`Не удалось обработать ${zip.name}: ${(error as Error).message}`);
    }
  }

  if (manifest) {
    for (const item of manifest.data_files) {
      if (!loadedCategories.has(item.category)) {
        archive.warnings.push(
          `В manifest есть категория «${item.category}» (${item.filename}), но соответствующий ZIP не загружен.`,
        );
      }
    }
  }

  archive.inlineArtifacts = reconstructInlineArtifacts(archive.conversations);
  archive.files.sort((a, b) => a.path.localeCompare(b.path));
  archive.stats = computeStats(archive);

  progress({
    stage: 'Готово',
    current: zipFiles.length,
    total: zipFiles.length,
    detail: `${archive.stats.conversations} чатов, ${archive.stats.messages} сообщений`,
  });

  return archive;
}

export function manifestKey(item: Manifest['data_files'][number]): string {
  return manifestFileKey(item);
}
