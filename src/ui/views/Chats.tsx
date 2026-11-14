import type { ContentBlock, Conversation, Message } from '../../core/types';
import { countLabel, fmtDate, truncate } from '../../core/utils';
import { searchConversations } from '../../core/search';
import {
  archive,
  go,
  includeToolResults,
  openInlineArtifact,
  query,
  rawMode,
  selectedConversation,
} from '../state';
import { BackButton, Badge, CodeBlock, Collapsible, EmptyState, Icon, Markdown, SearchInput } from '../components';
import { exportChatJson, exportChatMarkdown, exportChatZip } from '../actions';

function messagePreview(conversation: Conversation): string {
  const first = conversation.chat_messages.find((message) => message.sender === 'human');
  if (!first) return conversation.summary || 'Нет сообщений';
  const text = first.content
    .filter((block) => block.type === 'text')
    .map((block) => String(block.text ?? ''))
    .join(' ');
  return truncate(text || first.text || conversation.summary || 'Нет текста', 150);
}

function ChatList() {
  const a = archive.value;
  if (!a) return null;
  const hits = query.value.trim()
    ? searchConversations(a.conversations, query.value, includeToolResults.value)
    : a.conversations.map((conversation) => ({ conversation, score: 0, snippet: messagePreview(conversation) }));

  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Чаты</h1>
          <p class="muted">{countLabel(a.conversations.length, ['чат', 'чата', 'чатов'])} · {countLabel(a.stats.messages, ['сообщение', 'сообщения', 'сообщений'])}</p>
        </div>
      </div>
      <div class="toolbar">
        <SearchInput value={query.value} onInput={(value) => { query.value = value; }} placeholder="Поиск по названию и тексту…" />
        <label class="checkbox">
          <input
            type="checkbox"
            checked={includeToolResults.value}
            onChange={(event) => { includeToolResults.value = (event.currentTarget as HTMLInputElement).checked; }}
          />
          Искать в результатах инструментов
        </label>
      </div>

      {hits.length === 0 ? (
        <EmptyState title="Ничего не найдено" text="Попробуйте другой запрос или включите поиск по результатам инструментов." icon="search" />
      ) : (
        <div class="conversation-list">
          {hits.map(({ conversation, snippet }) => {
            const artifactCount = a.inlineArtifacts.filter((artifact) => artifact.conversationUuid === conversation.uuid).length;
            const attachmentCount = conversation.chat_messages.reduce((sum, message) => sum + message.attachments.length, 0);
            const branchCount = conversation.chat_messages.length - new Set(conversation.chat_messages.map((message) => message.parent_message_uuid)).size;
            return (
              <button type="button" class="conversation-item" key={conversation.uuid} onClick={() => { selectedConversation.value = conversation.uuid; rawMode.value = false; }}>
                <div class="conversation-main">
                  <div class="conversation-title-row">
                    <span class="conversation-title">{conversation.name}</span>
                    {artifactCount > 0 ? <Badge tone="accent">{artifactCount} арт.</Badge> : null}
                    {attachmentCount > 0 ? <Badge tone="muted">{attachmentCount} вл.</Badge> : null}
                    {branchCount > 0 ? <Badge tone="warning">ветки</Badge> : null}
                  </div>
                  <p class="conversation-snippet">{snippet}</p>
                  <div class="conversation-meta">
                    <span>{fmtDate(conversation.updated_at || conversation.created_at, true)}</span>
                    <span>·</span>
                    <span>{countLabel(conversation.chat_messages.length, ['сообщение', 'сообщения', 'сообщений'])}</span>
                    {conversation.summary ? <><span>·</span><span>{truncate(conversation.summary, 80)}</span></> : null}
                  </div>
                </div>
                <Icon name="chevron" size={18} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toolResultText(block: ContentBlock): string {
  const content = block.content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>).text ?? '') : String(item ?? '')))
      .join('\n');
  }
  return String(content ?? '');
}

function MessageBlock({ block, conversationUuid }: { block: ContentBlock; conversationUuid: string }) {
  const type = block.type;
  if (type === 'text') return <Markdown text={String(block.text ?? '')} />;
  if (type === 'thinking') {
    return (
      <Collapsible summary={<><Icon name="memory" size={15} /> Размышления</>} className="thinking-block">
        <Markdown text={String(block.thinking ?? '')} />
      </Collapsible>
    );
  }
  if (type === 'tool_use') {
    const name = String(block.name ?? 'tool');
    const input = block.input as Record<string, unknown> | undefined;
    const artifactId = name === 'artifacts' && input && typeof input.id === 'string' ? input.id : null;
    return (
      <Collapsible
        summary={
          <span class="tool-summary">
            <Icon name="code" size={15} /> Инструмент: <strong>{name}</strong>
            {artifactId ? (
              <button
                type="button"
                class="link-button inline"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openInlineArtifact(`${conversationUuid}:${artifactId}`);
                }}
              >
                открыть артефакт
              </button>
            ) : null}
          </span>
        }
        className="tool-block"
      >
        <CodeBlock value={block.input ?? {}} />
      </Collapsible>
    );
  }
  if (type === 'tool_result') {
    const text = toolResultText(block);
    return (
      <Collapsible
        summary={
          <span class="tool-summary">
            <Icon name="code" size={15} /> Результат: <strong>{String(block.name ?? 'tool')}</strong>
            {block.is_error ? <Badge tone="danger">ошибка</Badge> : null}
            <span class="muted small">{text.length.toLocaleString('ru-RU')} символов</span>
          </span>
        }
        className="tool-block"
      >
        <pre class="result-block">{text}</pre>
      </Collapsible>
    );
  }
  if (type === 'injected_prompt_block') {
    return (
      <Collapsible summary={<><Icon name="info" size={15} /> Системная вставка</>} className="tool-block">
        <Markdown text={String(block.prompt ?? '')} />
      </Collapsible>
    );
  }
  if (type === 'document') {
    return (
      <div class="file-placeholder">
        <Icon name="file" size={16} />
        <span>Документ: {String(block.title ?? block.file_uuid ?? 'без названия')}</span>
        <Badge tone="muted">бинарник отсутствует</Badge>
      </div>
    );
  }
  if (type === 'image') {
    return (
      <div class="file-placeholder">
        <Icon name="file" size={16} />
        <span>Изображение</span>
        <Badge tone="muted">бинарник отсутствует</Badge>
      </div>
    );
  }
  if (type === 'flag') {
    return (
      <div class="alert alert-warning">
        <Icon name="warning" size={16} />
        Системная пометка: {String(block.flag ?? '')}
      </div>
    );
  }
  if (type === 'token_budget') return null;
  return (
    <Collapsible summary={<><Icon name="info" size={15} /> Неизвестный блок: {type}</>} className="tool-block">
      <CodeBlock value={block} />
    </Collapsible>
  );
}

