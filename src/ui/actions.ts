import { strToU8, zipSync } from 'fflate';
import type { ArchiveFileEntry, Conversation, FrameArtifact, InlineArtifact, Project } from '../core/types';
import { artifactExtension } from '../core/artifacts';
import { buildArchiveZip, buildChatZip, buildProjectZip, chatToMarkdown } from '../core/export';
import { bytesToBlob, dateStamp, downloadBlob, downloadText, safeName } from '../core/utils';
import { archive, chatOptions, showToast } from './state';

export function exportChatMarkdown(conversation: Conversation): void {
  downloadText(
    chatToMarkdown(conversation, chatOptions.value),
    `${safeName(conversation.name, 'chat')}.md`,
    'text/markdown;charset=utf-8',
  );
  showToast('Чат сохранён в Markdown');
}

export function exportChatJson(conversation: Conversation): void {
  downloadText(
    JSON.stringify(conversation, null, 2),
    `${safeName(conversation.name, 'chat')}.json`,
    'application/json;charset=utf-8',
  );
  showToast('Чат сохранён в JSON');
}

export function exportChatZip(conversation: Conversation): void {
  const artifacts = archive.value?.inlineArtifacts.filter((artifact) => artifact.conversationUuid === conversation.uuid) ?? [];
  const data = buildChatZip(conversation, artifacts, chatOptions.value);
  downloadBlob(bytesToBlob(data, 'application/zip'), `${safeName(conversation.name, 'chat')}.zip`);
  showToast('ZIP с чатом и артефактами сохранён');
}

export function exportProjectZip(project: Project): void {
  const data = buildProjectZip(project);
  downloadBlob(bytesToBlob(data, 'application/zip'), `${safeName(project.name, 'project')}.zip`);
  showToast('Проект сохранён в ZIP');
}

export function exportArchiveZip(): void {
  if (!archive.value) return;
  const data = buildArchiveZip(archive.value, chatOptions.value);
  downloadBlob(bytesToBlob(data, 'application/zip'), `claude-archive-${dateStamp()}.zip`);
  showToast('Архив сохранён в ZIP');
}

export function exportInlineArtifact(artifact: InlineArtifact): void {
  const latest = artifact.versions[artifact.versions.length - 1];
  const ext = artifactExtension(latest?.type ?? artifact.type, latest?.language ?? artifact.language);
  downloadText(artifact.content, `${safeName(artifact.title, artifact.id)}.${ext}`, 'text/plain;charset=utf-8');
  showToast('Артефакт сохранён');
}

export function exportFrameVersion(frame: FrameArtifact, versionId?: string): void {
  const version = frame.versions.find((item) => item.id === versionId) ?? frame.versions[0];
  if (!version) return;
  const files: Record<string, Uint8Array> = {};
  for (const file of version.files) {
    if (file.data) files[file.path] = file.data;
  }
  if (version.pageMd) files['page.md'] = strToU8(version.pageMd);
  const data = zipSync(files, { level: 6 });
  downloadBlob(
    bytesToBlob(data, 'application/zip'),
    `${safeName(version.title || frame.id, 'artifact')}-${safeName(version.id, 'version')}.zip`,
  );
  showToast('Версия артефакта сохранена в ZIP');
}

export function downloadRawFile(entry: ArchiveFileEntry): void {
  const data = archive.value?.rawFiles.get(`${entry.sourceId}/${entry.path}`);
  if (!data) {
    showToast('Файл недоступен в памяти');
    return;
  }
  downloadBlob(bytesToBlob(data), entry.path.split('/').pop() ?? 'file');
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано');
  } catch {
    showToast('Не удалось скопировать');
  }
}
