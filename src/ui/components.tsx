import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import hljs from 'highlight.js';
import { renderMarkdown } from '../core/markdown';
import { classNames } from '../core/utils';

const ICONS: Record<string, string> = {
  overview: 'M3 12h7V3H3v9Zm0 9h7v-6H3v6Zm11 0h7V12h-7v9Zm0-18v6h7V3h-7Z',
  chat: 'M21 12a8 8 0 0 1-8 8H6l-3 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z',
  artifact: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 0v18M3 7.5l9 4.5 9-4.5',
  project: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9H7Z',
  memory: 'M9 3h6v3h3v6h-3v3H9v-3H6V6h3V3Zm-3 9v6h3v3h6v-3h3v-6',
  feedback: 'M12 3a9 9 0 1 0 9 9M12 3v9l6 3',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  files: 'M4 3h10l4 4v14H4V3Zm10 0v5h5M8 13h8M8 17h6',
  diagnostics: 'M4 19V5m0 14h16M8 15l3-4 3 2 4-6',
  search: 'm21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m0 0 5-5m-5 5-5-5M5 21h14',
  copy: 'M8 8h12v12H8V8ZM4 16V4h12',
  back: 'M19 12H5m0 0 6 6m-6-6 6-6',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m11.32 0 1.42 1.42M4.92 4.92l1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  warning: 'M12 3 2 21h20L12 3Zm0 5v6m0 4h.01',
  check: 'm5 12 4 4L19 6',
  close: 'M6 6l12 12M18 6 6 18',
  external: 'M14 4h6v6m0-6L10 14M20 14v6H4V4h6',
  chevron: 'm9 6 6 6-6 6',
  filter: 'M3 5h18M6 12h12M10 19h4',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14h.01M11 12h1v5h1',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6',
  file: 'M6 2h8l4 4v16H6V2Zm8 0v5h5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v5l3 2',
  tag: 'M20 13 13 20l-9-9V3h8l8 8v2ZM7 7h.01',
  branch: 'M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0v3a4 4 0 0 1-4 4H6',
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      class={classNames('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name] ?? ICONS.info} />
    </svg>
  );
}

export function Badge({ children, tone = 'default' }: { children: ComponentChildren; tone?: string }) {
  return <span class={`badge badge-${tone}`}>{children}</span>;
}

export function StatCard({ label, value, hint }: { label: string; value: ComponentChildren; hint?: string }) {
  return (
    <div class="stat-card">
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
      {hint ? <div class="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ title, text, icon = 'info' }: { title: string; text?: string; icon?: string }) {
  return (
    <div class="empty-state">
      <Icon name={icon} size={34} />
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

export function Collapsible({
  summary,
  children,
  open = false,
  className,
}: {
  summary: ComponentChildren;
  children: ComponentChildren;
  open?: boolean;
  className?: string;
}) {
  return (
    <details class={classNames('collapsible', className)} open={open}>
      <summary>{summary}</summary>
      <div class="collapsible-body">{children}</div>
    </details>
  );
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(text), [text]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll('pre code').forEach((block) => {
      if (block instanceof HTMLElement && !block.dataset.highlighted) {
        try {
          hljs.highlightElement(block);
          block.dataset.highlighted = 'yes';
        } catch {
          // Игнорируем неизвестные языки.
        }
      }
    });
    root.querySelectorAll('a').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }, [html]);

  return <div ref={ref} class={classNames('markdown', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CodeBlock({ value, language }: { value: unknown; language?: string }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    try {
      if (language) {
        node.className = `language-${language}`;
        hljs.highlightElement(node);
      } else {
        node.className = 'language-json';
        hljs.highlightElement(node);
      }
    } catch {
      // ignore
    }
  }, [text, language]);
  return (
    <pre class="code-block">
      <code ref={ref}>{text}</code>
    </pre>
  );
}

export function SearchInput({
  value,
  onInput,
  placeholder,
}: {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label class="search-input">
      <Icon name="search" size={17} />
      <input
        type="search"
        value={value}
        placeholder={placeholder ?? 'Поиск…'}
        onInput={(event) => onInput((event.currentTarget as HTMLInputElement).value)}
      />
      {value ? (
        <button type="button" class="icon-button" onClick={() => onInput('')} title="Очистить">
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </label>
  );
}

export function BackButton({ onClick, label = 'Назад' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" class="back-button" onClick={onClick}>
      <Icon name="back" size={16} />
      {label}
    </button>
  );
}

export function ProgressOverlay() {
  return null;
}
