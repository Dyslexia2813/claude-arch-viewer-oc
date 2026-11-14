import { useState } from 'preact/hooks';
import type { FrameArtifact, FrameVersion, InlineArtifact } from '../../core/types';
import { artifactExtension } from '../../core/artifacts';
import { countLabel, decodeText, fmtDate, fmtSize } from '../../core/utils';
import {
  archive,
  artifactTab,
  openConversation,
  selectedFrame,
  selectedInline,
} from '../state';
import { BackButton, Badge, CodeBlock, EmptyState, Icon, Markdown } from '../components';
import { copyText, exportFrameVersion, exportInlineArtifact } from '../actions';

function buildPreview(version: FrameVersion): { html: string; note: string } {
  const index =
    version.files.find((file) => file.path === 'index.html') ??
    version.files.find((file) => file.path === 'run.html') ??
    version.files.find((file) => file.path.endsWith('.html'));
  if (!index?.data) return { html: '', note: 'В этой версии нет HTML-файла для превью.' };

  const byPath = new Map(version.files.map((file) => [file.path, file]));
  let html = decodeText(index.data);
  let inlined = 0;

  html = html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href: string) => {
    const clean = href.replace(/^\.\//, '');
    const file = byPath.get(clean);
    if (!file?.data) return match;
    inlined += 1;
    return `<style>${decodeText(file.data)}</style>`;
  });

  html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match, src: string) => {
    const clean = src.replace(/^\.\//, '');
    const file = byPath.get(clean);
    if (!file?.data) return match;
    inlined += 1;
    return `<script>${decodeText(file.data)}</script>`;
  });

  const note = inlined > 0
    ? 'CSS и JS встроены в превью. Динамические импорты и внешние ресурсы могут не работать.'
    : 'Превью без встроенных ресурсов: часть файлов может не загрузиться.';
  return { html, note };
}

