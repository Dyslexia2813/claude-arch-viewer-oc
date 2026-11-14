import type { FrameArtifact, FrameFileEntry, FrameVersion, FrameVersionMeta } from '../types';
import type { ZipEntry } from '../zip';
import { decodeText } from '../utils';

interface FrameFilesManifest {
  files?: Array<{
    original_path?: string;
    exported_as?: string;
    sha256?: string;
    size_bytes?: number;
    mime_type?: string;
  }>;
}

export interface FrameParseResult {
  artifacts: FrameArtifact[];
  warnings: string[];
}

function readJson<T>(entry: ZipEntry | undefined): T | null {
  if (!entry) return null;
  try {
    return JSON.parse(decodeText(entry.data)) as T;
  } catch {
    return null;
  }
}

export function parseFrames(entries: ZipEntry[]): FrameParseResult {
  const byArtifact = new Map<string, ZipEntry[]>();
  for (const entry of entries) {
    const match = /^artifacts\/([^/]+)\//.exec(entry.path);
    if (!match) continue;
    const id = match[1];
    const list = byArtifact.get(id);
    if (list) list.push(entry);
    else byArtifact.set(id, [entry]);
  }

  const artifacts: FrameArtifact[] = [];
  const warnings: string[] = [];

  for (const [id, artifactEntries] of byArtifact) {
    const prefix = `artifacts/${id}/`;
    const metaEntry = artifactEntries.find((entry) => entry.path === `${prefix}artifact.json`);
    const meta = readJson<Record<string, unknown>>(metaEntry);
    if (!meta) {
      warnings.push(`Frames: у артефакта ${id} нет корректного artifact.json.`);
      continue;
    }

    const pageEntry = artifactEntries.find((entry) => entry.path === `${prefix}page.md`);
    const pageMd = pageEntry ? decodeText(pageEntry.data) : undefined;
    const comments = readJson<unknown>(artifactEntries.find((entry) => entry.path === `${prefix}comments.json`));
    const artifactComments = readJson<unknown>(
      artifactEntries.find((entry) => entry.path === `${prefix}artifact_comments.json`),
    );

    const versionMeta = Array.isArray(meta.versions) ? (meta.versions as FrameVersionMeta[]) : [];
    const versions: FrameVersion[] = versionMeta
      .filter((version) => version && typeof version.id === 'string')
      .map((version) => {
        const versionPrefix = `${prefix}versions/${version.id}/`;
        const files: FrameFileEntry[] = artifactEntries
          .filter((entry) => entry.path.startsWith(versionPrefix))
          .map((entry) => ({
            path: entry.path.slice(versionPrefix.length),
            size: entry.size,
            data: entry.data,
          }));

        const filesManifest = readJson<FrameFilesManifest>(
          artifactEntries.find((entry) => entry.path === `${prefix}versions/${version.id}.files.json`),
        );
        if (filesManifest?.files) {
          const byPath = new Map(files.map((file) => [file.path, file]));
          for (const item of filesManifest.files) {
            const path = item.exported_as ?? item.original_path;
            if (!path) continue;
            const file = byPath.get(path);
            if (file) {
              file.mime = item.mime_type;
              file.sha256 = item.sha256;
              file.size = Number(item.size_bytes ?? file.size);
            }
          }
        }

        files.sort((a, b) => a.path.localeCompare(b.path));
        return {
          ...version,
          files,
          pageMd,
        };
      });

    artifacts.push({
      id,
      kind: typeof meta.kind === 'string' ? meta.kind : 'artifact',
      visibility: typeof meta.visibility === 'string' ? meta.visibility : undefined,
      versions,
      activeVersion: typeof meta.active_version === 'string' ? meta.active_version : versions[0]?.id,
      ownerAccount: typeof meta.owner_account === 'string' ? meta.owner_account : undefined,
      updatedAt: typeof meta.updated_at === 'string' ? meta.updated_at : undefined,
      comments,
      artifactComments,
    });
  }

  artifacts.sort((a, b) => {
    const da = Date.parse(a.versions[0]?.created_at || a.updatedAt || '') || 0;
    const db = Date.parse(b.versions[0]?.created_at || b.updatedAt || '') || 0;
    return db - da;
  });

  return { artifacts, warnings };
}
