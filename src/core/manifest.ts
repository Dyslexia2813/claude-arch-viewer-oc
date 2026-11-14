import type { Manifest, ManifestFile } from './types';

const CATEGORY_LABELS: Record<string, string> = {
  light_metadata: 'Метаданные аккаунта',
  projects: 'Проекты',
  memories: 'Память',
  feedback: 'Рефлексии',
  frames: 'Артефакты (Frames)',
  claude_code_cloud: 'Claude Code Cloud',
  conversations: 'Чаты',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.data_files);
}

export function parseManifest(value: unknown): Manifest {
  if (!isManifest(value)) {
    throw new Error('Это не manifest экспорта Claude: нет массива data_files.');
  }
  const dataFiles: ManifestFile[] = value.data_files.map((raw, index) => {
    const item = (raw ?? {}) as unknown as Record<string, unknown>;
    if (typeof item.filename !== 'string' || typeof item.export_url !== 'string') {
      throw new Error(`Некорректная запись manifest #${index + 1}.`);
    }
    return {
      batch_index: Number(item.batch_index ?? index),
      export_url: String(item.export_url),
      category: String(item.category ?? 'unknown'),
      part: Number(item.part ?? 0),
      filename: String(item.filename),
    };
  });
  return {
    instructions: typeof value.instructions === 'string' ? value.instructions : undefined,
    created_at: String(value.created_at ?? ''),
    total_files: Number(value.total_files ?? dataFiles.length),
    data_files: dataFiles,
    version: String(value.version ?? '1.0'),
  };
}

export function manifestExpiresAt(manifest: Manifest): Date | null {
  if (!manifest.created_at) return null;
  const created = new Date(manifest.created_at);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(created.getTime() + 24 * 60 * 60 * 1000);
}

export function manifestFileKey(file: ManifestFile): string {
  return `${file.category}:${file.part}:${file.filename}`;
}
