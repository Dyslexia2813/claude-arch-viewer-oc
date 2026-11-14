import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import type { Conversation, Manifest } from '../src/core/types';
import { reconstructInlineArtifacts, artifactExtension } from '../src/core/artifacts';
import { buildArchiveZip, chatToMarkdown, projectToMarkdown } from '../src/core/export';
import { importFiles } from '../src/core/importer';
import { isManifest, parseManifest } from '../src/core/manifest';
import { searchConversations } from '../src/core/search';
import { dateStamp } from '../src/core/utils';

function conversationWithArtifact(): Conversation {
  return {
    uuid: 'conv-1',
    name: 'Тестовый чат',
    summary: 'Краткое описание',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:05:00Z',
    account: { uuid: 'acc-1' },
    chat_messages: [
      {
        uuid: 'm1',
        text: 'Сделай артефакт',
        content: [
          { type: 'text', text: 'Сделай артефакт' },
          {
            type: 'tool_use',
            name: 'artifacts',
            input: {
              id: 'demo',
              command: 'create',
              title: 'Demo',
              type: 'text/markdown',
              language: 'markdown',
              content: 'hello',
              version_uuid: 'v1',
            },
            start_timestamp: '2026-01-01T10:01:00Z',
          },
        ],
        sender: 'assistant',
        created_at: '2026-01-01T10:01:00Z',
        updated_at: '2026-01-01T10:01:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: null,
      },
      {
        uuid: 'm2',
        text: '',
        content: [
          {
            type: 'tool_use',
            name: 'artifacts',
            input: {
              id: 'demo',
              command: 'update',
              old_str: 'hello',
              new_str: 'hello world',
              version_uuid: 'v2',
            },
            start_timestamp: '2026-01-01T10:02:00Z',
          },
        ],
        sender: 'assistant',
        created_at: '2026-01-01T10:02:00Z',
        updated_at: '2026-01-01T10:02:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: 'm1',
      },
    ],
  };
}

describe('артефакты из чатов', () => {
  it('применяет create и update по old_str/new_str', () => {
    const artifacts = reconstructInlineArtifacts([conversationWithArtifact()]);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].title).toBe('Demo');
    expect(artifacts[0].content).toBe('hello world');
    expect(artifacts[0].versions).toHaveLength(2);
    expect(artifacts[0].versions[1].version_uuid).toBe('v2');
  });

  it('помечает ошибку, если old_str не найден', () => {
    const conversation = conversationWithArtifact();
    conversation.chat_messages[1].content[0] = {
      type: 'tool_use',
      name: 'artifacts',
      input: { id: 'demo', command: 'update', old_str: 'nope', new_str: 'x', version_uuid: 'v3' },
    };
    const artifacts = reconstructInlineArtifacts([conversation]);
    expect(artifacts[0].content).toBe('hello');
    expect(artifacts[0].error).toContain('old_str');
  });

  it('определяет расширение по типу и языку', () => {
    expect(artifactExtension('text/markdown')).toBe('md');
    expect(artifactExtension('application/vnd.ant.react')).toBe('jsx');
    expect(artifactExtension(undefined, 'python')).toBe('py');
    expect(artifactExtension(undefined, undefined)).toBe('txt');
  });
});

describe('manifest', () => {
  const manifest: Manifest = {
    version: '1.0',
    created_at: '2026-01-01T00:00:00Z',
    total_files: 1,
    data_files: [
      {
        batch_index: 0,
        export_url: 'https://example.invalid/export',
        category: 'conversations',
        part: 0,
        filename: 'conversations-000.zip',
      },
    ],
  };

  it('распознаёт и разбирает manifest', () => {
    expect(isManifest(manifest)).toBe(true);
    expect(parseManifest(manifest).data_files[0].filename).toBe('conversations-000.zip');
  });

  it('отклоняет посторонний JSON', () => {
    expect(isManifest({ hello: 'world' })).toBe(false);
    expect(() => parseManifest({ hello: 'world' })).toThrow();
  });
});

