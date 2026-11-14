import type {
  CloudAgent,
  CloudChannel,
  CloudChannelMembership,
  CloudData,
  CloudMemoryFile,
  CloudMessage,
  CloudProjectFile,
  CloudRoutine,
  CloudRoutineRun,
  CloudTranscript,
} from '../types';
import type { ZipEntry } from '../zip';
import { decodeText } from '../utils';

function readJson<T>(entry: ZipEntry | undefined): T | null {
  if (!entry) return null;
  try {
    return JSON.parse(decodeText(entry.data)) as T;
  } catch {
    return null;
  }
}

function extractArray<T>(raw: unknown): T[] {
  if (!raw || typeof raw !== 'object') return [];
  const item = raw as Record<string, unknown>;
  if (Array.isArray(item.claude_code_cloud)) return item.claude_code_cloud as T[];
  if (Array.isArray(raw)) return raw as T[];
  return [];
}

export function emptyCloudData(): CloudData {
  return {
    channels: [],
    memberships: [],
    messages: [],
    agents: [],
    routines: [],
    routineRuns: [],
    projectFiles: [],
    memoryFiles: [],
    transcripts: [],
  };
}

export function parseCloud(entries: ZipEntry[]): CloudData {
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const read = (path: string) => readJson<unknown>(byPath.get(path));

  const channels = extractArray<CloudChannel>(read('claude_code_cloud/channels/channels.json'));
  const memberships = extractArray<CloudChannelMembership>(
    read('claude_code_cloud/channels/memberships.json'),
  );
  const messages = extractArray<CloudMessage>(read('claude_code_cloud/channels/messages.json'));
  const agents = extractArray<CloudAgent>(read('claude_code_cloud/agents.json'));
  const routines = extractArray<CloudRoutine>(read('claude_code_cloud/routines.json'));
  const routineRuns = extractArray<CloudRoutineRun>(read('claude_code_cloud/routine_runs.json'));
  const projectFiles = extractArray<CloudProjectFile>(read('claude_code_cloud/project_files.json'));
  const memoryFiles = extractArray<CloudMemoryFile>(read('claude_code_cloud/channel_memory_files.json'));
  const transcripts = extractArray<CloudTranscript>(
    read('claude_code_cloud/channel_session_transcripts.json'),
  );

  channels.sort((a, b) => String(a.content?.name ?? '').localeCompare(String(b.content?.name ?? '')));
  messages.sort((a, b) => (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0));

  return {
    channels,
    memberships,
    messages,
    agents,
    routines,
    routineRuns,
    projectFiles,
    memoryFiles,
    transcripts,
  };
}
