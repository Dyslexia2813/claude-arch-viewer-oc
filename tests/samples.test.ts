import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importFiles } from '../src/core/importer';

const samplesDir = resolve(process.cwd(), 'samples');
const sampleNames = [
  'light_metadata-000.zip',
  'projects-000.zip',
  'memories-000.zip',
  'feedback-000.zip',
  'frames-000.zip',
  'claude_code_cloud-000.zip',
  'conversations-000.zip',
];
const manifestName = 'manifest-0f28ab5b-8183-425a-84c8-10db244ece62-1793289609-07903801-2026-10-29-16-02-53.json';
const hasSamples = sampleNames.every((name) => existsSync(resolve(samplesDir, name))) && existsSync(resolve(samplesDir, manifestName));

describe.skipIf(!hasSamples)('реальный архив Claude', () => {
  it('разбирает все категории и восстанавливает артефакты', async () => {
    const files = [
      ...sampleNames.map((name) => new File([readFileSync(resolve(samplesDir, name))], name)),
      new File([readFileSync(resolve(samplesDir, manifestName))], manifestName),
    ];
    const archive = await importFiles(files);

    expect(archive.stats.conversations).toBe(271);
    expect(archive.stats.messages).toBe(1723);
    expect(archive.stats.projects).toBe(3);
    expect(archive.stats.frames).toBe(12);
    expect(archive.stats.frameVersions).toBe(29);
    expect(archive.stats.inlineArtifacts).toBe(5);
    expect(archive.stats.memories).toBe(6);
    expect(archive.stats.reflections).toBe(1);
    expect(archive.users).toHaveLength(1);
    expect(archive.loginEvents).toHaveLength(21);
    expect(archive.stats.cloudChannels).toBe(4);
    expect(archive.stats.cloudMessages).toBe(843);
    expect(archive.stats.cloudTranscripts).toBe(4929);
    expect(archive.stats.files).toBe(527 + 9 + 1 + 1 + 2 + 3 + 1);
    expect(archive.frames.reduce((sum, frame) => sum + frame.versions.reduce((n, version) => n + version.files.length, 0), 0)).toBe(479);
    expect(archive.inlineArtifacts.reduce((sum, artifact) => sum + artifact.versions.length, 0)).toBe(14);
    expect(archive.warnings).toEqual([]);
  }, 120_000);
});
