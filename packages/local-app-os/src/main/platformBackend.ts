import type {
  AppId,
  AppManifest,
  AppPackageSummary,
  PlatformApiRequest,
  PlatformApiResponse,
  PlatformEvent,
  PlatformJobRun,
  PlatformLogEntry,
  PlatformSnapshot,
  PlatformWindow,
  StorageRecord,
  VirtualFile,
} from '../shared/platformTypes';

type BackendListener = (snapshot: PlatformSnapshot) => void;

const now = () => new Date().toISOString();

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const manifests: AppManifest[] = [
  {
    id: 'builder',
    name: 'Builder',
    version: '0.0.1',
    icon: 'spark',
    description: 'Bootstrap app for building and modifying local apps with Pi.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Builder',
          defaultSize: { width: 620, height: 520 },
          minSize: { width: 420, height: 360 },
          singleton: true,
        },
      ],
      jobs: [{ key: 'resume-drafts', title: 'Resume app drafts', trigger: 'shell-start' }],
      startOnShellStart: true,
    },
    contributes: [
      { id: 'builder.new-app', appId: 'builder', type: 'command', title: 'Build new app' },
      { id: 'builder.dock', appId: 'builder', type: 'dock-item', title: 'Builder' },
    ],
    permissions: ['storage:read', 'storage:write', 'files:read', 'files:write', 'events:emit'],
  },
  {
    id: 'chat',
    name: 'Chat',
    version: '0.0.1',
    icon: 'chat',
    description: 'Conversation harness for direct agent work.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Chat',
          defaultSize: { width: 560, height: 500 },
          singleton: true,
        },
      ],
    },
    contributes: [{ id: 'chat.dock', appId: 'chat', type: 'dock-item', title: 'Chat' }],
    permissions: ['storage:read', 'storage:write', 'events:emit'],
  },
  {
    id: 'apps',
    name: 'Apps',
    version: '0.0.1',
    icon: 'grid',
    description: 'Install, inspect, package, and launch local apps.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Apps',
          defaultSize: { width: 760, height: 500 },
          singleton: true,
        },
      ],
    },
    contributes: [
      { id: 'apps.package', appId: 'apps', type: 'command', title: 'Package selected app' },
      { id: 'apps.dock', appId: 'apps', type: 'dock-item', title: 'Apps' },
    ],
    permissions: ['storage:read', 'files:read', 'files:write'],
  },
  {
    id: 'control-panel',
    name: 'Control Panel',
    version: '0.0.1',
    icon: 'sliders',
    description: 'Providers, secrets, permissions, network policy, and system settings.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Control Panel',
          defaultSize: { width: 620, height: 460 },
          singleton: true,
        },
      ],
    },
    contributes: [{ id: 'control-panel.dock', appId: 'control-panel', type: 'dock-item', title: 'Control Panel' }],
    permissions: ['secrets:read', 'network:fetch'],
  },
  {
    id: 'activity',
    name: 'Activity',
    version: '0.0.1',
    icon: 'pulse',
    description: 'Activity monitor for app windows, services, jobs, and agent runs.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Activity',
          defaultSize: { width: 620, height: 420 },
          singleton: true,
        },
      ],
    },
    contributes: [{ id: 'activity.dock', appId: 'activity', type: 'dock-item', title: 'Activity' }],
    permissions: ['events:subscribe'],
  },
  {
    id: 'logs',
    name: 'Logs',
    version: '0.0.1',
    icon: 'log',
    description: 'System and app logs.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Logs',
          defaultSize: { width: 680, height: 420 },
          singleton: true,
        },
      ],
    },
    contributes: [{ id: 'logs.dock', appId: 'logs', type: 'dock-item', title: 'Logs' }],
    permissions: ['storage:read'],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    version: '0.0.1',
    icon: 'compass',
    description: 'Example generated app installed into the local desktop.',
    entry: {
      windows: [
        {
          key: 'main',
          title: 'Navigation',
          defaultSize: { width: 420, height: 360 },
          singleton: true,
        },
      ],
    },
    contributes: [
      { id: 'navigation.route', appId: 'navigation', type: 'command', title: 'Plan route' },
      { id: 'navigation.dock', appId: 'navigation', type: 'dock-item', title: 'Navigation' },
    ],
    permissions: ['storage:read', 'storage:write', 'network:fetch'],
  },
];

export class PlatformBackend {
  private readonly listeners = new Set<BackendListener>();
  private readonly windows = new Map<string, PlatformWindow>();
  private readonly storage = new Map<string, StorageRecord>();
  private readonly files = new Map<string, VirtualFile>();
  private readonly events: PlatformEvent[] = [];
  private readonly jobs: PlatformJobRun[] = [];
  private readonly logs: PlatformLogEntry[] = [];
  private readonly packages: AppPackageSummary[] = [];