describe('импорт синтетического архива', () => {
  it('собирает все категории и экспортирует дерево', async () => {
    const conversation = conversationWithArtifact();
    const zip = zipSync({
      'conversations.json': strToU8(JSON.stringify([conversation])),
      'projects/p1.json': strToU8(
        JSON.stringify({
          uuid: 'p1',
          name: 'Проект',
          description: 'Описание',
          is_private: true,
          is_starter_project: false,
          prompt_template: 'Инструкции',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          creator: { uuid: 'acc-1', full_name: 'Тест' },
          docs: [{ uuid: 'd1', filename: 'doc.md', content: '# Документ', created_at: '2026-01-01T00:00:00Z' }],
        }),
      ),
      'memories/m1.json': strToU8(
        JSON.stringify({ account_uuid: 'acc-1', memory_files: [{ path: 'memory.md', content: '# Память', updated_at: '2026-01-01T00:00:00Z' }] }),
      ),
      'reflections/r1.json': strToU8(
        JSON.stringify({
          account_uuid: 'acc-1',
          reflections: [{ period: '2026-01', content: { hero_title: 'Итоги', hero_body: 'Тело' }, created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' }],
          feedback: [],
        }),
      ),
      'users.json': strToU8(JSON.stringify([{ uuid: 'acc-1', full_name: 'Тест', email_address: 'test@example.com', verified_phone_number: '' }])),
      'login_history.json': strToU8(
        JSON.stringify({ login_events: [{ account_uuid: 'acc-1', timestamp: '2026-01-01T00:00:00Z', ip_address: '127.0.0.1', user_agent: { browser_family: 'Chrome', browser_version: '1', os_family: 'Linux', os_version: '1', device_family: 'desktop' }, method: 'password', location_info: { country: 'RU', region: null, city: null } }] }),
      ),
      'artifacts/a1/artifact.json': strToU8(
        JSON.stringify({
          id: 'a1',
          kind: 'page',
          visibility: 'private',
          versions: [{ id: 'v1', title: 'Страница', description: 'Описание', created_at: '2026-01-01T00:00:00Z' }],
          active_version: 'v1',
          updated_at: '2026-01-01T00:00:00Z',
        }),
      ),
      'artifacts/a1/page.md': strToU8('# Страница\n\nТекст'),
      'artifacts/a1/versions/v1/index.html': strToU8('<html><body>ok</body></html>'),
      'artifacts/a1/versions/v1.files.json': strToU8(
        JSON.stringify({ files: [{ original_path: 'index.html', exported_as: 'index.html', size_bytes: 26, mime_type: 'text/html' }] }),
      ),
      'claude_code_cloud/channels/channels.json': strToU8(
        JSON.stringify({ claude_code_cloud: [{ channel_id: 'ch1', content: { name: 'Канал' }, created_at: '2026-01-01T00:00:00Z' }] }),
      ),
      'claude_code_cloud/channels/messages.json': strToU8(
        JSON.stringify({ claude_code_cloud: [{ message_id: 'msg1', channel_id: 'ch1', text: 'Привет', created_at: '2026-01-01T00:00:00Z' }] }),
      ),
      'claude_code_cloud/agents.json': strToU8(JSON.stringify({ claude_code_cloud: [{ agent_id: 'ag1', name: 'Агент' }] })),
      'claude_code_cloud/routines.json': strToU8(JSON.stringify({ claude_code_cloud: [] })),
      'claude_code_cloud/routine_runs.json': strToU8(JSON.stringify({ claude_code_cloud: [] })),
      'claude_code_cloud/project_files.json': strToU8(JSON.stringify({ claude_code_cloud: [] })),
      'claude_code_cloud/channel_memory_files.json': strToU8(JSON.stringify({ claude_code_cloud: [] })),
      'claude_code_cloud/channel_session_transcripts.json': strToU8(JSON.stringify({ claude_code_cloud: [] })),
    });

    const archive = await importFiles([new File([zip], 'archive.zip')]);

    expect(archive.stats.conversations).toBe(1);
    expect(archive.stats.messages).toBe(2);
    expect(archive.stats.projects).toBe(1);
    expect(archive.stats.frames).toBe(1);
    expect(archive.stats.inlineArtifacts).toBe(1);
    expect(archive.stats.memories).toBe(1);
    expect(archive.stats.reflections).toBe(1);
    expect(archive.stats.cloudChannels).toBe(1);
    expect(archive.stats.cloudMessages).toBe(1);
    expect(archive.warnings).toEqual([]);

    const exported = unzipSync(buildArchiveZip(archive));
    const paths = Object.keys(exported);
    expect(paths).toContain(`claude-archive-${dateStamp()}/_index.md`);
    expect(paths.some((path) => path.endsWith('/chat.md'))).toBe(true);
    expect(paths.some((path) => path.endsWith('/_project.md'))).toBe(true);
    expect(paths.some((path) => path.endsWith('/memory.md'))).toBe(true);
  });

  it('формирует читаемый Markdown', () => {
    const markdown = chatToMarkdown(conversationWithArtifact());
    expect(markdown).toContain('title: "Тестовый чат"');
    expect(markdown).toContain('# Тестовый чат');
    expect(markdown).toContain('## Assistant');
    expect(markdown).toContain('Артефакт: Demo');
  });

  it('формирует Markdown проекта', () => {
    const markdown = projectToMarkdown({
      uuid: 'p1',
      name: 'Проект',
      description: 'Описание',
      is_private: true,
      is_starter_project: false,
      prompt_template: 'Инструкции',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      creator: { uuid: 'acc-1', full_name: 'Тест' },
      docs: [],
    });
    expect(markdown).toContain('# Проект');
    expect(markdown).toContain('## Инструкции проекта');
  });
});

describe('поиск', () => {
  it('ищет по тексту и не индексирует tool_result по умолчанию', () => {
    const conversation = conversationWithArtifact();
    conversation.chat_messages[0].content.push({
      type: 'tool_result',
      content: [{ type: 'text', text: 'секретное слово' }],
    });
    expect(searchConversations([conversation], 'артефакт')).toHaveLength(1);
    expect(searchConversations([conversation], 'секретное')).toHaveLength(0);
    expect(searchConversations([conversation], 'секретное', true)).toHaveLength(1);
  });
});
