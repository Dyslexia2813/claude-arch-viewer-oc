import type { Project, ProjectDoc } from '../types';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeDoc(raw: unknown): ProjectDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.filename !== 'string') return null;
  return {
    uuid: asString(item.uuid),
    filename: item.filename,
    content: asString(item.content),
    created_at: asString(item.created_at),
  };
}

export function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.uuid !== 'string' || typeof item.name !== 'string') return null;
  const creator = item.creator && typeof item.creator === 'object' ? (item.creator as Record<string, unknown>) : {};
  return {
    uuid: item.uuid,
    name: item.name,
    description: asString(item.description),
    is_private: Boolean(item.is_private),
    is_starter_project: Boolean(item.is_starter_project),
    prompt_template: asString(item.prompt_template),
    created_at: asString(item.created_at),
    updated_at: asString(item.updated_at),
    creator: { uuid: asString(creator.uuid), full_name: asString(creator.full_name) },
    docs: (Array.isArray(item.docs) ? item.docs : [])
      .map(normalizeDoc)
      .filter((value): value is ProjectDoc => value !== null),
  };
}

export function parseProjects(raw: unknown): Project[] {
  return (Array.isArray(raw) ? raw : [])
    .map(normalizeProject)
    .filter((value): value is Project => value !== null);
}
