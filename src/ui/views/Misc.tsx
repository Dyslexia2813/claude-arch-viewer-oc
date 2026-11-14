import type { ComponentChildren } from 'preact';
import type { LoginEvent, MemoryFile, Reflection, User } from '../../core/types';
import { countLabel, downloadText, fmtDate, fmtSize, safeName, truncate } from '../../core/utils';
import { searchArchive, type SimpleHit } from '../../core/search';
import {
  archive,
  fileQuery,
  globalQuery,
  go,
  includeToolResults,
  openConversation,
  openFrame,
  openProject,
  selectedCloudChannel,
  selectedFile,
  selectedMemory,
} from '../state';
import { BackButton, Badge, CodeBlock, Collapsible, EmptyState, Icon, Markdown, SearchInput } from '../components';
import { downloadRawFile } from '../actions';

export function MemoryView() {
  const a = archive.value;
  if (!a) return null;

  if (selectedMemory.value) {
    const memory = a.memories.find((item) => item.path === selectedMemory.value);
    if (memory) {
      return (
        <div class="view detail-view">
          <div class="detail-heading">
            <BackButton onClick={() => { selectedMemory.value = null; }} label="К памяти" />
            <div class="detail-actions">
              <button
                type="button"
                class="button button-small"
                onClick={() => downloadText(memory.content, `${safeName(memory.path, 'memory')}.md`, 'text/markdown;charset=utf-8')}
              >
                <Icon name="download" size={14} /> MD
              </button>
            </div>
          </div>
          <header class="detail-header">
            <div>
              <h1 class="mono">{memory.path}</h1>
              <div class="chat-meta">{memory.updated_at ? <span>Обновлено {fmtDate(memory.updated_at, true)}</span> : null}</div>
            </div>
          </header>
          <section class="panel"><Markdown text={memory.content} /></section>
        </div>
      );
    }
  }

  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Память</h1>
          <p class="muted">{countLabel(a.memories.length, ['файл', 'файла', 'файлов'])} памяти Claude</p>
        </div>
      </div>
      {a.memories.length === 0 ? (
        <EmptyState title="Память не найдена" text="Загрузите memories-000.zip." icon="memory" />
      ) : (
        <div class="panel-list">
          {a.memories.map((memory) => (
            <button type="button" class="list-item" key={memory.path} onClick={() => { selectedMemory.value = memory.path; }}>
              <span class="list-item-icon"><Icon name="memory" size={18} /></span>
              <span class="list-item-main">
                <strong class="mono">{memory.path}</strong>
                <span class="muted small">{truncate(memory.content.replace(/\s+/g, ' '), 160)}</span>
              </span>
              <span class="muted small">{memory.updated_at ? fmtDate(memory.updated_at) : ''}</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function renderReflectionValue(value: unknown): ComponentChildren {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return <Markdown text={value} />;
  if (typeof value === 'number' || typeof value === 'boolean') return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((item, index) => (
          <li key={index}>{typeof item === 'object' ? <pre class="inline-json">{JSON.stringify(item, null, 2)}</pre> : String(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <dl class="kv-list">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{renderReflectionValue(item)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

function ReflectionCard({ reflection }: { reflection: Reflection }) {
  const content = reflection.content;
  const heroTitle = typeof content.hero_title === 'string' ? content.hero_title : reflection.period;
  const heroBody = typeof content.hero_body === 'string' ? content.hero_body : '';
  return (
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>{heroTitle}</h2>
          <p class="muted small">{reflection.period} · {fmtDate(reflection.created_at, true)}</p>
        </div>
      </div>
      {heroBody ? <Markdown text={heroBody} /> : null}
      {Object.entries(content)
        .filter(([key]) => !['hero_title', 'hero_body', 'period'].includes(key))
        .map(([key, value]) => (
          <Collapsible key={key} summary={<strong>{key}</strong>}>
            {renderReflectionValue(value)}
          </Collapsible>
        ))}
      <Collapsible summary={<span class="muted small">Raw JSON</span>}>
        <CodeBlock value={reflection} />
      </Collapsible>
    </section>
  );
}

export function FeedbackView() {
  const a = archive.value;
  if (!a) return null;
  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Рефлексии</h1>
          <p class="muted">{countLabel(a.reflections.length, ['рефлексия', 'рефлексии', 'рефлексий'])}</p>
        </div>
      </div>
      {a.reflections.length === 0 ? (
        <EmptyState title="Рефлексий нет" text="Загрузите feedback-000.zip." icon="feedback" />
      ) : (
        <div class="panel-list">
          {a.reflections.map((reflection) => <ReflectionCard reflection={reflection} key={reflection.period} />)}
        </div>
      )}
    </div>
  );
}

export function AccountView() {
  const a = archive.value;
  if (!a) return null;
  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Аккаунт</h1>
          <p class="muted">{a.users.length ? a.users[0].email_address : 'Пользователь не найден'}</p>
        </div>
      </div>

      <section class="panel">
        <div class="panel-heading"><h2>Пользователи</h2></div>
        {a.users.length === 0 ? <p class="muted">Загрузите light_metadata-000.zip.</p> : (
          <div class="user-grid">
            {a.users.map((user) => (
              <div class="user-card" key={user.uuid}>
                <div class="avatar avatar-human">{user.full_name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{user.full_name}</strong>
                  <div class="muted small">{user.email_address}</div>
                  <div class="muted small mono">{user.uuid}</div>
                  {user.verified_phone_number ? <div class="muted small">{user.verified_phone_number}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>История входов</h2>
          <Badge tone="muted">{a.loginEvents.length}</Badge>
        </div>
        {a.loginEvents.length === 0 ? <p class="muted">История входов не найдена.</p> : (
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Дата</th><th>Метод</th><th>Браузер / ОС</th><th>Страна</th><th>IP</th></tr>
              </thead>
              <tbody>
                {a.loginEvents.map((event: LoginEvent) => (
                  <tr key={`${event.timestamp}:${event.ip_address}`}>
                    <td>{fmtDate(event.timestamp, true)}</td>
                    <td>{event.method}</td>
                    <td>{event.user_agent.browser_family} {event.user_agent.browser_version} · {event.user_agent.os_family}</td>
                    <td>{event.location_info.country || '—'}</td>
                    <td class="mono">{event.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function FilesView() {
  const a = archive.value;
  if (!a) return null;

  if (selectedFile.value) {
    const entry = a.files.find((file) => `${file.sourceId}/${file.path}` === selectedFile.value);
    if (entry) {
      return (
        <div class="view detail-view">
          <div class="detail-heading">
            <BackButton onClick={() => { selectedFile.value = null; }} label="К файлам" />
            <div class="detail-actions">
              <button type="button" class="button button-small" onClick={() => downloadRawFile(entry)}>
                <Icon name="download" size={14} /> Скачать
              </button>
            </div>
          </div>
          <header class="detail-header">
            <div>
              <h1 class="mono">{entry.path}</h1>
              <div class="chat-meta">
                <span>{fmtSize(entry.size)}</span>
                <span>·</span>
                <span>{entry.category}</span>
                <span>·</span>
                <span>{entry.source}</span>
                {!entry.isText ? <Badge tone="muted">бинарный</Badge> : null}
              </div>
            </div>
          </header>
          <section class="panel">
            {entry.text ? <pre class="raw-json">{entry.text}</pre> : <p class="muted">Бинарный файл. Скачайте его, чтобы открыть.</p>}
          </section>
        </div>
      );
    }
  }

  const q = fileQuery.value.trim().toLowerCase();
  const files = q
    ? a.files.filter((file) => `${file.path} ${file.category} ${file.source}`.toLowerCase().includes(q))
    : a.files;

  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Файлы</h1>
          <p class="muted">{countLabel(a.files.length, ['файл', 'файла', 'файлов'])} · {fmtSize(a.stats.totalBytes)}</p>
        </div>
      </div>
      <div class="toolbar">
        <SearchInput value={fileQuery.value} onInput={(value) => { fileQuery.value = value; }} placeholder="Поиск по пути, категории или источнику…" />
      </div>
      <div class="table-wrap">
        <table class="data-table files-table">
          <thead>
            <tr><th>Путь</th><th>Категория</th><th>Размер</th><th>Источник</th><th /></tr>
          </thead>
          <tbody>
            {files.slice(0, 1000).map((file) => (
              <tr key={`${file.sourceId}/${file.path}`}>
                <td class="mono path-cell">
                  <button type="button" class="link-button inline" onClick={() => { selectedFile.value = `${file.sourceId}/${file.path}`; }}>
                    {file.path}
                  </button>
                </td>
                <td><Badge tone="muted">{file.category}</Badge></td>
                <td>{fmtSize(file.size)}</td>
                <td class="muted small">{file.source}</td>
                <td><button type="button" class="icon-button" onClick={() => downloadRawFile(file)} title="Скачать"><Icon name="download" size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {files.length > 1000 ? <p class="muted small">Показаны первые 1000 из {files.length} файлов. Уточните поиск.</p> : null}
    </div>
  );
}

export function DiagnosticsView() {
  const a = archive.value;
  if (!a) return null;
  const unknown = a.files.filter((file) => file.category === 'unknown');
  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Диагностика</h1>
          <p class="muted">Полнота восстановления и предупреждения</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">{a.stats.conversations}</div><div class="stat-label">Чатов</div></div>
        <div class="stat-card"><div class="stat-value">{a.stats.messages}</div><div class="stat-label">Сообщений</div></div>
        <div class="stat-card"><div class="stat-value">{a.stats.files}</div><div class="stat-label">Файлов</div></div>
        <div class="stat-card"><div class="stat-value">{fmtSize(a.stats.totalBytes)}</div><div class="stat-label">Распаковано</div></div>
        <div class="stat-card"><div class="stat-value">{a.stats.missingFiles}</div><div class="stat-label">Ссылок без бинарника</div></div>
        <div class="stat-card"><div class="stat-value">{unknown.length}</div><div class="stat-label">Неизвестных файлов</div></div>
      </div>

      <section class="panel">
        <div class="panel-heading"><h2>Источники</h2></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Файл</th><th>Категория</th><th>Записей</th><th>Размер</th><th>Импортирован</th></tr></thead>
            <tbody>
              {a.sources.map((source) => (
                <tr key={source.id}>
                  <td class="mono">{source.filename}</td>
                  <td><Badge tone="muted">{source.category}</Badge></td>
                  <td>{source.entries}</td>
                  <td>{fmtSize(source.size)}</td>
                  <td>{fmtDate(source.importedAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading"><h2>Типы блоков</h2></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Тип</th><th>Количество</th></tr></thead>
            <tbody>
              {Object.entries(a.stats.blockCounts).sort((x, y) => y[1] - x[1]).map(([type, count]) => (
                <tr key={type}><td class="mono">{type}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading"><h2>Предупреждения</h2><Badge tone={a.warnings.length ? 'warning' : 'ok'}>{a.warnings.length}</Badge></div>
        {a.warnings.length === 0 ? <p class="muted">Предупреждений нет.</p> : (
          <ul class="warning-list">{a.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        )}
      </section>

      <section class="panel">
        <div class="panel-heading"><h2>Неизвестные файлы</h2><Badge tone="muted">{unknown.length}</Badge></div>
        {unknown.length === 0 ? <p class="muted">Неизвестных файлов нет.</p> : (
          <ul class="file-list">
            {unknown.map((file) => (
              <li key={`${file.sourceId}/${file.path}`}>
                <Icon name="file" size={15} />
                <span class="mono">{file.path}</span>
                <span class="muted small">{fmtSize(file.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

const KIND_LABELS: Record<SimpleHit['kind'], string> = {
  conversation: 'Чат',
  project: 'Проект',
  frame: 'Frames',
  memory: 'Память',
  cloud: 'Cloud',
};

function openHit(hit: SimpleHit): void {
  if (hit.kind === 'conversation') openConversation(hit.id);
  else if (hit.kind === 'project') openProject(hit.id);
  else if (hit.kind === 'frame') openFrame(hit.id);
  else if (hit.kind === 'memory') {
    go('memory');
    selectedMemory.value = hit.id;
  } else if (hit.kind === 'cloud') {
    const message = archive.value?.cloud.messages.find((item) => item.message_id === hit.id);
    go('cloud');
    if (message) selectedCloudChannel.value = message.channel_id;
  }
}

export function SearchView() {
  const a = archive.value;
  if (!a) return null;
  const results = globalQuery.value.trim()
    ? searchArchive(a, globalQuery.value, includeToolResults.value)
    : [];
  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Поиск по архиву</h1>
          <p class="muted">Чаты, проекты, артефакты, память и Claude Code Cloud</p>
        </div>
      </div>
      <div class="toolbar">
        <SearchInput value={globalQuery.value} onInput={(value) => { globalQuery.value = value; }} placeholder="Что найти?" />
        <label class="checkbox">
          <input
            type="checkbox"
            checked={includeToolResults.value}
            onChange={(event) => { includeToolResults.value = (event.currentTarget as HTMLInputElement).checked; }}
          />
          Искать в результатах инструментов
        </label>
      </div>
      {globalQuery.value.trim() && results.length === 0 ? (
        <EmptyState title="Ничего не найдено" text="Попробуйте другой запрос." icon="search" />
      ) : (
        <div class="search-results">
          {results.map((hit) => (
            <button type="button" class="search-hit" key={`${hit.kind}:${hit.id}`} onClick={() => openHit(hit)}>
              <Badge tone="muted">{KIND_LABELS[hit.kind]}</Badge>
              <span class="search-hit-main">
                <strong><Highlight text={hit.title} query={globalQuery.value} /></strong>
                <span class="muted small"><Highlight text={hit.snippet} query={globalQuery.value} /></span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
