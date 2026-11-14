export interface ManifestFile {
  batch_index: number;
  export_url: string;
  category: string;
  part: number;
  filename: string;
}

export interface Manifest {
  instructions?: string;
  created_at: string;
  total_files: number;
  data_files: ManifestFile[];
  version: string;
}

export interface User {
  uuid: string;
  full_name: string;
  email_address: string;
  verified_phone_number: string;
}

export interface LoginEvent {
  account_uuid: string;
  timestamp: string;
  ip_address: string;
  user_agent: {
    browser_family: string;
    browser_version: string;
    os_family: string;
    os_version: string;
    device_family: string;
  };
  method: string;
  location_info: {
    country: string;
    region: string | null;
    city: string | null;
  };
}

export interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

export interface Attachment {
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content?: string;
}

export interface FileRef {
  file_uuid: string;
  file_name: string;
}

export interface Message {
  uuid: string;
  text: string;
  content: ContentBlock[];
  sender: 'human' | 'assistant' | string;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
  files: FileRef[];
  parent_message_uuid: string | null;
}

export interface Conversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: { uuid: string };
  chat_messages: Message[];
  project_uuid?: string;
  model?: string;
}

export interface ProjectDoc {
  uuid: string;
  filename: string;
  content: string;
  created_at: string;
}

export interface Project {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  is_starter_project: boolean;
  prompt_template: string;
  created_at: string;
  updated_at: string;
  creator: { uuid: string; full_name: string };
  docs: ProjectDoc[];
}

export interface MemoryFile {
  path: string;
  content: string;
  updated_at: string;
}

export interface MemoryArchive {
  account_uuid: string;
  memory_files: MemoryFile[];
}

export interface Reflection {
  period: string;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FeedbackArchive {
  account_uuid: string;
  reflections: Reflection[];
  feedback: unknown[];
}

export interface FrameVersionMeta {
  id: string;
  title: string;
  description?: string;
  created_at: string;
}

export interface FrameFileEntry {
  path: string;
  size: number;
  mime?: string;
  sha256?: string;
  data?: Uint8Array;
}

export interface FrameVersion extends FrameVersionMeta {
  files: FrameFileEntry[];
  pageMd?: string;
}

export interface FrameArtifact {
  id: string;
  kind: string;
  visibility?: string;
  versions: FrameVersion[];
  activeVersion?: string;
  ownerAccount?: string;
  updatedAt?: string;
  comments?: unknown;
  artifactComments?: unknown;
}

export interface CloudChannel {
  channel_id: string;
  owner_account_uuid?: string;
  created_by_account_uuid?: string;
  visibility?: string;
  content?: Record<string, unknown>;
  agent?: unknown;
  proactivity_level?: unknown;
  memory_enabled?: boolean;
  tasks_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  paused_at?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}

export interface CloudChannelMembership {
  channel_id: string;
  account_uuid: string;
  role: string;
  joined_at: string;
  left_at: string | null;
}

export interface CloudMessage {
  message_id: string;
  channel_id: string;
  thread_root_message_id?: string | null;
  in_reply_to_message_id?: string | null;
  in_timeline?: boolean;
  author_account_uuid?: string | null;
  author_agent_id?: string | null;
  author_routine_id?: string | null;
  relayed_from_routine_id?: string | null;
  body_format?: string;
  text?: string | null;
  notice?: { text?: string } | null;
  created_at?: string;
  edited_at?: string | null;
  resolved_at?: string | null;
  resolved_by_account_uuid?: string | null;
  attachments?: unknown[];
  mentions?: unknown[];
  reactions?: unknown[];
  [key: string]: unknown;
}

export interface CloudAgent {
  agent_id: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  instructions_withheld?: boolean;
  instructions_app_text_left_out?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CloudRoutine {
  routine_id: string;
  agent_id?: string | null;
  name: string;
  prompt: string;
  prompt_withheld?: boolean;
  enabled?: boolean;
  schedule?: { cron?: string | null; run_once_at?: string };
  created_at?: string;
  updated_at?: string;
  ended_at?: string;
}

export interface CloudRoutineRun {
  routine_id: string;
  scheduled_for?: string;
  started_at?: string;
  finished_at?: string;
  status?: string;
  session_id?: string;
}

export interface CloudProjectFile {
  project_id: string;
  path: string;
  folder: boolean;
  size_bytes?: number | null;
  saved_at?: string;
  account_uuid?: string;
}

export interface CloudMemoryFile {
  account_uuid: string;
  channel: string;
  path: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export interface CloudTranscript {
  session_id: string;
  created_at: string;
  role: string;
  content: ContentBlock[];
  part: number;
  parts: number;
}

export interface CloudData {
  channels: CloudChannel[];
  memberships: CloudChannelMembership[];
  messages: CloudMessage[];
  agents: CloudAgent[];
  routines: CloudRoutine[];
  routineRuns: CloudRoutineRun[];
  projectFiles: CloudProjectFile[];
  memoryFiles: CloudMemoryFile[];
  transcripts: CloudTranscript[];
}

export interface InlineArtifactVersion {
  version_uuid: string;
  command: string;
  title?: string;
  type?: string;
  language?: string;
  content: string;
  createdAt?: string;
  messageUuid: string;
  conversationUuid: string;
  error?: string;
}

export interface InlineArtifact {
  id: string;
  title: string;
  type?: string;
  language?: string;
  conversationUuid: string;
  conversationName: string;
  versions: InlineArtifactVersion[];
  content: string;
  error?: string;
}

export interface ArchiveFileEntry {
  path: string;
  size: number;
  category: string;
  text?: string;
  isText: boolean;
  source?: string;
  sourceId?: string;
}

export interface ArchiveSource {
  id: string;
  filename: string;
  category: string;
  size: number;
  importedAt: string;
  entries: number;
}

export interface ArchiveStats {
  conversations: number;
  messages: number;
  projects: number;
  frames: number;
  frameVersions: number;
  inlineArtifacts: number;
  memories: number;
  reflections: number;
  cloudChannels: number;
  cloudMessages: number;
  cloudTranscripts: number;
  files: number;
  totalBytes: number;
  missingFiles: number;
  blockCounts: Record<string, number>;
}

export interface Archive {
  manifest?: Manifest;
  conversations: Conversation[];
  projects: Project[];
  frames: FrameArtifact[];
  inlineArtifacts: InlineArtifact[];
  memories: MemoryFile[];
  reflections: Reflection[];
  users: User[];
  loginEvents: LoginEvent[];
  cloud: CloudData;
  files: ArchiveFileEntry[];
  sources: ArchiveSource[];
  warnings: string[];
  stats: ArchiveStats;
  rawFiles: Map<string, Uint8Array>;
}

export interface ImportProgress {
  stage: string;
  current: number;
  total: number;
  detail?: string;
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

export interface ChatExportOptions {
  includeThinking: boolean;
  includeTools: boolean;
  includeToolResults: boolean;
  includeAttachments: boolean;
  includeArtifacts: boolean;
}

export const DEFAULT_CHAT_EXPORT_OPTIONS: ChatExportOptions = {
  includeThinking: true,
  includeTools: true,
  includeToolResults: false,
  includeAttachments: true,
  includeArtifacts: true,
};