function MessageItem({
  message,
  siblings,
  artifactCount,
  conversationUuid,
}: {
  message: Message;
  siblings: number;
  artifactCount: number;
  conversationUuid: string;
}) {
  return (
    <article class={`message message-${message.sender}`}>
      <div class="message-head">
        <span class={`avatar avatar-${message.sender}`}>{message.sender === 'human' ? 'H' : 'C'}</span>
        <span class="message-author">{message.sender === 'human' ? 'Вы' : 'Claude'}</span>
        <span class="muted small">{fmtDate(message.created_at, true)}</span>
        {siblings > 1 ? <Badge tone="warning">ветка {siblings}</Badge> : null}
        {artifactCount > 0 ? <Badge tone="accent">{artifactCount} артефакт(а)</Badge> : null}
      </div>
      <div class="message-body">
        {message.content.map((block, index) => (
          <MessageBlock block={block} conversationUuid={conversationUuid} key={`${message.uuid}:${index}`} />
        ))}
        {message.attachments.map((attachment, index) => (
          <Collapsible
            key={`${message.uuid}:attachment:${index}`}
            summary={<><Icon name="file" size={15} /> Вложение: {attachment.file_name} <span class="muted small">{attachment.file_type}</span></>}
            className="attachment-block"
          >
            {attachment.extracted_content ? <Markdown text={attachment.extracted_content} /> : <p class="muted">Текст не извлечён.</p>}
          </Collapsible>
        ))}
        {message.files.length > 0 ? (
          <div class="file-chips">
            {message.files.map((file) => <span class="chip" key={file.file_uuid}>{file.file_name}</span>)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ChatDetail({ conversation }: { conversation: Conversation }) {
  const a = archive.value;
  if (!a) return null;

  const parentCounts = new Map<string, number>();
  for (const message of conversation.chat_messages) {
    const parent = message.parent_message_uuid ?? '';
    parentCounts.set(parent, (parentCounts.get(parent) ?? 0) + 1);
  }
  const branchPoints = [...parentCounts.values()].filter((count) => count > 1).length;

  return (
    <div class="view chat-detail">
      <div class="detail-heading">
        <BackButton onClick={() => { selectedConversation.value = null; rawMode.value = false; }} label="К чатам" />
        <div class="detail-actions">
          <button type="button" class="button button-small" onClick={() => exportChatMarkdown(conversation)}><Icon name="download" size={14} /> MD</button>
          <button type="button" class="button button-small" onClick={() => exportChatZip(conversation)}><Icon name="download" size={14} /> ZIP</button>
          <button type="button" class="button button-small" onClick={() => exportChatJson(conversation)}><Icon name="code" size={14} /> JSON</button>
          <button type="button" class={`button button-small ${rawMode.value ? 'button-primary' : ''}`} onClick={() => { rawMode.value = !rawMode.value; }}>
            {rawMode.value ? 'Читаемый вид' : 'Raw JSON'}
          </button>
        </div>
      </div>

      <header class="chat-header">
        <h1>{conversation.name}</h1>
        <div class="chat-meta">
          <span>{fmtDate(conversation.created_at, true)}</span>
          <span>·</span>
          <span>{countLabel(conversation.chat_messages.length, ['сообщение', 'сообщения', 'сообщений'])}</span>
          {branchPoints > 0 ? <><span>·</span><Badge tone="warning">{branchPoints} ветвлений</Badge></> : null}
          {conversation.summary ? <><span>·</span><span class="muted">{conversation.summary}</span></> : null}
        </div>
      </header>

      {rawMode.value ? (
        <pre class="raw-json">{JSON.stringify(conversation, null, 2)}</pre>
      ) : (
        <div class="messages">
          {conversation.chat_messages.map((message) => {
            const siblings = parentCounts.get(message.parent_message_uuid ?? '') ?? 1;
            const artifactCount = message.content.filter((block) => block.type === 'tool_use' && block.name === 'artifacts').length;
            return <MessageItem key={message.uuid} message={message} siblings={siblings} artifactCount={artifactCount} conversationUuid={conversation.uuid} />;
          })}
        </div>
      )}
    </div>
  );
}

export function ChatsView() {
  const a = archive.value;
  if (!a) return null;
  const selected = selectedConversation.value
    ? a.conversations.find((conversation) => conversation.uuid === selectedConversation.value)
    : null;
  if (selected) return <ChatDetail conversation={selected} />;
  return <ChatList />;
}
