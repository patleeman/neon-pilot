export type AppId = 'builder' | 'chat' | 'apps' | 'control-panel' | 'activity' | 'logs' | 'navigation';

export type PlatformContributionType =
  | 'command'
  | 'dock-item'
  | 'settings-pane'
  | 'tool'
  | 'file-handler'
  | 'job'
  | 'notification-action'
  | 'context-action';

export type PlatformPermission =
  | 'storage:read'
  | 'storage:write'
  | 'files:read'
  | 'files:write'
  | 'network:fetch'
  | 'jobs:schedule'
  | 'services:background'
  | 'secrets:read'
  | 'events:emit'
  | 'events:subscribe';

export type AppManifest = {
  id: AppId;
  name: string;
  version: string;
  icon: string;
  description: string;
  entry: {
    windows: WindowDefinition[];
    services?: ServiceDefinition[];
    jobs?: JobDefinition[];
    startOnShellStart?: boolean;
  };
  contributes: PlatformContribution[];
  permissions: PlatformPermission[];
};

export type WindowDefinition = {
  key: string;
  title: string;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  resizable?: boolean;
  singleton?: boolean;
};

export type ServiceDefinition = {
  name: string;
  methods: string[];
};

export type JobDefinition = {
  key: string;
  title: string;
  trigger: 'manual' | 'cron' | 'interval' | 'shell-start' | 'event';
};

export type PlatformContribution = {
  id: string;
  appId: AppId;
  type: PlatformContributionType;
  title: string;
  metadata?: Record<string, unknown>;
};

export type PlatformWindow = {
  id: string;
  appId: AppId;
  key: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  minimized: boolean;
  focused: boolean;
  createdAt: string;
};

export type StorageRecord = {
  appId: AppId;
  collection: string;
  key: string;
  value: unknown;
  updatedAt: string;
};

export type VirtualFile = {
  appId: AppId;
  path: string;
  content: string;
  updatedAt: string;
};

export type PlatformEvent = {
  id: string;
  type: string;
  sourceAppId: AppId | 'system';
  payload: unknown;
  createdAt: string;
};

export type PlatformJobRun = {
  id: string;
  appId: AppId;
  jobKey: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt?: string;
  summary?: string;
};

export type PlatformLogEntry = {
  id: string;
  appId: AppId | 'system';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
};

export type AppPackageSummary = {
  id: string;
  appId: AppId;
  appName: string;
  version: string;
  fileCount: number;
  createdAt: string;
};

export type PlatformSnapshot = {
  apps: AppManifest[];
  windows: PlatformWindow[];
  jobs: PlatformJobRun[];
  logs: PlatformLogEntry[];
  packages: AppPackageSummary[];
  events: PlatformEvent[];
};

export type PlatformApiRequest =
  | { type: 'snapshot' }
  | { type: 'apps.launch'; appId: AppId }
  | { type: 'apps.quit'; appId: AppId }
  | { type: 'windows.focus'; windowId: string }
  | { type: 'windows.close'; windowId: string }
  | { type: 'windows.setBounds'; windowId: string; bounds: PlatformWindow['bounds'] }
  | { type: 'storage.get'; appId: AppId; collection: string; key: string }
  | { type: 'storage.set'; appId: AppId; collection: string; key: string; value: unknown }
  | { type: 'storage.delete'; appId: AppId; collection: string; key: string }
  | { type: 'storage.query'; appId: AppId; collection: string }
  | { type: 'files.read'; appId: AppId; path: string }
  | { type: 'files.write'; appId: AppId; path: string; content: string }
  | { type: 'files.list'; appId: AppId; dir: string }
  | { type: 'events.emit'; event: Omit<PlatformEvent, 'id' | 'createdAt'> }
  | { type: 'jobs.runNow'; appId: AppId; jobKey: string }
  | { type: 'logs.write'; entry: Omit<PlatformLogEntry, 'id' | 'createdAt'> }
  | { type: 'packages.create'; appId: AppId };

export type PlatformApiResponse =
  | PlatformSnapshot
  | PlatformWindow[]
  | PlatformWindow
  | StorageRecord
  | StorageRecord[]
  | VirtualFile
  | VirtualFile[]
  | PlatformEvent
  | PlatformJobRun
  | PlatformLogEntry
  | AppPackageSummary
  | unknown
  | null;

export type PlatformBridge = {
  invoke(request: PlatformApiRequest): Promise<PlatformApiResponse>;
  onUpdate(listener: (snapshot: PlatformSnapshot) => void): () => void;
};
