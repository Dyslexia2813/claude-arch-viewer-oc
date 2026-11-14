import type { Reflection } from '../types';

export function parseFeedbackArchive(raw: unknown): Reflection[] {
  if (!raw || typeof raw !== 'object') return [];
  const item = raw as Record<string, unknown>;
  const reflections = Array.isArray(item.reflections) ? item.reflections : [];
  return reflections
    .map((entry): Reflection | null => {
      if (!entry || typeof entry !== 'object') return null;
      const reflection = entry as Record<string, unknown>;
      if (typeof reflection.period !== 'string') return null;
      return {
        period: reflection.period,
        content:
          reflection.content && typeof reflection.content === 'object'
            ? (reflection.content as Record<string, unknown>)
            : {},
        created_at: typeof reflection.created_at === 'string' ? reflection.created_at : '',
        updated_at: typeof reflection.updated_at === 'string' ? reflection.updated_at : '',
      };
    })
    .filter((value): value is Reflection => value !== null);
}
