import { strToU8, zipSync } from 'fflate';
import type {
  Archive,
  ChatExportOptions,
  Conversation,
  FrameArtifact,
  InlineArtifact,
  Message,
  Project,
} from './types';
import { DEFAULT_CHAT_EXPORT_OPTIONS } from './types';
import { artifactExtension } from './artifacts';
import { dateStamp, fmtDate, safeName } from './utils';

function frontmatter(data: Record<string, string | number | undefined>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === '') continue;
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function blockToMarkdown(block: Record<string, unknown>, options: ChatExportOptions): string {
  const type = String(block.type ?? '');
  if (type === 'text') return String(block.text ?? '');
  if (type === 'thinking') {
    if (!options.includeThinking) return '';
    return `<details>\n<summary>Размышления</summary>\n\n${String(block.thinking ?? '')}\n\n</details>`;
  }
  if (type === 'tool_use') {
    if (!options.includeTools) return '';
    const name = String(block.name ?? 'tool');
    if (name === 'artifacts' && options.includeArtifacts) {
      const input = block.input as Record<string, unknown> | undefined;
      return `> Артефакт: ${String(input?.title ?? input?.id ?? 'без названия')} (см. папку artifacts)`;
    }
    const input = JSON.stringify(block.input ?? {}, null, 2);
    return `<details>\n<summary>Инструмент: ${name}</summary>\n\n\`\`\`json\n${input}\n\`\`\`\n\n</details>`;
  }
  if (type === 'tool_result') {
    if (!options.includeToolResults) return '';
    const content = block.content;
    const text = Array.isArray(content)
      ? content
          .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).text ?? '') : ''))
          .join('\n')
      : String(content ?? '');
    return `<details>\n<summary>Результат инструмента${block.is_error ? ' (ошибка)' : ''}</summary>\n\n\`\`\`\n${text}\n\`\`\`\n\n</details>`;
  }
  if (type === 'document') return `> Документ: ${String(block.title ?? block.file_uuid ?? '')}`;
  if (type === 'image') return '> Изображение (бинарник отсутствует в экспорте)';
  if (type === 'flag') return `> Системная пометка: ${String(block.flag ?? '')}`;
  if (type === 'injected_prompt_block') {
    if (!options.includeTools) return '';
    return `<details>\n<summary>Системная вставка</summary>\n\n${String(block.prompt ?? '')}\n\n</details>`;
  }
  return '';
}

function messageToMarkdown(message: Message, options: ChatExportOptions): string {
  const parts: string[] = [];
  const role = message.sender === 'human' ? 'Human' : message.sender === 'assistant' ? 'Assistant' : message.sender;
  parts.push(`## ${role} — ${fmtDate(message.created_at, true)}`, '');
  for (const block of message.content) {
    const text = blockToMarkdown(block, options);
    if (text.trim()) parts.push(text.trim(), '');
  }
  if (options.includeAttachments) {
    for (const attachment of message.attachments) {
      parts.push(
        `<details>\n<summary>Вложение: ${attachment.file_name} (${attachment.file_type || 'файл'})</summary>\n\n${attachment.extracted_content ?? '_Текст не извлечён._'}\n\n</details>`,
        '',
      );
    }
  }
  if (message.files.length > 0) {
    parts.push(`> Файлы: ${message.files.map((file) => file.file_name).join(', ')}`, '');
  }
  return parts.join('\n');
}

export function chatToMarkdown(conversation: Conversation, options: ChatExportOptions = DEFAULT_CHAT_EXPORT_OPTIONS): string {
  const header = frontmatter({
    uuid: conversation.uuid,
    title: conversation.name,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    project_uuid: conversation.project_uuid,
    model: conversation.model,
    source: 'claude.ai export',
  });
  const parts = [header, `# ${conversation.name}`, ''];
  if (conversation.summary) parts.push(`> ${conversation.summary}`, '');
  for (const message of conversation.chat_messages) parts.push(messageToMarkdown(message, options));
  return parts.join('\n');
}

