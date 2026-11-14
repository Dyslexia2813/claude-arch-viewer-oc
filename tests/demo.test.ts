import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importFiles } from '../src/core/importer';

describe('демо-архив', () => {
  it('импортируется без предупреждений и содержит все категории', async () => {
    const data = readFileSync(resolve(process.cwd(), 'public/demo/demo-export.zip'));
    const archive = await importFiles([new File([data], 'demo-export.zip')]);

    expect(archive.stats.conversations).toBe(3);
    expect(archive.stats.messages).toBe(9);
    expect(archive.stats.projects).toBe(1);
    expect(archive.stats.frames).toBe(2);
    expect(archive.stats.inlineArtifacts).toBe(1);
    expect(archive.stats.memories).toBe(2);
    expect(archive.stats.reflections).toBe(1);
    expect(archive.stats.cloudChannels).toBe(1);
    expect(archive.stats.cloudMessages).toBe(2);
    expect(archive.stats.cloudTranscripts).toBe(2);
    expect(archive.stats.files).toBe(23);
    expect(archive.warnings).toEqual([]);

    expect(archive.inlineArtifacts[0].content).toContain('вторая версия');
    expect(archive.frames.some((frame) => frame.kind === 'page')).toBe(true);
    expect(archive.frames.some((frame) => frame.kind === 'artifact')).toBe(true);
  });
});
