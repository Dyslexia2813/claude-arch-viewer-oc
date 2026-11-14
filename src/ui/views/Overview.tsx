import { categoryLabel, manifestExpiresAt } from '../../core/manifest';
import { countLabel, fmtDate, fmtSize } from '../../core/utils';
import { archive, go, openConversation, openFrame, openInlineArtifact } from '../state';
import { Badge, EmptyState, Icon, StatCard } from '../components';
import { exportArchiveZip } from '../actions';

export function Overview() {
  const a = archive.value;
  if (!a) return null;

  const loadedFilenames = new Set(a.sources.map((source) => source.filename.toLowerCase()));
  const manifestFiles = a.manifest?.data_files ?? [];
  const totalCategories = manifestFiles.length || a.sources.length;
  const loadedCategories = manifestFiles.length
    ? manifestFiles.filter((file) => loadedFilenames.has(file.filename.toLowerCase())).length
    : a.sources.length;
  const expires = a.manifest ? manifestExpiresAt(a.manifest) : null;
  const blockEntries = Object.entries(a.stats.blockCounts).sort((x, y) => y[1] - x[1]);
  const maxBlock = Math.max(1, ...blockEntries.map(([, count]) => count));
  const recent = a.conversations.slice(0, 6);
  const frames = a.frames.slice(0, 6);
  const inline = a.inlineArtifacts.slice(0, 6);

  return (
    <div class="view overview">
      <div class="view-heading">
        <div>
          <h1>Обзор архива</h1>
          <p class="muted">
            {a.manifest ? `Manifest от ${fmtDate(a.manifest.created_at, true)}` : 'Импорт без manifest'}
            {expires ? ` · ссылки ${expires.getTime() < Date.now() ? 'истекли' : `до ${fmtDate(expires.toISOString(), true)}`}` : ''}
          </p>
        </div>
        <button type="button" class="button button-primary" onClick={exportArchiveZip}>
          <Icon name="download" size={16} /> Экспорт всего архива
        </button>
      </div>

      <div class="stats-grid">
        <StatCard label="Чаты" value={a.stats.conversations} hint={countLabel(a.stats.messages, ['сообщение', 'сообщения', 'сообщений'])} />
        <StatCard label="Frames" value={a.stats.frames} hint={countLabel(a.stats.frameVersions, ['версия', 'версии', 'версий'])} />
        <StatCard label="Артефакты из чатов" value={a.stats.inlineArtifacts} hint="восстановлены из патчей" />
        <StatCard label="Проекты" value={a.stats.projects} hint={countLabel(a.projects.reduce((sum, project) => sum + project.docs.length, 0), ['документ', 'документа', 'документов'])} />
        <StatCard label="Claude Code Cloud" value={a.stats.cloudMessages} hint={`${countLabel(a.stats.cloudChannels, ['канал', 'канала', 'каналов'])} · ${countLabel(a.stats.cloudTranscripts, ['запись', 'записи', 'записей'])}`} />
        <StatCard label="Память" value={a.stats.memories} hint={countLabel(a.stats.reflections, ['рефлексия', 'рефлексии', 'рефлексий'])} />
        <StatCard label="Файлы в архиве" value={a.stats.files} hint={fmtSize(a.stats.totalBytes)} />
        <StatCard label="Нет бинарников" value={a.stats.missingFiles} hint="ссылки без содержимого" />
      </div>

      <div class="overview-columns">
        <section class="panel">
          <div class="panel-heading">
            <h2>Покрытие категорий</h2>
            <Badge tone={loadedCategories === totalCategories ? 'ok' : 'warning'}>
              {loadedCategories} / {totalCategories}
            </Badge>
          </div>
          {manifestFiles.length > 0 ? (
            <ul class="coverage-list">
              {manifestFiles.map((file) => {
                const loaded = loadedFilenames.has(file.filename.toLowerCase());
                return (
                  <li key={`${file.category}:${file.part}:${file.filename}`}>
                    <span class={`status-dot ${loaded ? 'ok' : 'missing'}`} />
                    <span class="coverage-name">{categoryLabel(file.category)}</span>
                    <span class="mono muted small">{file.filename}</span>
                    <Badge tone={loaded ? 'ok' : 'muted'}>{loaded ? 'загружен' : 'нет'}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul class="coverage-list">
              {a.sources.map((source) => (
                <li key={source.id}>
                  <span class="status-dot ok" />
                  <span class="coverage-name">{categoryLabel(source.category)}</span>
                  <span class="mono muted small">{source.filename}</span>
                  <Badge tone="ok">{fmtSize(source.size)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="panel">
          <div class="panel-heading">
            <h2>Типы блоков</h2>
            <span class="muted small">{blockEntries.length} типов</span>
          </div>
          <ul class="bar-list">
            {blockEntries.map(([type, count]) => (
              <li key={type}>
                <span class="bar-label">{type}</span>
                <span class="bar-track"><span class="bar-fill" style={{ width: `${(count / maxBlock) * 100}%` }} /></span>
                <span class="bar-count">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section class="panel">
        <div class="panel-heading">
          <h2>Последние чаты</h2>
          <button type="button" class="link-button" onClick={() => go('chats')}>Все чаты <Icon name="chevron" size={14} /></button>
        </div>
        {recent.length ? (
          <div class="recent-list">
            {recent.map((conversation) => (
              <button type="button" class="recent-item" key={conversation.uuid} onClick={() => openConversation(conversation.uuid)}>
                <span class="recent-icon"><Icon name="chat" size={18} /></span>
                <span class="recent-main">
                  <span class="recent-title">{conversation.name}</span>
                  <span class="muted small">
                    {fmtDate(conversation.updated_at || conversation.created_at)} · {countLabel(conversation.chat_messages.length, ['сообщение', 'сообщения', 'сообщений'])}
                  </span>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        ) : <EmptyState title="Чатов нет" text="Загрузите conversations-000.zip." />}
      </section>

      <div class="overview-columns">
        <section class="panel">
          <div class="panel-heading">
            <h2>Frames</h2>
            <button type="button" class="link-button" onClick={() => { go('artifacts'); }}>Все <Icon name="chevron" size={14} /></button>
          </div>
          {frames.length ? (
            <div class="mini-grid">
              {frames.map((frame) => (
                <button type="button" class="mini-card" key={frame.id} onClick={() => openFrame(frame.id)}>
                  <span class="mini-kind">{frame.kind}</span>
                  <span class="mini-title">{frame.versions[0]?.title || frame.id}</span>
                  <span class="muted small">{countLabel(frame.versions.length, ['версия', 'версии', 'версий'])}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="Frames нет" text="Загрузите frames-000.zip." icon="artifact" />}
        </section>

        <section class="panel">
          <div class="panel-heading">
            <h2>Артефакты из чатов</h2>
            <button type="button" class="link-button" onClick={() => { go('artifacts'); }}>Все <Icon name="chevron" size={14} /></button>
          </div>
          {inline.length ? (
            <div class="mini-grid">
              {inline.map((artifact) => (
                <button
                  type="button"
                  class="mini-card"
                  key={`${artifact.conversationUuid}:${artifact.id}`}
                  onClick={() => openInlineArtifact(`${artifact.conversationUuid}:${artifact.id}`)}
                >
                  <span class="mini-kind">{artifact.type || 'artifact'}</span>
                  <span class="mini-title">{artifact.title}</span>
                  <span class="muted small">{countLabel(artifact.versions.length, ['версия', 'версии', 'версий'])}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="Артефактов нет" text="В этом архиве нет вызовов artifacts." icon="code" />}
        </section>
      </div>

      {a.warnings.length > 0 ? (
        <section class="panel">
          <div class="panel-heading">
            <h2>Предупреждения</h2>
            <Badge tone="warning">{a.warnings.length}</Badge>
          </div>
          <ul class="warning-list">
            {a.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
