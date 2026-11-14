import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
const manifestName = 'manifest-0f28ab5b-8183-425a-84c8-10db244ece62-1793289609-07903801-2026-10-29-16-02-53.json';
const hasSamples = zipNames.every((name) => existsSync(resolve(samplesDir, name)));

test.skip(!hasSamples, 'Нет локальных samples для e2e.');

test('импорт, навигация и отсутствие ошибок', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Claude Arch Viewer' })).toBeVisible();

  const input = page.locator('input[type=file]').first();
  await input.setInputFiles([
    ...zipNames.map((name) => resolve(samplesDir, name)),
    resolve(samplesDir, manifestName),
  ]);

  await expect(page.getByRole('heading', { name: 'Обзор архива' })).toBeVisible({ timeout: 120_000 });

  const chatsCard = page.locator('.stat-card', { hasText: 'Чаты' });
  await expect(chatsCard.locator('.stat-value')).toHaveText('271');
  const framesCard = page.locator('.stat-card', { hasText: 'Frames' });
  await expect(framesCard.locator('.stat-value')).toHaveText('12');
  const inlineCard = page.locator('.stat-card', { hasText: 'Артефакты из чатов' });
  await expect(inlineCard.locator('.stat-value')).toHaveText('5');

  await page.getByRole('button', { name: /Чаты/ }).click();
  await expect(page.getByRole('heading', { name: 'Чаты' })).toBeVisible();
  await expect(page.locator('.conversation-item')).toHaveCount(271);

  await page.getByRole('button', { name: /Артефакты/ }).click();
  await expect(page.getByRole('heading', { name: 'Артефакты' })).toBeVisible();
  await expect(page.locator('.artifact-card')).toHaveCount(12);
  await page.locator('.artifact-card').first().click();
  await expect(page.locator('.artifact-preview')).toBeVisible();
  await page.getByRole('button', { name: 'К артефактам' }).click();

  await page.getByRole('button', { name: /Проекты/ }).click();
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(3);

  await page.getByRole('button', { name: /Claude Code Cloud/ }).click();
  await expect(page.getByRole('heading', { name: 'Claude Code Cloud' })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(4);

  await page.getByRole('button', { name: /Файлы/ }).click();
  await expect(page.getByRole('heading', { name: 'Файлы' })).toBeVisible();
  await expect(page.locator('.files-table tbody tr')).toHaveCount(544);

  await page.getByRole('button', { name: /Диагностика/ }).click();
  await expect(page.getByRole('heading', { name: 'Диагностика' })).toBeVisible();
  await expect(page.getByText('Предупреждений нет.')).toBeVisible();

  expect(errors).toEqual([]);
});
