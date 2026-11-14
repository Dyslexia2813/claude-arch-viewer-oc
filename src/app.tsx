import { useEffect, useRef } from 'preact/hooks';
import type { Archive } from './core/types';
import { categoryLabel } from './core/manifest';
import { fmtDate, fmtSize } from './core/utils';
import { importFiles } from './core/importer';
import { isManifest, parseManifest } from './core/manifest';
import { Overview } from './ui/views/Overview';
import { ChatsView } from './ui/views/Chats';
import { ArtifactsView } from './ui/views/Artifacts';
import { ProjectsView } from './ui/views/Projects';
import { CloudView } from './ui/views/Cloud';
import { AccountView, DiagnosticsView, FeedbackView, FilesView, MemoryView, SearchView } from './ui/views/Misc';
import { Welcome, ImportOverlay } from './ui/Welcome';
import { Badge, Icon } from './ui/components';
import {
  applyTheme,
  archive,
  error,
  globalQuery,
  go,
  importing,
  manifest,
  manifestOnly,
  progress,
  section,
  showToast,
  theme,
  toast,
  toggleTheme,
  type Section,
} from './ui/state';
import { exportArchiveZip } from './ui/actions';

const NAV: Array<{ id: Section; label: string; icon: string; count?: (a: Archive) => number }> = [
  { id: 'overview', label: 'Обзор', icon: 'overview' },
  { id: 'chats', label: 'Чаты', icon: 'chat', count: (a) => a.stats.conversations },
  { id: 'artifacts', label: 'Артефакты', icon: 'artifact', count: (a) => a.stats.frames + a.stats.inlineArtifacts },
  { id: 'projects', label: 'Проекты', icon: 'project', count: (a) => a.stats.projects },
  { id: 'cloud', label: 'Claude Code Cloud', icon: 'cloud', count: (a) => a.stats.cloudChannels },
  { id: 'memory', label: 'Память', icon: 'memory', count: (a) => a.stats.memories },
  { id: 'feedback', label: 'Рефлексии', icon: 'feedback', count: (a) => a.stats.reflections },
  { id: 'account', label: 'Аккаунт', icon: 'account', count: (a) => a.users.length },
  { id: 'files', label: 'Файлы', icon: 'files', count: (a) => a.stats.files },
  { id: 'diagnostics', label: 'Диагностика', icon: 'diagnostics', count: (a) => a.warnings.length },
  { id: 'search', label: 'Поиск', icon: 'search' },
];