  constructor() {
    this.writeSeedData();
    this.launch('builder');
    this.launch('navigation');
    this.writeLog('system', 'info', 'Shell started');
    this.runShellStartJobs();
  }

  subscribe(listener: BackendListener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  handle(request: PlatformApiRequest): PlatformApiResponse {
    switch (request.type) {
      case 'snapshot':
        return this.snapshot();
      case 'apps.launch':
        return this.launch(request.appId);
      case 'apps.quit':
        return this.quit(request.appId);
      case 'windows.focus':
        return this.focus(request.windowId);
      case 'windows.close':
        return this.closeWindow(request.windowId);
      case 'windows.setBounds':
        return this.setBounds(request.windowId, request.bounds);
      case 'storage.get':
        return this.storage.get(this.storageKey(request.appId, request.collection, request.key)) ?? null;
      case 'storage.set':
        return this.setStorage(request.appId, request.collection, request.key, request.value);
      case 'storage.delete':
        return this.deleteStorage(request.appId, request.collection, request.key);
      case 'storage.query':
        return this.queryStorage(request.appId, request.collection);
      case 'files.read':
        return this.files.get(this.fileKey(request.appId, request.path)) ?? null;
      case 'files.write':
        return this.writeFile(request.appId, request.path, request.content);
      case 'files.list':
        return this.listFiles(request.appId, request.dir);
      case 'events.emit':
        return this.emitEvent(request.event);
      case 'jobs.runNow':
        return this.runJob(request.appId, request.jobKey);
      case 'logs.write':
        return this.writeLog(request.entry.appId, request.entry.level, request.entry.message);
      case 'packages.create':
        return this.createPackage(request.appId);
      default:
        return null;
    }
  }

  snapshot(): PlatformSnapshot {
    return {
      apps: manifests,
      windows: Array.from(this.windows.values()),
      jobs: [...this.jobs],
      logs: [...this.logs].slice(-80).reverse(),
      packages: [...this.packages].reverse(),
      events: [...this.events].slice(-80).reverse(),
    };
  }

  private writeSeedData() {
    this.setStorage('navigation', 'places', 'home', { label: 'Home', kind: 'favorite' }, false);
    this.setStorage('navigation', 'places', 'studio', { label: 'Studio', kind: 'favorite' }, false);
    this.writeFile('builder', '/app/README.md', 'Builder app source and generated app notes live here.', false);
    this.writeFile('navigation', '/app/routes.json', JSON.stringify([{ from: 'Home', to: 'Studio' }], null, 2), false);
  }

  private launch(appId: AppId) {
    const manifest = this.getManifest(appId);
    const definition = manifest.entry.windows[0];
    if (definition.singleton) {
      const existing = Array.from(this.windows.values()).find((window) => window.appId === appId && window.key === definition.key);
      if (existing) {
        return this.focus(existing.id);
      }
    }

    const offset = this.windows.size * 34;
    const window: PlatformWindow = {
      id: createId('win'),
      appId,
      key: definition.key,
      title: definition.title,
      bounds: {
        x: 96 + offset,
        y: 82 + offset,
        width: definition.defaultSize.width,
        height: definition.defaultSize.height,
      },
      minimized: false,
      focused: false,
      createdAt: now(),
    };
    this.windows.set(window.id, window);
    this.writeLog(appId, 'info', `${manifest.name} launched`, false);
    this.emitEvent({ type: 'apps.launched', sourceAppId: 'system', payload: { appId } }, false);
    this.focus(window.id, false);
    this.notify();
    return window;
  }

  private quit(appId: AppId) {
    for (const [windowId, window] of this.windows) {
      if (window.appId === appId) {
        this.windows.delete(windowId);
      }
    }
    this.writeLog(appId, 'info', `${this.getManifest(appId).name} quit`, false);
    this.emitEvent({ type: 'apps.quit', sourceAppId: 'system', payload: { appId } }, false);
    this.notify();
    return Array.from(this.windows.values());
  }

  private focus(windowId: string, shouldNotify = true) {
    const selected = this.windows.get(windowId);
    if (!selected) {
      return null;
    }
    for (const window of this.windows.values()) {
      window.focused = window.id === windowId;
      if (window.id === windowId) {
        window.minimized = false;
      }
    }
    this.windows.delete(windowId);
    this.windows.set(windowId, selected);
    if (shouldNotify) {
      this.notify();
    }
    return selected;
  }

  private closeWindow(windowId: string) {
    const window = this.windows.get(windowId);
    if (!window) {
      return Array.from(this.windows.values());
    }
    this.windows.delete(windowId);
    this.writeLog(window.appId, 'info', `${window.title} closed`, false);
    this.notify();
    return Array.from(this.windows.values());
  }

  private setBounds(windowId: string, bounds: PlatformWindow['bounds']) {
    const window = this.windows.get(windowId);
    if (!window) {
      return null;
    }
    window.bounds = bounds;
    this.notify();
    return window;
  }

  private setStorage(appId: AppId, collection: string, key: string, value: unknown, shouldNotify = true) {
    const record: StorageRecord = {
      appId,
      collection,
      key,
      value,
      updatedAt: now(),
    };
    this.storage.set(this.storageKey(appId, collection, key), record);
    if (shouldNotify) {
      this.writeLog(appId, 'info', `Storage updated: ${collection}/${key}`, false);
      this.notify();
    }
    return record;
  }

  private deleteStorage(appId: AppId, collection: string, key: string) {
    this.storage.delete(this.storageKey(appId, collection, key));
    this.writeLog(appId, 'info', `Storage deleted: ${collection}/${key}`, false);
    this.notify();
    return null;
  }

  private queryStorage(appId: AppId, collection: string) {
    return Array.from(this.storage.values()).filter((record) => record.appId === appId && record.collection === collection);
  }

  private writeFile(appId: AppId, path: string, content: string, shouldNotify = true) {
    const file: VirtualFile = { appId, path, content, updatedAt: now() };
    this.files.set(this.fileKey(appId, path), file);
    if (shouldNotify) {
      this.writeLog(appId, 'info', `File written: ${path}`, false);
      this.notify();
    }
    return file;
  }

  private listFiles(appId: AppId, dir: string) {
    const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`;
    return Array.from(this.files.values()).filter((file) => file.appId === appId && file.path.startsWith(normalizedDir));
  }

  private emitEvent(event: Omit<PlatformEvent, 'id' | 'createdAt'>, shouldNotify = true) {
    const fullEvent: PlatformEvent = {
      ...event,
      id: createId('evt'),
      createdAt: now(),
    };
    this.events.push(fullEvent);
    if (shouldNotify) {
      this.notify();
    }
    return fullEvent;
  }

  private runJob(appId: AppId, jobKey: string) {
    const run: PlatformJobRun = {
      id: createId('job'),
      appId,
      jobKey,
      status: 'completed',
      startedAt: now(),
      finishedAt: now(),
      summary: 'Demo job completed immediately',
    };
    this.jobs.push(run);
    this.writeLog(appId, 'info', `Job completed: ${jobKey}`, false);
    this.emitEvent({ type: 'jobs.completed', sourceAppId: 'system', payload: run }, false);
    this.notify();
    return run;
  }

  private runShellStartJobs() {
    for (const manifest of manifests) {
      for (const job of manifest.entry.jobs ?? []) {
        if (job.trigger === 'shell-start') {
          this.runJob(manifest.id, job.key);
        }
      }
    }
  }

  private writeLog(appId: PlatformLogEntry['appId'], level: PlatformLogEntry['level'], message: string, shouldNotify = true) {
    const entry: PlatformLogEntry = {
      id: createId('log'),
      appId,
      level,
      message,
      createdAt: now(),
    };
    this.logs.push(entry);
    if (shouldNotify) {
      this.notify();
    }
    return entry;
  }

  private createPackage(appId: AppId) {
    const manifest = this.getManifest(appId);
    const summary: AppPackageSummary = {
      id: createId('pkg'),
      appId,
      appName: manifest.name,
      version: manifest.version,
      fileCount: Array.from(this.files.values()).filter((file) => file.appId === appId).length,
      createdAt: now(),
    };
    this.packages.push(summary);
    this.writeLog(appId, 'info', `Package created for ${manifest.name}`, false);
    this.emitEvent({ type: 'packages.created', sourceAppId: 'system', payload: summary }, false);
    this.notify();
    return summary;
  }

  private getManifest(appId: AppId) {
    const manifest = manifests.find((candidate) => candidate.id === appId);
    if (!manifest) {
      throw new Error(`Unknown app: ${appId}`);
    }
    return manifest;
  }

  private storageKey(appId: AppId, collection: string, key: string) {
    return `${appId}:${collection}:${key}`;
  }

  private fileKey(appId: AppId, path: string) {
    return `${appId}:${path}`;
  }

  private notify() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
