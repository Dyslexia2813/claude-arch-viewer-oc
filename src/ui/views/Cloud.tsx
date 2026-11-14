import type { CloudChannel, CloudMessage, CloudTranscript } from '../../core/types';
import { countLabel, fmtDate } from '../../core/utils';
import {
  archive,
  cloudTab,
  selectedCloudChannel,
  selectedCloudSession,
} from '../state';
import { BackButton, Badge, CodeBlock, Collapsible, EmptyState, Icon, Markdown } from '../components';

function channelName(channel: CloudChannel): string {
  const name = channel.content?.name;
  return typeof name === 'string' && name ? name : channel.channel_id;
}

function channelTopic(channel: CloudChannel): string {
  const topic = channel.content?.topic;
  return typeof topic === 'string' ? topic : '';
}

function authorName(message: CloudMessage): string {
  const a = archive.value;
  if (!a) return 'Неизвестно';
  if (message.author_agent_id) {
    const agent = a.cloud.agents.find((item) => item.agent_id === message.author_agent_id);
    return agent?.name ?? 'Агент';
  }
  if (message.author_routine_id) {
    const routine = a.cloud.routines.find((item) => item.routine_id === message.author_routine_id);
    return routine?.name ?? 'Рутина';
  }
  return 'Вы';
}

