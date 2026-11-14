import { signal } from '@preact/signals';
import type { Archive, ChatExportOptions, ImportProgress, Manifest } from '../core/types';
import { DEFAULT_CHAT_EXPORT_OPTIONS } from '../core/types';

export type Section =
  | 'overview'
  | 'chats'
  | 'artifacts'
  | 'projects'
  | 'cloud'
  | 'memory'
  | 'feedback'
  | 'account'
  | 'files'
  | 'diagnostics'
  | 'search';

export type Theme = 'dark' | 'light';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem('cav-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage может быть недоступен.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark';
}

export const archive = signal<Archive | null>(null);
export const manifest = signal<Manifest | null>(null);
export const manifestOnly = signal(false);
export const section = signal<Section>('overview');
export const theme = signal<Theme>(initialTheme());

export const selectedConversation = signal<string | null>(null);
export const selectedProject = signal<string | null>(null);
export const selectedFrame = signal<string | null>(null);
export const selectedInline = signal<string | null>(null);
export const selectedMemory = signal<string | null>(null);
export const selectedCloudChannel = signal<string | null>(null);
export const selectedCloudSession = signal<string | null>(null);
export const selectedFile = signal<string | null>(null);

export const artifactTab = signal<'frames' | 'inline'>('frames');
export const cloudTab = signal<'channels' | 'agents' | 'routines' | 'transcripts'>('channels');
export const query = signal('');
export const globalQuery = signal('');
export const fileQuery = signal('');
export const includeToolResults = signal(false);
export const rawMode = signal(false);
export const chatOptions = signal<ChatExportOptions>(DEFAULT_CHAT_EXPORT_OPTIONS);

export const importing = signal(false);
export const progress = signal<ImportProgress | null>(null);
export const error = signal<string | null>(null);
export const toast = signal<string | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
  toast.value = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 3500);
}

export function applyTheme(next: Theme): void {
  theme.value = next;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('cav-theme', next);
  } catch {
    // ignore
  }
}

export function toggleTheme(): void {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

export function go(next: Section): void {
  section.value = next;
  selectedConversation.value = null;
  selectedProject.value = null;
  selectedFrame.value = null;
  selectedInline.value = null;
  selectedMemory.value = null;
  selectedCloudChannel.value = null;
  selectedCloudSession.value = null;
  selectedFile.value = null;
  query.value = '';
  rawMode.value = false;
}

export function openConversation(uuid: string): void {
  section.value = 'chats';
  selectedConversation.value = uuid;
  rawMode.value = false;
}

export function openProject(uuid: string): void {
  section.value = 'projects';
  selectedProject.value = uuid;
}

export function openFrame(id: string): void {
  section.value = 'artifacts';
  artifactTab.value = 'frames';
  selectedFrame.value = id;
}

export function openInlineArtifact(key: string): void {
  section.value = 'artifacts';
  artifactTab.value = 'inline';
  selectedInline.value = key;
}

export function openCloudChannel(id: string): void {
  section.value = 'cloud';
  cloudTab.value = 'channels';
  selectedCloudChannel.value = id;
}
