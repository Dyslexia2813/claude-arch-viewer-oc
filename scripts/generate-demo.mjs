import { strToU8, zipSync } from 'fflate';
import { mkdirSync, writeFileSync } from 'node:fs';

const now = '2026-01-15T12:00:00Z';

function json(value) {
  return strToU8(JSON.stringify(value, null, 2));
}

const conversations = [
  {
    uuid: 'demo-conv-1',
    name: 'Добро пожаловать в Claude Arch Viewer',
    summary: 'Демонстрационный чат с артефактом и вложением.',
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-01-10T09:05:00Z',
    account: { uuid: 'demo-account' },
    chat_messages: [
      {
        uuid: 'demo-msg-1',
        text: 'Покажи, как выглядит артефакт и вложение.',
        content: [{ type: 'text', text: 'Покажи, как выглядит артефакт и вложение.' }],
        sender: 'human',
        created_at: '2026-01-10T09:00:00Z',
        updated_at: '2026-01-10T09:00:00Z',
        attachments: [
          {
            file_name: 'notes.md',
            file_size: 42,
            file_type: 'md',
            extracted_content: '# Заметка\n\nЭто текст вложения, извлечённый из архива.',
          },
        ],
        files: [],
        parent_message_uuid: null,
      },
      {
        uuid: 'demo-msg-2',
        text: 'Сейчас создам артефакт и покажу размышления.',
        content: [
          { type: 'thinking', thinking: 'Сначала создам markdown-артефакт, затем обновлю его.' },
          { type: 'text', text: 'Сейчас создам артефакт и покажу размышления.' },
          {
            type: 'tool_use',
            name: 'artifacts',
            input: {
              id: 'welcome-artifact',
              command: 'create',
              title: 'Демо-артефакт',
              type: 'text/markdown',
              language: 'markdown',
              content: '# Демо-артефакт\n\nЭто первая версия.',
              version_uuid: 'demo-version-1',
            },
            start_timestamp: '2026-01-10T09:01:00Z',
          },
        ],
        sender: 'assistant',
        created_at: '2026-01-10T09:01:00Z',
        updated_at: '2026-01-10T09:01:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: 'demo-msg-1',
      },
      {
        uuid: 'demo-msg-3',
        text: '',
        content: [
          {
            type: 'tool_use',
            name: 'artifacts',
            input: {
              id: 'welcome-artifact',
              command: 'update',
              old_str: 'Это первая версия.',
              new_str: 'Это вторая версия, восстановленная из патча `old_str` → `new_str`.',
              version_uuid: 'demo-version-2',
            },
            start_timestamp: '2026-01-10T09:02:00Z',
          },
          {
            type: 'tool_use',
            name: 'web_search',
            input: { query: 'Claude data export' },
            start_timestamp: '2026-01-10T09:02:30Z',
          },
          {
            type: 'tool_result',
            name: 'web_search',
            content: [{ type: 'text', text: 'Демонстрационный результат поиска. В реальном архиве здесь может быть много текста.' }],
            is_error: false,
          },
        ],
        sender: 'assistant',
        created_at: '2026-01-10T09:02:00Z',
        updated_at: '2026-01-10T09:02:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: 'demo-msg-2',
      },
    ],
  },
  {
    uuid: 'demo-conv-2',
    name: 'Ветвление и разные блоки',
    summary: 'Демонстрация веток, изображений и документов.',
    created_at: '2026-01-11T10:00:00Z',
    updated_at: '2026-01-11T10:04:00Z',
    account: { uuid: 'demo-account' },
    chat_messages: [
      {
        uuid: 'demo-msg-10',
        text: 'Сделай два варианта ответа.',
        content: [{ type: 'text', text: 'Сделай два варианта ответа.' }],
        sender: 'human',
        created_at: '2026-01-11T10:00:00Z',
        updated_at: '2026-01-11T10:00:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: null,
      },
      {
        uuid: 'demo-msg-11a',
        text: 'Вариант A.',
        content: [{ type: 'text', text: 'Вариант A.' }],
        sender: 'assistant',
        created_at: '2026-01-11T10:01:00Z',
        updated_at: '2026-01-11T10:01:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: 'demo-msg-10',
      },
      {
        uuid: 'demo-msg-11b',
        text: 'Вариант B.',
        content: [{ type: 'text', text: 'Вариант B.' }],
        sender: 'assistant',
        created_at: '2026-01-11T10:02:00Z',
        updated_at: '2026-01-11T10:02:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: 'demo-msg-10',
      },
      {
        uuid: 'demo-msg-12',
        text: 'Вот изображение и документ.',
        content: [
          { type: 'text', text: 'Вот изображение и документ.' },
          { type: 'image', file_uuid: 'demo-image-uuid' },
          { type: 'document', title: 'Демо-документ', file_uuid: 'demo-doc-uuid' },
          { type: 'injected_prompt_block', prompt: 'Системная вставка для демонстрации.' },
          { type: 'flag', flag: 'demo-flag' },
        ],
        sender: 'assistant',
        created_at: '2026-01-11T10:03:00Z',
        updated_at: '2026-01-11T10:03:00Z',
        attachments: [],
        files: [{ file_uuid: 'demo-file-uuid', file_name: 'report.pdf' }],
        parent_message_uuid: 'demo-msg-11b',
      },
    ],
  },
  {
    uuid: 'demo-conv-3',
    name: 'Проект и Claude Code Cloud',
    summary: 'Демонстрация проекта, памяти и облачных каналов.',
    created_at: '2026-01-12T11:00:00Z',
    updated_at: '2026-01-12T11:10:00Z',
    account: { uuid: 'demo-account' },
    chat_messages: [
      {
        uuid: 'demo-msg-20',
        text: 'Собери короткий отчёт.',
        content: [{ type: 'text', text: 'Собери короткий отчёт.' }],
        sender: 'human',
        created_at: '2026-01-12T11:00:00Z',
        updated_at: '2026-01-12T11:00:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: null,
      },
      {
        uuid: 'demo-msg-21',
        text: 'Готово. Отчёт сохранён в проект.',
        content: [{ type: 'text', text: 'Готово. Отчёт сохранён в проект.' }],
        sender: 'assistant',
        created_at: '2026-01-12T11:01:00Z',
        updated_at: '2026-01-12T11:01:00Z',
        attachments: [],
        files: [],
        parent_message_uuid: 'demo-msg-20',
      },
    ],
  },
];

