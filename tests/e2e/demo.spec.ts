import { expect, test } from '@playwright/test';

test('демо-архив: импорт и навигация', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Claude Arch Viewer' })).toBeVisible();
  await page.getByRole('button', { name: /Открыть демо-архив/ }).click();
  await expect(page.getByRole('heading', { name: 'Обзор архива' })).toBeVisible({ timeout: 60_000 });

  const chatsCard = page.locator('.stat-card', { hasText: 'Чаты' });
  await expect(chatsCard.locator('.stat-value')).toHaveText('3');
  const framesCard = page.locator('.stat-card', { hasText: 'Frames' });
  await expect(framesCard.locator('.stat-value')).toHaveText('2');
  const inlineCard = page.locator('.stat-card', { hasText: 'Артефакты из чатов' });
  await expect(inlineCard.locator('.stat-value')).toHaveText('1');

  await page.getByRole('button', { name: /Чаты/ }).click();
  await expect(page.getByRole('heading', { name: 'Чаты' })).toBeVisible();
  await expect(page.locator('.conversation-item')).toHaveCount(3);

  await page.getByRole('button', { name: /Артефакты/ }).click();
  await expect(page.getByRole('heading', { name: 'Артефакты' })).toBeVisible();
  await expect(page.locator('.artifact-card')).toHaveCount(2);

  await page.getByRole('button', { name: /Проекты/ }).click();
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(1);

  await page.getByRole('button', { name: /Claude Code Cloud/ }).click();
  await expect(page.getByRole('heading', { name: 'Claude Code Cloud' })).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(1);

  await page.getByRole('button', { name: /Файлы/ }).click();
  await expect(page.getByRole('heading', { name: 'Файлы' })).toBeVisible();
  await expect(page.locator('.files-table tbody tr')).toHaveCount(23);

  expect(errors).toEqual([]);
});
