import type { MemoryFile } from '../types';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseMemoryArchive(raw: unknown): MemoryFile[] {
  if (!raw || typeof raw !== 'object') return [];
  const item = raw as Record<string, unknown>;
  const files = Array.isArray(item.memory_files) ? item.memory_files : [];
  return files
    .map((entry): MemoryFile | null => {
      if (!entry || typeof entry !== 'object') return null;
      const file = entry as Record<string, unknown>;
      if (typeof file.path !== 'string') return null;
      return {
        path: file.path,
        content: asString(file.content),
        updated_at: asString(file.updated_at),
      };
    })
    .filter((value): value is MemoryFile => value !== null);
}
