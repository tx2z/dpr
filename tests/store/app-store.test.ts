import { describe, it, expect, beforeEach } from 'vitest';

import { createAppStore } from '../../src/store/app-store.js';

import type { Config, LogLine } from '../../src/config/types.js';
import type { AppStoreApi } from '../../src/store/app-store.js';

const createTestConfig = (): Config => ({
  global: {
    name: 'Test Project',
    columns: 'auto',
    logs: false,
    logsDir: '~/.dpr/logs',
  },
  services: [
    {
      id: 'api',
      name: 'API Server',
      dir: '.',
      start: 'npm run api',
      stop: null,
      autostart: false,
      color: 'green',
      logs: false,
      env: {},
      dependsOn: [],
      readyPattern: null,
      readyDelay: 500,
      scripts: [],
      runOnce: false,
      keepRunning: false,
    },
    {
      id: 'web',
      name: 'Web Server',
      dir: '.',
      start: 'npm run web',
      stop: null,
      autostart: false,
      color: 'blue',
      logs: false,
      env: {},
      dependsOn: ['api'],
      readyPattern: null,
      readyDelay: 500,
      scripts: [],
      runOnce: false,
      keepRunning: false,
    },
  ],
});

describe('createAppStore', () => {
  let store: AppStoreApi;
  let config: Config;

  beforeEach(() => {
    config = createTestConfig();
    store = createAppStore(config);
  });

  it('should initialize with config', () => {
    const state = store.getState();
    expect(state.config).toEqual(config);
  });

  it('should initialize services with stopped state', () => {
    const state = store.getState();
    expect(state.services['api']?.state.status).toBe('stopped');
    expect(state.services['web']?.state.status).toBe('stopped');
  });

  it('should initialize with null focused space', () => {
    const state = store.getState();
    expect(state.focusedSpaceIndex).toBeNull();
  });

  it('should initialize in normal mode', () => {
    const state = store.getState();
    expect(state.mode).toBe('normal');
  });
});