function FrameDetail({ frame }: { frame: FrameArtifact }) {
  const a = archive.value;
  const [versionId, setVersionId] = useState(frame.versions[0]?.id);
  if (!a) return null;
  const version = frame.versions.find((item) => item.id === versionId) ?? frame.versions[0];
  const preview = version ? buildPreview(version) : { html: '', note: 'Версий нет.' };

  return (
    <div class="view detail-view">
      <div class="detail-heading">
        <BackButton onClick={() => { selectedFrame.value = null; }} label="К артефактам" />
        <div class="detail-actions">
          <button type="button" class="button button-small" onClick={() => exportFrameVersion(frame, version?.id)}>
            <Icon name="download" size={14} /> Скачать версию
          </button>
        </div>
      </div>
      <header class="detail-header">
        <div>
          <h1>{version?.title || frame.id}</h1>
          <div class="chat-meta">
            <Badge tone="accent">{frame.kind}</Badge>
            <span>{countLabel(frame.versions.length, ['версия', 'версии', 'версий'])}</span>
            <span>·</span>
            <span>{fmtDate(frame.versions[0]?.created_at || frame.updatedAt, true)}</span>
            {frame.visibility ? <><span>·</span><span class="muted">{frame.visibility}</span></> : null}
          </div>
        </div>
      </header>

      {version?.description ? <p class="muted">{version.description}</p> : null}

      {version?.pageMd ? (
        <section class="panel">
          <div class="panel-heading"><h2>Содержимое</h2></div>
          <Markdown text={version.pageMd} />
        </section>
      ) : null}

      {preview.html ? (
        <section class="panel">
          <div class="panel-heading">
            <h2>Превью</h2>
            <span class="muted small">{preview.note}</span>
          </div>
          <iframe
            class="artifact-preview"
            title="Превью артефакта"
            sandbox="allow-scripts"
            srcdoc={preview.html}
          />
        </section>
      ) : null}

      {version ? (
        <section class="panel">
          <div class="panel-heading">
            <h2>Файлы версии</h2>
            <span class="muted small">{version.files.length}</span>
          </div>
          <ul class="file-list">
            {version.files.map((file) => (
              <li key={file.path}>
                <Icon name="file" size={15} />
                <span class="mono">{file.path}</span>
                <span class="muted small">{fmtSize(file.size)}</span>
                {file.mime ? <Badge tone="muted">{file.mime}</Badge> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section class="panel">
        <div class="panel-heading"><h2>Версии</h2></div>
        <div class="version-list">
          {frame.versions.map((item) => (
            <div class={`version-item ${item.id === version?.id ? 'active' : ''}`} key={item.id}>
              <div>
                <strong>{item.title || 'Без названия'}</strong>
                <div class="muted small">{fmtDate(item.created_at, true)} · {item.id}</div>
              </div>
              <div class="detail-actions">
                <button type="button" class="button button-small" onClick={() => setVersionId(item.id)}>
                  Показать
                </button>
                <button type="button" class="button button-small" onClick={() => exportFrameVersion(frame, item.id)}>
                  <Icon name="download" size={14} /> ZIP
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InlineDetail({ artifact }: { artifact: InlineArtifact }) {
  const latest = artifact.versions[artifact.versions.length - 1];
  const ext = artifactExtension(latest?.type ?? artifact.type, latest?.language ?? artifact.language);
  return (
    <div class="view detail-view">
      <div class="detail-heading">
        <BackButton onClick={() => { selectedInline.value = null; }} label="К артефактам" />
        <div class="detail-actions">
          <button type="button" class="button button-small" onClick={() => copyText(artifact.content)}>
            <Icon name="copy" size={14} /> Копировать
          </button>
          <button type="button" class="button button-small" onClick={() => exportInlineArtifact(artifact)}>
            <Icon name="download" size={14} /> .{ext}
          </button>
        </div>
      </div>
      <header class="detail-header">
        <div>
          <h1>{artifact.title}</h1>
          <div class="chat-meta">
            <Badge tone="accent">{artifact.type || 'artifact'}</Badge>
            <span>{artifact.language || 'без языка'}</span>
            <span>·</span>
            <span>{countLabel(artifact.versions.length, ['версия', 'версии', 'версий'])}</span>
            <button type="button" class="link-button inline" onClick={() => openConversation(artifact.conversationUuid)}>
              {artifact.conversationName}
            </button>
          </div>
        </div>
      </header>
      {artifact.error ? <div class="alert alert-warning"><Icon name="warning" size={16} /> {artifact.error}</div> : null}
      <section class="panel">
        <div class="panel-heading">
          <h2>Содержимое</h2>
          <Badge tone="muted">{latest?.version_uuid}</Badge>
        </div>
        <CodeBlock value={artifact.content} language={artifact.language} />
      </section>
      <section class="panel">
        <div class="panel-heading"><h2>Версии</h2></div>
        <div class="version-list">
          {artifact.versions.map((version, index) => (
            <details class="version-item" key={version.version_uuid}>
              <summary>
                <span>Версия {index + 1}</span>
                <span class="muted small">{version.command} · {fmtDate(version.createdAt, true)}</span>
              </summary>
              {version.error ? <div class="alert alert-warning">{version.error}</div> : null}
              <CodeBlock value={version.content} language={version.language ?? artifact.language} />
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function FrameGrid() {
  const a = archive.value;
  if (!a) return null;
  if (a.frames.length === 0) {
    return <EmptyState title="Frames не найдены" text="Загрузите frames-000.zip из архива." icon="artifact" />;
  }
  return (
    <div class="artifact-grid">
      {a.frames.map((frame) => {
        const latest = frame.versions[0];
        return (
          <button type="button" class="artifact-card" key={frame.id} onClick={() => { selectedFrame.value = frame.id; }}>
            <div class="artifact-card-top">
              <Badge tone="accent">{frame.kind}</Badge>
              <span class="muted small">{countLabel(frame.versions.length, ['версия', 'версии', 'версий'])}</span>
            </div>
            <h3>{latest?.title || frame.id}</h3>
            <p class="muted small">{latest?.description || 'Без описания'}</p>
            <div class="artifact-card-bottom">
              <span class="muted small">{fmtDate(latest?.created_at || frame.updatedAt)}</span>
              <span class="muted small">{latest?.files.length ?? 0} файлов</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function InlineGrid() {
  const a = archive.value;
  if (!a) return null;
  if (a.inlineArtifacts.length === 0) {
    return <EmptyState title="Артефактов из чатов нет" text="В этом архиве нет вызовов инструмента artifacts." icon="code" />;
  }
  return (
    <div class="artifact-grid">
      {a.inlineArtifacts.map((artifact) => (
        <button
          type="button"
          class="artifact-card"
          key={`${artifact.conversationUuid}:${artifact.id}`}
          onClick={() => { selectedInline.value = `${artifact.conversationUuid}:${artifact.id}`; }}
        >
          <div class="artifact-card-top">
            <Badge tone="accent">{artifact.type || 'artifact'}</Badge>
            <span class="muted small">{countLabel(artifact.versions.length, ['версия', 'версии', 'версий'])}</span>
          </div>
          <h3>{artifact.title}</h3>
          <p class="muted small">{artifact.conversationName}</p>
          <div class="artifact-card-bottom">
            <span class="muted small">{artifact.language || 'без языка'}</span>
            <span class="muted small">{artifact.content.length.toLocaleString('ru-RU')} символов</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function ArtifactsView() {
  const a = archive.value;
  if (!a) return null;

  if (selectedFrame.value) {
    const frame = a.frames.find((item) => item.id === selectedFrame.value);
    if (frame) return <FrameDetail frame={frame} />;
  }
  if (selectedInline.value) {
    const [conversationUuid, id] = selectedInline.value.split(':');
    const artifact = a.inlineArtifacts.find((item) => item.conversationUuid === conversationUuid && item.id === id);
    if (artifact) return <InlineDetail artifact={artifact} />;
  }

  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Артефакты</h1>
          <p class="muted">
            {countLabel(a.frames.length, ['Frames-артефакт', 'Frames-артефакта', 'Frames-артефактов'])} · {countLabel(a.inlineArtifacts.length, ['артефакт из чатов', 'артефакта из чатов', 'артефактов из чатов'])}
          </p>
        </div>
      </div>
      <div class="tabs">
        <button type="button" class={`tab ${artifactTab.value === 'frames' ? 'active' : ''}`} onClick={() => { artifactTab.value = 'frames'; }}>
          Frames <span class="tab-count">{a.frames.length}</span>
        </button>
        <button type="button" class={`tab ${artifactTab.value === 'inline' ? 'active' : ''}`} onClick={() => { artifactTab.value = 'inline'; }}>
          Из чатов <span class="tab-count">{a.inlineArtifacts.length}</span>
        </button>
      </div>
      {artifactTab.value === 'frames' ? <FrameGrid /> : <InlineGrid />}
    </div>
  );
}
