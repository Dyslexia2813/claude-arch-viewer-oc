import { unzipSync } from 'fflate';
import type { ArchiveFileEntry } from './types';
import { decodeText, isProbablyText } from './utils';

export interface ZipEntry {
  path: string;
  size: number;
  data: Uint8Array;
}

export interface UnzippedArchive {
  entries: ZipEntry[];
  files: ArchiveFileEntry[];
}

export function detectCategoryFromPath(path: string): string {
  if (path === 'conversations.json' || path.startsWith('conversations/')) return 'conversations';
  if (path.startsWith('projects/') || path === 'projects.json') return 'projects';
  if (path.startsWith('memories/') || path === 'memories.json') return 'memories';
  if (path.startsWith('reflections/') || path === 'feedback.json') return 'feedback';
  if (path.startsWith('artifacts/')) return 'frames';
  if (path.startsWith('claude_code_cloud/')) return 'claude_code_cloud';
  if (path === 'users.json' || path === 'login_history.json') return 'light_metadata';
  return 'unknown';
}

export function detectCategoryFromFilename(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  const known = [
    'light_metadata',
    'projects',
    'memories',
    'feedback',
    'frames',
    'claude_code_cloud',
    'conversations',
  ];
  return known.find((category) => lower.startsWith(`${category}-`) || lower.startsWith(`${category}.`));
}

export function unzipArchive(data: Uint8Array, categoryHint?: string): UnzippedArchive {
  const raw = unzipSync(data);
  const entries: ZipEntry[] = [];
  const files: ArchiveFileEntry[] = [];

  for (const [path, bytes] of Object.entries(raw)) {
    if (path.endsWith('/')) continue;
    entries.push({ path, size: bytes.length, data: bytes });
    const isText = isProbablyText(path, bytes);
    const detected = detectCategoryFromPath(path);
    files.push({
      path,
      size: bytes.length,
      category: detected !== 'unknown' ? detected : (categoryHint ?? 'unknown'),
      isText,
      text: isText && bytes.length < 2_000_000 ? decodeText(bytes) : undefined,
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { entries, files };
}

export function readJsonEntry<T>(entry: ZipEntry): T {
  return JSON.parse(decodeText(entry.data)) as T;
}