describe('store actions', () => {
  let store: AppStoreApi;

  beforeEach(() => {
    store = createAppStore(createTestConfig());
  });

  describe('setFocusedSpace', () => {
    it('should set focused space index', () => {
      store.getState().setFocusedSpace(0);
      expect(store.getState().focusedSpaceIndex).toBe(0);
    });

    it('should clear focus with null', () => {
      store.getState().setFocusedSpace(0);
      store.getState().setFocusedSpace(null);
      expect(store.getState().focusedSpaceIndex).toBeNull();
    });
  });

  describe('setMode', () => {
    it('should set mode to command', () => {
      store.getState().setMode('command');
      expect(store.getState().mode).toBe('command');
    });

    it('should clear command input when changing mode', () => {
      store.getState().setCommandInput('test');
      store.getState().setMode('normal');
      expect(store.getState().commandInput).toBe('');
    });
  });

  describe('setCommandInput', () => {
    it('should update command input', () => {
      store.getState().setCommandInput('start api');
      expect(store.getState().commandInput).toBe('start api');
    });
  });

  describe('updateServiceState', () => {
    it('should update service status', () => {
      store.getState().updateServiceState('api', { status: 'starting' });
      expect(store.getState().services['api']?.state.status).toBe('starting');
    });

    it('should update service pid', () => {
      store.getState().updateServiceState('api', { pid: 12345 });
      expect(store.getState().services['api']?.state.pid).toBe(12345);
    });

    it('should preserve other state properties', () => {
      store.getState().updateServiceState('api', { status: 'ready', pid: 123 });
      store.getState().updateServiceState('api', { status: 'stopping' });
      expect(store.getState().services['api']?.state.pid).toBe(123);
    });

    it('should ignore unknown service IDs', () => {
      const stateBefore = store.getState().services;
      store.getState().updateServiceState('nonexistent', { status: 'ready' });
      expect(store.getState().services).toEqual(stateBefore);
    });
  });

  describe('appendLog', () => {
    const createLogLine = (content: string): LogLine => ({
      timestamp: new Date(),
      content,
      stream: 'stdout',
    });

    it('should append log to service', () => {
      store.getState().appendLog('api', createLogLine('hello'));
      expect(store.getState().services['api']?.logs).toHaveLength(1);
      expect(store.getState().services['api']?.logs[0]?.content).toBe('hello');
    });

    it('should append multiple logs', () => {
      store.getState().appendLog('api', createLogLine('line 1'));
      store.getState().appendLog('api', createLogLine('line 2'));
      expect(store.getState().services['api']?.logs).toHaveLength(2);
    });

    it('should trim logs to buffer size', () => {
      for (let i = 0; i < 1005; i++) {
        store.getState().appendLog('api', createLogLine(`line ${String(i)}`));
      }
      expect(store.getState().services['api']?.logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('clearLogs', () => {
    it('should clear service logs', () => {
      store
        .getState()
        .appendLog('api', { timestamp: new Date(), content: 'test', stream: 'stdout' });
      store.getState().clearLogs('api');
      expect(store.getState().services['api']?.logs).toHaveLength(0);
    });

    it('should reset scroll offset to follow the tail', () => {
      store.getState().setScrollOffset('api', 10);
      store.getState().clearLogs('api');
      expect(store.getState().services['api']?.scrollOffset).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('setScrollOffset', () => {
    it('should set scroll offset', () => {
      store.getState().setScrollOffset('api', 5);
      expect(store.getState().services['api']?.scrollOffset).toBe(5);
    });

    it('should not allow negative offset', () => {
      store.getState().setScrollOffset('api', -5);
      expect(store.getState().services['api']?.scrollOffset).toBe(0);
    });
  });

  describe('setSearchState', () => {
    it('should set search state', () => {
      const searchState = {
        term: 'error',
        serviceFilter: null,
        matches: [],
        currentMatchIndex: 0,
      };
      store.getState().setSearchState(searchState);
      expect(store.getState().searchState).toEqual(searchState);
    });

    it('should clear search state with null', () => {
      store
        .getState()
        .setSearchState({ term: 'test', serviceFilter: null, matches: [], currentMatchIndex: 0 });
      store.getState().setSearchState(null);
      expect(store.getState().searchState).toBeNull();
    });
  });

  describe('getServiceById', () => {
    it('should return service config by id', () => {
      const service = store.getState().getServiceById('api');
      expect(service?.id).toBe('api');
      expect(service?.name).toBe('API Server');
    });

    it('should return undefined for unknown id', () => {
      const service = store.getState().getServiceById('nonexistent');
      expect(service).toBeUndefined();
    });
  });

  describe('getServiceByIndex', () => {
    it('should return service config by index', () => {
      const service = store.getState().getServiceByIndex(0);
      expect(service?.id).toBe('api');
    });

    it('should return undefined for out of range index', () => {
      const service = store.getState().getServiceByIndex(99);
      expect(service).toBeUndefined();
    });
  });

  describe('getServiceRuntime', () => {
    it('should return service runtime', () => {
      const runtime = store.getState().getServiceRuntime('api');
      expect(runtime).toBeDefined();
      expect(runtime?.state.status).toBe('stopped');
    });

    it('should return undefined for unknown service', () => {
      const runtime = store.getState().getServiceRuntime('nonexistent');
      expect(runtime).toBeUndefined();
    });
  });

  describe('sidebar actions', () => {
    it('should initialize viewMode to grid for few services', () => {
      expect(store.getState().viewMode).toBe('grid');
    });

    it('should open the first service as a window initially', () => {
      expect(store.getState().sidebarState.openWindowIds).toEqual(['api']);
    });

    describe('setSidebarSelection', () => {
      it('should clamp selection within range', () => {
        store.getState().setSidebarSelection(5);
        expect(store.getState().sidebarState.selectedIndex).toBe(1);
        store.getState().setSidebarSelection(-3);
        expect(store.getState().sidebarState.selectedIndex).toBe(0);
      });
    });

    describe('openSidebarWindow', () => {
      it('should replace windows with the given service', () => {
        store.getState().openSidebarWindow('web');
        expect(store.getState().sidebarState.openWindowIds).toEqual(['web']);
        expect(store.getState().sidebarState.focusedWindowIndex).toBe(0);
      });
    });

    describe('toggleSidebarWindow', () => {
      it('should add a window when not open', () => {
        store.getState().toggleSidebarWindow('web');
        expect(store.getState().sidebarState.openWindowIds).toContain('web');
      });

      it('should remove a window when already open', () => {
        store.getState().toggleSidebarWindow('api');
        expect(store.getState().sidebarState.openWindowIds).not.toContain('api');
      });
    });

    describe('setFocusedWindow', () => {
      it('should clamp focus to open window range', () => {
        store.getState().toggleSidebarWindow('web');
        store.getState().setFocusedWindow(5);
        expect(store.getState().sidebarState.focusedWindowIndex).toBe(1);
      });
    });

    describe('closeFocusedWindow', () => {
      it('should remove the focused window and clamp focus', () => {
        store.getState().toggleSidebarWindow('web');
        store.getState().setFocusedWindow(1);
        store.getState().closeFocusedWindow();
        expect(store.getState().sidebarState.openWindowIds).toEqual(['api']);
        expect(store.getState().sidebarState.focusedWindowIndex).toBe(0);
      });
    });

    describe('setViewMode', () => {
      it('should switch the view mode', () => {
        store.getState().setViewMode('sidebar');
        expect(store.getState().viewMode).toBe('sidebar');
      });
    });
  });

  describe('notification actions', () => {
    describe('setNotification', () => {
      it('should set notification message', () => {
        store.getState().setNotification('Copied 5 lines');
        expect(store.getState().notification).toBe('Copied 5 lines');
      });

      it('should clear notification with null', () => {
        store.getState().setNotification('test');
        store.getState().setNotification(null);
        expect(store.getState().notification).toBeNull();
      });
    });
  });

  describe('fullscreen cursor actions', () => {
    describe('setFullscreenCursor', () => {
      it('should set fullscreen cursor for a service', () => {
        store.getState().setFullscreenCursor('api', 5);
        expect(store.getState().services['api']?.fullscreenCursor).toBe(5);
      });

      it('should update fullscreen cursor to a different value', () => {
        store.getState().setFullscreenCursor('api', 5);
        store.getState().setFullscreenCursor('api', 10);
        expect(store.getState().services['api']?.fullscreenCursor).toBe(10);
      });

      it('should clear fullscreen cursor with null', () => {
        store.getState().setFullscreenCursor('api', 5);
        store.getState().setFullscreenCursor('api', null);
        expect(store.getState().services['api']?.fullscreenCursor).toBeNull();
      });

      it('should not affect other services', () => {
        store.getState().setFullscreenCursor('api', 5);
        expect(store.getState().services['web']?.fullscreenCursor).toBeNull();
      });

      it('should ignore unknown service IDs', () => {
        const stateBefore = store.getState().services;
        store.getState().setFullscreenCursor('nonexistent', 5);
        expect(store.getState().services).toEqual(stateBefore);
      });

      it('should preserve other service state when setting cursor', () => {
        // Set some logs first
        store
          .getState()
          .appendLog('api', { timestamp: new Date(), content: 'test', stream: 'stdout' });
        store.getState().setScrollOffset('api', 10);

        store.getState().setFullscreenCursor('api', 5);

        const runtime = store.getState().services['api'];
        expect(runtime?.fullscreenCursor).toBe(5);
        expect(runtime?.logs).toHaveLength(1);
        expect(runtime?.scrollOffset).toBe(10);
      });
    });
  });

  describe('initial service state', () => {
    it('should initialize fullscreenCursor as null', () => {
      expect(store.getState().services['api']?.fullscreenCursor).toBeNull();
      expect(store.getState().services['web']?.fullscreenCursor).toBeNull();
    });
  });
});

const createManyServicesConfig = (count: number): Config => ({
  global: { name: 'Many', columns: 'auto', logs: false, logsDir: '~/.dpr/logs' },
  services: Array.from({ length: count }, (_, i) => ({
    id: `svc-${String(i)}`,
    name: `Service ${String(i)}`,
    dir: '.',
    start: 'npm start',
    stop: null,
    autostart: false,
    color: 'green' as const,
    logs: false,
    env: {},
    dependsOn: [],
    readyPattern: null,
    readyDelay: 500,
    scripts: [],
    runOnce: false,
    keepRunning: false,
  })),
});

describe('sidebar window cap and auto view mode', () => {
  it('should force sidebar view mode above the threshold', () => {
    const store = createAppStore(createManyServicesConfig(7));
    expect(store.getState().viewMode).toBe('sidebar');
  });

  it('should default to grid at or below the threshold', () => {
    const store = createAppStore(createManyServicesConfig(6));
    expect(store.getState().viewMode).toBe('grid');
  });

  it('should not open more than 4 windows', () => {
    const store = createAppStore(createManyServicesConfig(8));
    // svc-0 is open initially; add 3 more to reach 4, then the 5th is ignored
    store.getState().toggleSidebarWindow('svc-1');
    store.getState().toggleSidebarWindow('svc-2');
    store.getState().toggleSidebarWindow('svc-3');
    store.getState().toggleSidebarWindow('svc-4');
    expect(store.getState().sidebarState.openWindowIds).toHaveLength(4);
    expect(store.getState().sidebarState.openWindowIds).not.toContain('svc-4');
  });
});