const project = {
  uuid: 'demo-project',
  name: 'Демо-проект',
  description: 'Проект с инструкциями и документами для проверки просмотрщика.',
  is_private: true,
  is_starter_project: false,
  prompt_template: 'Отвечай кратко и по делу.',
  created_at: '2026-01-05T08:00:00Z',
  updated_at: '2026-01-12T11:00:00Z',
  creator: { uuid: 'demo-account', full_name: 'Demo User' },
  docs: [
    {
      uuid: 'demo-doc-1',
      filename: 'brief.md',
      content: '# Бриф\n\nКраткое описание демо-проекта.',
      created_at: '2026-01-05T08:00:00Z',
    },
    {
      uuid: 'demo-doc-2',
      filename: 'checklist.md',
      content: '# Чек-лист\n\n- [x] Импорт\n- [x] Просмотр\n- [ ] Экспорт в Obsidian',
      created_at: '2026-01-06T08:00:00Z',
    },
  ],
};

const frames = {
  'artifacts/demo-page/artifact.json': json({
    id: 'demo-page',
    kind: 'page',
    visibility: 'private',
    versions: [
      {
        id: 'page-v1',
        title: 'Демо-страница',
        description: 'Страница из Frames с markdown-содержимым.',
        created_at: '2026-01-13T12:00:00Z',
      },
    ],
    owner_account: 'demo-account',
    updated_at: '2026-01-13T12:00:00Z',
    active_version: 'page-v1',
  }),
  'artifacts/demo-page/page.md': strToU8(
    '# Демо-страница\n\nЭто содержимое артефакта типа `page`.\n\n| Поле | Значение |\n| --- | --- |\n| Источник | Frames |\n| Версия | page-v1 |\n',
  ),
  'artifacts/demo-page/comments.json': json([]),
  'artifacts/demo-app/artifact.json': json({
    id: 'demo-app',
    kind: 'artifact',
    visibility: 'private',
    versions: [
      {
        id: 'app-v1',
        title: 'Демо-приложение',
        description: 'HTML-артефакт с файлами и превью.',
        created_at: '2026-01-14T12:00:00Z',
      },
    ],
    owner_account: 'demo-account',
    updated_at: '2026-01-14T12:00:00Z',
    active_version: 'app-v1',
  }),
  'artifacts/demo-app/versions/app-v1/index.html': strToU8(
    '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Демо-артефакт</h1><p>Это HTML-превью из Frames.</p><button id="b">Нажми меня</button><script src="app.js"></script></body></html>',
  ),
  'artifacts/demo-app/versions/app-v1/style.css': strToU8(
    'body{font-family:system-ui,sans-serif;background:#10151f;color:#e6edf7;padding:32px}h1{color:#d97757}button{padding:8px 14px;border-radius:8px;border:0;background:#d97757;color:#fff}',
  ),
  'artifacts/demo-app/versions/app-v1/app.js': strToU8(
    'document.getElementById("b").addEventListener("click",()=>{alert("Превью работает")});',
  ),
  'artifacts/demo-app/versions/app-v1.files.json': json({
    files: [
      { original_path: 'index.html', exported_as: 'index.html', size_bytes: 228, mime_type: 'text/html' },
      { original_path: 'style.css', exported_as: 'style.css', size_bytes: 169, mime_type: 'text/css' },
      { original_path: 'app.js', exported_as: 'app.js', size_bytes: 91, mime_type: 'text/javascript' },
    ],
  }),
};

