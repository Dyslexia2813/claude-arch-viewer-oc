// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { h } from 'preact';
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { App } from '../src/app';
import { importFiles } from '../src/core/importer';
import { archive, go, section } from '../src/ui/state';

const samplesDir = resolve(process.cwd(), 'samples');
const zipNames = [
  'light_metadata-000.zip',
  'projects-000.zip',
  'memories-000.zip',
  'feedback-000.zip',
  'frames-000.zip',
  'claude_code_cloud-000.zip',
  'conversations-000.zip',
];
const manifestName = existsSync(samplesDir)
  ? readdirSync(samplesDir).find((name) => name.startsWith('manifest-') && name.endsWith('.json')) ?? ''
  : '';
const hasSamples = zipNames.every((name) => existsSync(resolve(samplesDir, name))) && Boolean(manifestName);

describe.skipIf(!hasSamples)('UI на реальном архиве', () => {
  beforeAll(async () => {
    const files = [
      ...zipNames.map((name) => new File([readFileSync(resolve(samplesDir, name))], name)),
      new File([readFileSync(resolve(samplesDir, manifestName))], manifestName),
    ];
    const result = await importFiles(files);
    archive.value = { ...result };
    go('overview');
  }, 120_000);

  it('показывает обзор и разделы', () => {
    const { container } = render(h(App, {}));
    expect(screen.getByRole('heading', { name: 'Обзор архива' })).toBeTruthy();
    expect(container.querySelectorAll('.stat-card').length).toBeGreaterThanOrEqual(8);

    const navButton = (label: string) => {
      const button = [...container.querySelectorAll<HTMLButtonElement>('.nav-item')].find((item) =>
        item.textContent?.includes(label),
      );
      if (!button) throw new Error(`Нет кнопки ${label}`);
      fireEvent.click(button);
    };

    navButton('Чаты');
    expect(section.value).toBe('chats');
    expect(screen.getByRole('heading', { name: 'Чаты' })).toBeTruthy();
    expect(container.querySelectorAll('.conversation-item').length).toBe(271);

    navButton('Артефакты');
    expect(screen.getByRole('heading', { name: 'Артефакты' })).toBeTruthy();
    expect(container.querySelectorAll('.artifact-card').length).toBe(12);

    navButton('Проекты');
    expect(screen.getByRole('heading', { name: 'Проекты' })).toBeTruthy();
    expect(container.querySelectorAll('.project-card').length).toBe(3);

    navButton('Claude Code Cloud');
    expect(screen.getByRole('heading', { name: 'Claude Code Cloud' })).toBeTruthy();
    expect(container.querySelectorAll('.project-card').length).toBe(4);

    navButton('Память');
    expect(screen.getByRole('heading', { name: 'Память' })).toBeTruthy();

    navButton('Файлы');
    expect(screen.getByRole('heading', { name: 'Файлы' })).toBeTruthy();
    expect(container.querySelectorAll('.files-table tbody tr').length).toBe(544);

    navButton('Диагностика');
    expect(screen.getByText('Предупреждений нет.')).toBeTruthy();

    cleanup();
  }, 120_000);
});