function Sidebar({ onAdd }: { onAdd: () => void }) {
  const a = archive.value;
  if (!a) return null;
  const loadedFilenames = new Set(a.sources.map((source) => source.filename.toLowerCase()));
  return (
    <aside class="sidebar">
      <div class="sidebar-brand" onClick={() => go('overview')}>
        <span class="brand-mark"><Icon name="artifact" size={22} /></span>
        <span>
          <strong>Claude Arch</strong>
          <span class="muted small">viewer</span>
        </span>
      </div>

      <nav class="nav">
        {NAV.map((item) => {
          const count = item.count?.(a);
          return (
            <button
              type="button"
              class={`nav-item ${section.value === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => go(item.id)}
            >
              <Icon name={item.icon} size={17} />
              <span class="nav-label">{item.label}</span>
              {typeof count === 'number' && count > 0 ? <span class="nav-count">{count}</span> : null}
              {item.id === 'diagnostics' && count ? <span class="nav-dot" /> : null}
            </button>
          );
        })}
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="button button-small button-primary sidebar-add" onClick={onAdd}>
          <Icon name="plus" size={15} /> Добавить архив
        </button>
        {a.manifest ? (
          <div class="source-mini">
            <div class="source-mini-title">Категории</div>
            {a.manifest.data_files.map((file) => {
              const loaded = loadedFilenames.has(file.filename.toLowerCase());
              return (
                <div class="source-mini-row" key={`${file.category}:${file.part}`}>
                  <span class={`status-dot ${loaded ? 'ok' : 'missing'}`} />
                  <span class="source-mini-name">{categoryLabel(file.category)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div class="source-mini">
            <div class="source-mini-title">Источники</div>
            {a.sources.map((source) => (
              <div class="source-mini-row" key={source.id}>
                <span class="status-dot ok" />
                <span class="source-mini-name">{source.filename}</span>
              </div>
            ))}
          </div>
        )}
        <div class="muted small sidebar-size">{fmtSize(a.stats.totalBytes)} распаковано</div>
      </div>
    </aside>
  );
}

function Header({ onAdd }: { onAdd: () => void }) {
  const a = archive.value;
  return (
    <header class="topbar">
      <div class="topbar-left">
        {a ? (
          <div class="breadcrumb">
            <span>{NAV.find((item) => item.id === section.value)?.label ?? 'Обзор'}</span>
            {a.manifest ? <span class="muted small">· manifest {fmtDate(a.manifest.created_at)}</span> : null}
          </div>
        ) : (
          <div class="breadcrumb"><span>Claude Arch Viewer</span></div>
        )}
      </div>
      <div class="topbar-actions">
        {a ? (
          <>
            <button type="button" class="button button-small" onClick={() => { go('search'); }}>
              <Icon name="search" size={15} /> Поиск
            </button>
            <button type="button" class="button button-small" onClick={exportArchiveZip}>
              <Icon name="download" size={15} /> Экспорт
            </button>
          </>
        ) : null}
        <button type="button" class="button button-small" onClick={onAdd}>
          <Icon name="plus" size={15} /> Архив
        </button>
        <button type="button" class="icon-button" onClick={toggleTheme} title="Тема">
          <Icon name={theme.value === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
      </div>
    </header>
  );
}

function CurrentView() {
  switch (section.value) {
    case 'overview':
      return <Overview />;
    case 'chats':
      return <ChatsView />;
    case 'artifacts':
      return <ArtifactsView />;
    case 'projects':
      return <ProjectsView />;
    case 'cloud':
      return <CloudView />;
    case 'memory':
      return <MemoryView />;
    case 'feedback':
      return <FeedbackView />;
    case 'account':
      return <AccountView />;
    case 'files':
      return <FilesView />;
    case 'diagnostics':
      return <DiagnosticsView />;
    case 'search':
      return <SearchView />;
    default:
      return <Overview />;
  }
}

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    applyTheme(theme.value);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        go('search');
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('.view .search-input input');
          input?.focus();
        }, 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0 || importing.value) return;
    error.value = null;
    const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith('.json'));
    const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith('.zip'));

    if (zipFiles.length === 0 && jsonFiles.length > 0) {
      let foundManifest = false;
      for (const file of jsonFiles) {
        try {
          const raw = JSON.parse(await file.text()) as unknown;
          if (isManifest(raw)) {
            const parsed = parseManifest(raw);
            manifest.value = parsed;
            manifestOnly.value = true;
            if (archive.value) {
              archive.value = { ...archive.value, manifest: parsed };
            }
            foundManifest = true;
            showToast('Manifest загружен. Теперь добавьте ZIP-файлы.');
            break;
          }
        } catch {
          // ignore
        }
      }
      if (!foundManifest) {
        error.value = 'В JSON не найден manifest экспорта Claude (нет массива data_files).';
        showToast('Это не manifest экспорта Claude');
      }
      return;
    }

    if (zipFiles.length === 0) {
      showToast('Добавьте ZIP-файлы архива');
      return;
    }

    importing.value = true;
    progress.value = { stage: 'Подготовка', current: 0, total: zipFiles.length };
    try {
      const result = await importFiles(files, {
        existing: archive.value ?? undefined,
        onProgress: (value) => { progress.value = value; },
      });
      const next = { ...result, manifest: result.manifest ?? manifest.value ?? undefined };
      archive.value = next;
      if (next.manifest) manifest.value = next.manifest;
      manifestOnly.value = false;
      go('overview');
      showToast('Архив загружен');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error.value = message;
      showToast(`Ошибка импорта: ${message}`);
    } finally {
      importing.value = false;
      progress.value = null;
    }
  };

  const openFilePicker = () => inputRef.current?.click();

  return (
    <div
      class="app"
      onDragOver={(event) => { event.preventDefault(); }}
      onDrop={(event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length) void handleFiles(files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
          if (files.length) void handleFiles(files);
          (event.currentTarget as HTMLInputElement).value = '';
        }}
      />

      {archive.value ? (
        <div class="layout">
          <Sidebar onAdd={openFilePicker} />
          <div class="content">
            <Header onAdd={openFilePicker} />
            <main class="main">
              <CurrentView />
            </main>
          </div>
        </div>
      ) : (
        <>
          <Header onAdd={openFilePicker} />
          <main class="main welcome-main">
            <Welcome onFiles={handleFiles} />
          </main>
        </>
      )}

      <ImportOverlay />
      {toast.value ? <div class="toast">{toast.value}</div> : null}
      {error.value && archive.value ? <div class="toast toast-error">{error.value}</div> : null}
    </div>
  );
}
