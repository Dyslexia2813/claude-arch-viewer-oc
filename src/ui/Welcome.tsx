import { useRef } from 'preact/hooks';
import type { Manifest } from '../core/types';
import { categoryLabel, manifestExpiresAt } from '../core/manifest';
import { fmtDate } from '../core/utils';
import { archive, error, importing, manifest, manifestOnly, progress } from './state';
import { Icon } from './components';

export function ManifestPanel({ value }: { value: Manifest }) {
  const expires = manifestExpiresAt(value);
  const expired = expires ? expires.getTime() < Date.now() : false;
  const sources = archive.value?.sources ?? [];

  return (
    <section class="manifest-panel">
      <div class="panel-heading">
        <div>
          <h2>Manifest экспорта</h2>
          <p class="muted">
            Создан {fmtDate(value.created_at, true)} · {value.data_files.length} файлов
          </p>
        </div>
        <span class={`badge ${expired ? 'badge-danger' : 'badge-ok'}`}>
          {expired ? 'Ссылки истекли' : `Ссылки до ${fmtDate(expires?.toISOString(), true)}`}
        </span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Файл</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {value.data_files.map((file) => {
              const loaded = sources.some((source) => source.filename.toLowerCase() === file.filename.toLowerCase());
              return (
                <tr key={`${file.category}:${file.part}:${file.filename}`}>
                  <td>{categoryLabel(file.category)}</td>
                  <td class="mono">{file.filename}</td>
                  <td>
                    <span class={`badge ${loaded ? 'badge-ok' : 'badge-muted'}`}>
                      {loaded ? 'загружен' : 'не загружен'}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <a class="button button-small" href={file.export_url} target="_blank" rel="noopener noreferrer">
                      <Icon name="external" size={14} /> Скачать
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="muted small">
        Ссылки действуют 24 часа и могут перестать работать после первого использования. Скачайте ZIP и добавьте их сюда.
      </p>
    </section>
  );
}

export function ImportOverlay() {
  if (!importing.value) return null;
  const p = progress.value;
  const percent = p && p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
  return (
    <div class="overlay">
      <div class="overlay-card">
        <div class="spinner" />
        <h2>Разбираю архив</h2>
        <p>{p?.stage ?? 'Подготовка…'}</p>
        {p?.detail ? <p class="muted small mono">{p.detail}</p> : null}
        <div class="progress-track">
          <div class="progress-bar" style={{ width: `${percent}%` }} />
        </div>
        <p class="muted small">
          {p?.current ?? 0} из {p?.total ?? 0}
        </p>
      </div>
    </div>
  );
}

export function Welcome({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currentManifest = manifest.value ?? archive.value?.manifest;

  return (
    <div class="welcome">
      <div class="welcome-hero">
        <div class="logo-mark">
          <Icon name="artifact" size={40} />
        </div>
        <h1>Claude Arch Viewer</h1>
        <p class="lead">
          Локальный просмотрщик архива Claude: чаты, артефакты, проекты, память и Claude Code Cloud.
          Файлы не покидают браузер.
        </p>
        <div class="welcome-actions">
          <button type="button" class="button button-primary button-large" onClick={() => inputRef.current?.click()}>
            <Icon name="plus" size={18} /> Выбрать ZIP или manifest
          </button>
          <span class="muted small">или перетащите файлы в окно</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
            if (files.length) onFiles(files);
            (event.currentTarget as HTMLInputElement).value = '';
          }}
        />
      </div>

      <div class="welcome-grid">
        <div class="welcome-card">
          <Icon name="chat" />
          <h3>Чаты</h3>
          <p>Ветки сообщений, thinking, вызовы инструментов, вложения и полный текст.</p>
        </div>
        <div class="welcome-card">
          <Icon name="artifact" />
          <h3>Артефакты</h3>
          <p>Frames с файлами и версиями, артефакты из чатов с восстановлением патчей.</p>
        </div>
        <div class="welcome-card">
          <Icon name="project" />
          <h3>Проекты и память</h3>
          <p>Инструкции, документы, память аккаунта и рефлексии.</p>
        </div>
        <div class="welcome-card">
          <Icon name="cloud" />
          <h3>Claude Code Cloud</h3>
          <p>Каналы, сообщения, агенты, рутины и транскрипты сессий.</p>
        </div>
      </div>

      {currentManifest ? <ManifestPanel value={currentManifest} /> : null}

      {manifestOnly.value && !currentManifest ? (
        <p class="muted">Manifest загружен, но ZIP-файлы ещё не добавлены.</p>
      ) : null}

      {error.value ? <div class="alert alert-error">{error.value}</div> : null}

      <p class="privacy-note">
        <Icon name="info" size={16} />
        Всё работает локально. Приложение не отправляет содержимое архива в сеть.
      </p>
    </div>
  );
}
