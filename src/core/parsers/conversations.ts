import type { Attachment, ContentBlock, Conversation, FileRef, Message } from '../types';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeAttachment(raw: unknown): Attachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.file_name !== 'string') return null;
  return {
    file_name: item.file_name,
    file_size: Number(item.file_size ?? 0),
    file_type: asString(item.file_type),
    extracted_content: typeof item.extracted_content === 'string' ? item.extracted_content : undefined,
  };
}

function normalizeFileRef(raw: unknown): FileRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.file_uuid !== 'string' || typeof item.file_name !== 'string') return null;
  return { file_uuid: item.file_uuid, file_name: item.file_name };
}

function normalizeMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.uuid !== 'string') return null;
  return {
    uuid: item.uuid,
    text: asString(item.text),
    content: asArray<ContentBlock>(item.content),
    sender: asString(item.sender, 'unknown'),
    created_at: asString(item.created_at),
    updated_at: asString(item.updated_at),
    attachments: asArray<unknown>(item.attachments)
      .map(normalizeAttachment)
      .filter((value): value is Attachment => value !== null),
    files: asArray<unknown>(item.files)
      .map(normalizeFileRef)
      .filter((value): value is FileRef => value !== null),
    parent_message_uuid: typeof item.parent_message_uuid === 'string' ? item.parent_message_uuid : null,
  };
}

export function normalizeConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.uuid !== 'string') return null;
  const account = item.account && typeof item.account === 'object' ? (item.account as Record<string, unknown>) : {};
  return {
    uuid: item.uuid,
    name: asString(item.name, 'Без названия'),
    summary: asString(item.summary),
    created_at: asString(item.created_at),
    updated_at: asString(item.updated_at),
    account: { uuid: asString(account.uuid) },
    chat_messages: asArray<unknown>(item.chat_messages)
      .map(normalizeMessage)
      .filter((value): value is Message => value !== null),
    project_uuid: typeof item.project_uuid === 'string' ? item.project_uuid : undefined,
    model: typeof item.model === 'string' ? item.model : undefined,
  };
}

export function parseConversations(raw: unknown): Conversation[] {
  return asArray<unknown>(raw)
    .map(normalizeConversation)
    .filter((value): value is Conversation => value !== null);
}