export function projectToMarkdown(project: Project): string {
  const header = frontmatter({
    uuid: project.uuid,
    title: project.name,
    created_at: project.created_at,
    updated_at: project.updated_at,
    private: String(project.is_private),
    starter: String(project.is_starter_project),
  });
  const parts = [header, `# ${project.name}`, '', project.description || '_Описание не указано._', ''];
  if (project.prompt_template) {
    parts.push('## Инструкции проекта', '', project.prompt_template, '');
  }
  parts.push('## Документы', '');
  if (project.docs.length === 0) {
    parts.push('_Документов нет._', '');
  } else {
    for (const doc of project.docs) {
      parts.push(`### ${doc.filename}`, '', doc.content, '');
    }
  }
  return parts.join('\n');
}

export function artifactToMarkdown(artifact: InlineArtifact): string {
  const latest = artifact.versions[artifact.versions.length - 1];
  return [
    `# ${artifact.title}`,
    '',
    `- id: \`${artifact.id}\``,
    `- тип: \`${artifact.type ?? 'не указан'}\``,
    `- язык: \`${artifact.language ?? 'не указан'}\``,
    `- версий: ${artifact.versions.length}`,
    '',
    '```' + (artifact.language ?? ''),
    latest?.content ?? artifact.content,
    '```',
    '',
  ].join('\n');
}

function addText(files: Record<string, Uint8Array>, path: string, text: string): void {
  files[path] = strToU8(text);
}

function uniquePath(files: Record<string, Uint8Array>, path: string): string {
  if (!files[path]) return path;
  const dot = path.lastIndexOf('.');
  const base = dot === -1 ? path : path.slice(0, dot);
  const ext = dot === -1 ? '' : path.slice(dot);
  let index = 2;
  let candidate = `${base}-${index}${ext}`;
  while (files[candidate]) {
    index += 1;
    candidate = `${base}-${index}${ext}`;
  }
  return candidate;
}

function chatFolder(conversation: Conversation): string {
  return `chats/${dateStamp(conversation.created_at)}-${safeName(conversation.name, 'chat')}`;
}

function addInlineArtifacts(
  files: Record<string, Uint8Array>,
  artifacts: InlineArtifact[],
  folder: string,
): void {
  for (const artifact of artifacts) {
    const base = `${folder}/${safeName(artifact.title, artifact.id)}`;
    for (const version of artifact.versions) {
      const ext = artifactExtension(version.type ?? artifact.type, version.language ?? artifact.language);
      const path = uniquePath(files, `${base}/${safeName(version.version_uuid, 'version')}.${ext}`);
      addText(files, path, version.content);
    }
    const latest = artifact.versions[artifact.versions.length - 1];
    const ext = artifactExtension(latest?.type ?? artifact.type, latest?.language ?? artifact.language);
    addText(files, uniquePath(files, `${base}/latest.${ext}`), artifact.content);
  }
}

export function buildChatZip(
  conversation: Conversation,
  artifacts: InlineArtifact[],
  options: ChatExportOptions = DEFAULT_CHAT_EXPORT_OPTIONS,
): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const folder = chatFolder(conversation);
  addText(files, `${folder}/chat.md`, chatToMarkdown(conversation, options));
  if (options.includeArtifacts) addInlineArtifacts(files, artifacts, `${folder}/artifacts`);
  return zipSync(files, { level: 6 });
}

export function buildProjectZip(project: Project): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const folder = `projects/${safeName(project.name, 'project')}`;
  addText(files, `${folder}/_project.md`, projectToMarkdown(project));
  if (project.prompt_template) addText(files, `${folder}/_instructions.md`, project.prompt_template);
  for (const doc of project.docs) {
    addText(files, uniquePath(files, `${folder}/docs/${safeName(doc.filename, 'document')}`), doc.content);
  }
  return zipSync(files, { level: 6 });
}