const cloud = {
  'claude_code_cloud/channels/channels.json': json({
    claude_code_cloud: [
      {
        channel_id: 'demo-channel',
        content: { name: 'Демо-канал', topic: 'Обсуждение демо-архива' },
        visibility: 'private',
        memory_enabled: true,
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      },
    ],
  }),
  'claude_code_cloud/channels/memberships.json': json({
    claude_code_cloud: [
      { channel_id: 'demo-channel', account_uuid: 'demo-account', role: 'owner', joined_at: '2026-01-15T10:00:00Z', left_at: null },
    ],
  }),
  'claude_code_cloud/channels/messages.json': json({
    claude_code_cloud: [
      {
        message_id: 'demo-cloud-msg-1',
        channel_id: 'demo-channel',
        text: 'Привет из Claude Code Cloud!',
        body_format: 'text',
        created_at: '2026-01-15T10:01:00Z',
        attachments: [],
        mentions: [],
        reactions: [],
      },
      {
        message_id: 'demo-cloud-msg-2',
        channel_id: 'demo-channel',
        text: 'Это сообщение демонстрирует облачный канал.',
        body_format: 'text',
        created_at: '2026-01-15T10:02:00Z',
        attachments: [],
        mentions: [],
        reactions: [],
      },
    ],
  }),
  'claude_code_cloud/agents.json': json({
    claude_code_cloud: [{ agent_id: 'demo-agent', name: 'Демо-агент', description: 'Агент для демонстрации.' }],
  }),
  'claude_code_cloud/routines.json': json({
    claude_code_cloud: [
      {
        routine_id: 'demo-routine',
        name: 'Демо-рутина',
        prompt: 'Собери короткий отчёт.',
        enabled: true,
        schedule: { cron: '0 9 * * *', run_once_at: null },
        created_at: '2026-01-15T10:00:00Z',
      },
    ],
  }),
  'claude_code_cloud/routine_runs.json': json({
    claude_code_cloud: [
      { routine_id: 'demo-routine', scheduled_for: '2026-01-15T09:00:00Z', status: 'success', session_id: 'demo-session' },
    ],
  }),
  'claude_code_cloud/project_files.json': json({
    claude_code_cloud: [
      { project_id: 'demo-project', path: 'brief.md', folder: false, size_bytes: 42, saved_at: '2026-01-15T10:00:00Z' },
    ],
  }),
  'claude_code_cloud/channel_memory_files.json': json({
    claude_code_cloud: [
      { account_uuid: 'demo-account', channel: 'demo-channel', path: 'memory.md', content: 'Память демо-канала.', created_at: '2026-01-15T10:00:00Z', updated_at: '2026-01-15T10:00:00Z' },
    ],
  }),
  'claude_code_cloud/channel_session_transcripts.json': json({
    claude_code_cloud: [
      {
        session_id: 'demo-session',
        created_at: '2026-01-15T10:05:00Z',
        role: 'user',
        content: [{ type: 'text', text: 'Сделай отчёт.' }],
        part: 0,
        parts: 2,
      },
      {
        session_id: 'demo-session',
        created_at: '2026-01-15T10:06:00Z',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Готово.' },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
        ],
        part: 1,
        parts: 2,
      },
    ],
  }),
};

const files = {
  'conversations.json': json(conversations),
  'projects/demo-project.json': json(project),
  'memories/demo-account.json': json({
    account_uuid: 'demo-account',
    memory_files: [
      { path: 'account.md', content: '# Память аккаунта\n\nДемонстрационная запись.', updated_at: now },
      { path: 'projects/demo.md', content: '# Память проекта\n\nЕщё одна запись.', updated_at: now },
    ],
  }),
  'reflections/demo-account.json': json({
    account_uuid: 'demo-account',
    reflections: [
      {
        period: '2026-01',
        content: {
          hero_title: 'Демо-рефлексия',
          hero_body: 'Это пример отчёта feedback из архива Claude.',
          topics: ['архив', 'артефакты', 'поиск'],
          stats: [{ label: 'Чатов', value: 3 }],
        },
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
      },
    ],
    feedback: [],
  }),
  'users.json': json([
    { uuid: 'demo-account', full_name: 'Demo User', email_address: 'demo@example.com', verified_phone_number: '' },
  ]),
  'login_history.json': json({
    login_events: [
      {
        account_uuid: 'demo-account',
        timestamp: '2026-01-15T09:00:00Z',
        ip_address: '203.0.113.10',
        user_agent: { browser_family: 'Chrome', browser_version: '130', os_family: 'Linux', os_version: '24.04', device_family: 'desktop' },
        method: 'password',
        location_info: { country: 'Demo', region: null, city: null },
      },
      {
        account_uuid: 'demo-account',
        timestamp: '2026-01-14T09:00:00Z',
        ip_address: '203.0.113.10',
        user_agent: { browser_family: 'Firefox', browser_version: '128', os_family: 'Linux', os_version: '24.04', device_family: 'desktop' },
        method: 'password',
        location_info: { country: 'Demo', region: null, city: null },
      },
    ],
  }),
  ...frames,
  ...cloud,
};

mkdirSync('public/demo', { recursive: true });
writeFileSync('public/demo/demo-export.zip', zipSync(files, { level: 9 }));
console.log('Демо-архив создан: public/demo/demo-export.zip');