function CloudChannelDetail({ channel }: { channel: CloudChannel }) {
  const a = archive.value;
  if (!a) return null;
  const messages = a.cloud.messages.filter((message) => message.channel_id === channel.channel_id);
  const agents = a.cloud.agents;

  return (
    <div class="view detail-view">
      <div class="detail-heading">
        <BackButton onClick={() => { selectedCloudChannel.value = null; }} label="К каналам" />
      </div>
      <header class="detail-header">
        <div>
          <h1>{channelName(channel)}</h1>
          <div class="chat-meta">
            <span>{countLabel(messages.length, ['сообщение', 'сообщения', 'сообщений'])}</span>
            <span>·</span>
            <span>{fmtDate(channel.created_at, true)}</span>
            {channel.visibility ? <><span>·</span><span class="muted">{channel.visibility}</span></> : null}
            {channel.memory_enabled ? <Badge tone="accent">память</Badge> : null}
          </div>
        </div>
      </header>
      {channelTopic(channel) ? <p class="muted">{channelTopic(channel)}</p> : null}

      <div class="cloud-messages">
        {messages.map((message) => (
          <article class="cloud-message" key={message.message_id}>
            <div class="message-head">
              <span class="avatar avatar-assistant">{authorName(message).slice(0, 1).toUpperCase()}</span>
              <span class="message-author">{authorName(message)}</span>
              <span class="muted small">{fmtDate(message.created_at, true)}</span>
              {message.attachments && message.attachments.length > 0 ? <Badge tone="muted">{message.attachments.length} вл.</Badge> : null}
            </div>
            <div class="message-body">
              {message.text ? <Markdown text={message.text} /> : null}
              {message.notice?.text ? <div class="alert alert-info">{message.notice.text}</div> : null}
              {message.reactions && message.reactions.length > 0 ? (
                <div class="muted small">{message.reactions.length} реакций</div>
              ) : null}
            </div>
          </article>
        ))}
        {messages.length === 0 ? <EmptyState title="Сообщений нет" /> : null}
      </div>

      {agents.length > 0 ? (
        <section class="panel">
          <div class="panel-heading"><h2>Агенты канала</h2></div>
          <div class="file-chips">
            {agents.map((agent) => <span class="chip" key={agent.agent_id}>{agent.name}</span>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function transcriptText(entry: CloudTranscript): string {
  const parts: string[] = [];
  for (const block of entry.content) {
    if (block.type === 'text') parts.push(String(block.text ?? ''));
    else if (block.type === 'tool_use') parts.push(`[tool: ${String(block.name ?? '')}]`);
    else if (block.type === 'tool_result') parts.push('[tool result]');
  }
  return parts.join(' ');
}

function CloudSessionDetail({ sessionId }: { sessionId: string }) {
  const a = archive.value;
  if (!a) return null;
  const entries = a.cloud.transcripts.filter((entry) => entry.session_id === sessionId);
  return (
    <div class="view detail-view">
      <div class="detail-heading">
        <BackButton onClick={() => { selectedCloudSession.value = null; }} label="К транскриптам" />
      </div>
      <header class="detail-header">
        <div>
          <h1 class="mono">{sessionId}</h1>
          <div class="chat-meta">
            <span>{countLabel(entries.length, ['запись', 'записи', 'записей'])}</span>
            <span>·</span>
            <span>{fmtDate(entries[0]?.created_at, true)}</span>
          </div>
        </div>
      </header>
      <div class="messages">
        {entries.map((entry, index) => (
          <article class={`message message-${entry.role === 'user' ? 'human' : 'assistant'}`} key={`${entry.session_id}:${entry.part}:${index}`}>
            <div class="message-head">
              <span class={`avatar avatar-${entry.role === 'user' ? 'human' : 'assistant'}`}>{entry.role === 'user' ? 'U' : 'A'}</span>
              <span class="message-author">{entry.role === 'user' ? 'Пользователь' : 'Агент'}</span>
              <span class="muted small">{fmtDate(entry.created_at, true)}</span>
              <Badge tone="muted">часть {entry.part + 1} / {entry.parts}</Badge>
            </div>
            <div class="message-body">
              {entry.content.map((block, blockIndex) => {
                if (block.type === 'text') return <Markdown key={blockIndex} text={String(block.text ?? '')} />;
                if (block.type === 'tool_use') {
                  return (
                    <Collapsible key={blockIndex} summary={<><Icon name="code" size={15} /> {String(block.name ?? 'tool')}</>} className="tool-block">
                      <CodeBlock value={block.input ?? {}} />
                    </Collapsible>
                  );
                }
                if (block.type === 'tool_result') {
                  return (
                    <Collapsible key={blockIndex} summary={<><Icon name="code" size={15} /> Результат инструмента</>} className="tool-block">
                      <CodeBlock value={block.content ?? ''} />
                    </Collapsible>
                  );
                }
                return null;
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ChannelsList() {
  const a = archive.value;
  if (!a) return null;
  if (a.cloud.channels.length === 0) {
    return <EmptyState title="Каналов нет" text="Загрузите claude_code_cloud-000.zip." icon="cloud" />;
  }
  return (
    <div class="cloud-grid">
      {a.cloud.channels.map((channel) => {
        const messages = a.cloud.messages.filter((message) => message.channel_id === channel.channel_id);
        return (
          <button type="button" class="project-card" key={channel.channel_id} onClick={() => { selectedCloudChannel.value = channel.channel_id; }}>
            <div class="project-card-top">
              <span class="project-icon"><Icon name="cloud" size={20} /></span>
              <span class="muted small">{fmtDate(channel.created_at)}</span>
            </div>
            <h3>{channelName(channel)}</h3>
            <p class="muted small">{channelTopic(channel) || 'Без темы'}</p>
            <div class="project-card-bottom">
              <Badge tone="muted">{countLabel(messages.length, ['сообщение', 'сообщения', 'сообщений'])}</Badge>
              {channel.memory_enabled ? <Badge tone="accent">память</Badge> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AgentsList() {
  const a = archive.value;
  if (!a) return null;
  if (a.cloud.agents.length === 0) return <EmptyState title="Агентов нет" icon="account" />;
  return (
    <div class="panel-list">
      {a.cloud.agents.map((agent) => (
        <section class="panel" key={agent.agent_id}>
          <div class="panel-heading">
            <h2>{agent.name}</h2>
            <Badge tone="muted">{agent.agent_id}</Badge>
          </div>
          {agent.description ? <p class="muted">{agent.description}</p> : null}
          {agent.instructions ? <Markdown text={agent.instructions} /> : <p class="muted small">Инструкции не экспортированы.</p>}
        </section>
      ))}
    </div>
  );
}

function RoutinesList() {
  const a = archive.value;
  if (!a) return null;
  if (a.cloud.routines.length === 0) return <EmptyState title="Рутин нет" icon="clock" />;
  return (
    <div class="panel-list">
      {a.cloud.routines.map((routine) => {
        const runs = a.cloud.routineRuns.filter((run) => run.routine_id === routine.routine_id);
        return (
          <section class="panel" key={routine.routine_id}>
            <div class="panel-heading">
              <h2>{routine.name}</h2>
              <Badge tone={routine.enabled ? 'ok' : 'muted'}>{routine.enabled ? 'включена' : 'выключена'}</Badge>
            </div>
            {routine.prompt ? <Markdown text={routine.prompt} /> : <p class="muted small">Промпт не экспортирован.</p>}
            <div class="chat-meta">
              <span>{routine.schedule?.cron ?? routine.schedule?.run_once_at ?? 'без расписания'}</span>
              <span>·</span>
              <span>{countLabel(runs.length, ['запуск', 'запуска', 'запусков'])}</span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TranscriptsList() {
  const a = archive.value;
  if (!a) return null;
  const sessions = new Map<string, CloudTranscript[]>();
  for (const entry of a.cloud.transcripts) {
    const list = sessions.get(entry.session_id);
    if (list) list.push(entry);
    else sessions.set(entry.session_id, [entry]);
  }
  if (sessions.size === 0) return <EmptyState title="Транскриптов нет" icon="code" />;
  return (
    <div class="session-list">
      {[...sessions.entries()].map(([sessionId, entries]) => (
        <button type="button" class="session-item" key={sessionId} onClick={() => { selectedCloudSession.value = sessionId; }}>
          <div>
            <strong class="mono">{sessionId}</strong>
            <div class="muted small">
              {countLabel(entries.length, ['запись', 'записи', 'записей'])} · {fmtDate(entries[0]?.created_at, true)}
            </div>
          </div>
          <span class="muted small">{entries.slice(0, 1).map(transcriptText).join('').slice(0, 80)}</span>
          <Icon name="chevron" size={16} />
        </button>
      ))}
    </div>
  );
}

export function CloudView() {
  const a = archive.value;
  if (!a) return null;

  if (selectedCloudChannel.value) {
    const channel = a.cloud.channels.find((item) => item.channel_id === selectedCloudChannel.value);
    if (channel) return <CloudChannelDetail channel={channel} />;
  }
  if (selectedCloudSession.value) return <CloudSessionDetail sessionId={selectedCloudSession.value} />;

  return (
    <div class="view">
      <div class="view-heading">
        <div>
          <h1>Claude Code Cloud</h1>
          <p class="muted">
            {countLabel(a.cloud.channels.length, ['канал', 'канала', 'каналов'])} · {countLabel(a.cloud.messages.length, ['сообщение', 'сообщения', 'сообщений'])} · {countLabel(a.cloud.transcripts.length, ['запись', 'записи', 'записей'])}
          </p>
        </div>
      </div>
      <div class="tabs">
        <button type="button" class={`tab ${cloudTab.value === 'channels' ? 'active' : ''}`} onClick={() => { cloudTab.value = 'channels'; }}>Каналы <span class="tab-count">{a.cloud.channels.length}</span></button>
        <button type="button" class={`tab ${cloudTab.value === 'agents' ? 'active' : ''}`} onClick={() => { cloudTab.value = 'agents'; }}>Агенты <span class="tab-count">{a.cloud.agents.length}</span></button>
        <button type="button" class={`tab ${cloudTab.value === 'routines' ? 'active' : ''}`} onClick={() => { cloudTab.value = 'routines'; }}>Рутины <span class="tab-count">{a.cloud.routines.length}</span></button>
        <button type="button" class={`tab ${cloudTab.value === 'transcripts' ? 'active' : ''}`} onClick={() => { cloudTab.value = 'transcripts'; }}>Транскрипты <span class="tab-count">{a.cloud.transcripts.length}</span></button>
      </div>
      {cloudTab.value === 'channels' ? <ChannelsList /> : null}
      {cloudTab.value === 'agents' ? <AgentsList /> : null}
      {cloudTab.value === 'routines' ? <RoutinesList /> : null}
      {cloudTab.value === 'transcripts' ? <TranscriptsList /> : null}
    </div>
  );
}