function addFrameFiles(files: Record<string, Uint8Array>, frame: FrameArtifact): void {
  const root = `frames/${safeName(frame.id, 'artifact')}`;
  addText(
    files,
    `${root}/artifact.json`,
    JSON.stringify(
      {
        id: frame.id,
        kind: frame.kind,
        visibility: frame.visibility,
        active_version: frame.activeVersion,
        updated_at: frame.updatedAt,
        versions: frame.versions.map((version) => ({
          id: version.id,
          title: version.title,
          description: version.description,
          created_at: version.created_at,
        })),
      },
      null,
      2,
    ),
  );
  const latest = frame.versions[0];
  if (latest?.pageMd) addText(files, `${root}/page.md`, latest.pageMd);
  if (frame.comments) addText(files, `${root}/comments.json`, JSON.stringify(frame.comments, null, 2));
  if (frame.artifactComments) {
    addText(files, `${root}/artifact_comments.json`, JSON.stringify(frame.artifactComments, null, 2));
  }
  for (const version of frame.versions) {
    for (const file of version.files) {
      if (!file.data) continue;
      files[`${root}/versions/${safeName(version.id, 'version')}/${file.path}`] = file.data;
    }
    if (version.pageMd) {
      addText(files, `${root}/versions/${safeName(version.id, 'version')}/page.md`, version.pageMd);
    }
  }
}

export function buildArchiveZip(archive: Archive, options: ChatExportOptions = DEFAULT_CHAT_EXPORT_OPTIONS): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const root = `claude-archive-${dateStamp()}`;

  for (const conversation of archive.conversations) {
    const folder = `${root}/${chatFolder(conversation)}`;
    addText(files, `${folder}/chat.md`, chatToMarkdown(conversation, options));
    const artifacts = archive.inlineArtifacts.filter((artifact) => artifact.conversationUuid === conversation.uuid);
    if (options.includeArtifacts) addInlineArtifacts(files, artifacts, `${folder}/artifacts`);
  }

  for (const project of archive.projects) {
    const folder = `${root}/projects/${safeName(project.name, 'project')}`;
    addText(files, `${folder}/_project.md`, projectToMarkdown(project));
    if (project.prompt_template) addText(files, `${folder}/_instructions.md`, project.prompt_template);
    for (const doc of project.docs) {
      addText(files, uniquePath(files, `${folder}/docs/${safeName(doc.filename, 'document')}`), doc.content);
    }
  }

  for (const frame of archive.frames) addFrameFiles(files, frame);

  addText(files, `${root}/memory.md`, archive.memories.map((memory) => `# ${memory.path}\n\n${memory.content}\n`).join('\n'));
  addText(
    files,
    `${root}/account.json`,
    JSON.stringify({ users: archive.users, login_events: archive.loginEvents }, null, 2),
  );
  addText(files, `${root}/feedback.json`, JSON.stringify(archive.reflections, null, 2));

  for (const [key, data] of archive.rawFiles) {
    const path = key.replace(/^[^/]+\//, '');
    if (path.startsWith('conversations.json') || path.startsWith('projects/') || path.startsWith('memories/') || path.startsWith('reflections/') || path.startsWith('artifacts/')) {
      continue;
    }
    files[`${root}/raw/${safeName(key.replace(/[/:]/g, '_'), 'raw')}`] = data;
  }

  const index = [
    `# Архив Claude`,
    '',
    `Восстановлено: ${new Date().toLocaleString('ru-RU')}`,
    '',
    `- Чатов: ${archive.stats.conversations}`,
    `- Сообщений: ${archive.stats.messages}`,
    `- Проектов: ${archive.stats.projects}`,
    `- Frames-артефактов: ${archive.stats.frames}`,
    `- Артефактов из чатов: ${archive.stats.inlineArtifacts}`,
    `- Файлов памяти: ${archive.stats.memories}`,
    `- Каналов Claude Code Cloud: ${archive.stats.cloudChannels}`,
    '',
    '## Предупреждения',
    '',
    ...(archive.warnings.length ? archive.warnings.map((warning) => `- ${warning}`) : ['- Нет']),
    '',
  ].join('\n');
  addText(files, `${root}/_index.md`, index);
  addText(
    files,
    `${root}/_manifest.json`,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        stats: archive.stats,
        sources: archive.sources,
        warnings: archive.warnings,
      },
      null,
      2,
    ),
  );

  return zipSync(files, { level: 6 });
}
