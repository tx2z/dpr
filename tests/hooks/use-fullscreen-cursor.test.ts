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

const createLogLine = (content: string): LogLine => ({
  timestamp: new Date(),
  content,
  stream: 'stdout',
});

const addLogLines = (store: AppStoreApi, serviceId: string, count: number): void => {
  for (let i = 0; i < count; i++) {
    store.getState().appendLog(serviceId, createLogLine(`Line ${String(i)}`));
  }
};

describe('fullscreen cursor functionality', () => {
  let store: AppStoreApi;

  beforeEach(() => {
    store = createAppStore(createTestConfig());
  });

  describe('cursor initialization', () => {
    it('should start with null cursor for all services', () => {
      expect(store.getState().services['api']?.fullscreenCursor).toBeNull();
      expect(store.getState().services['web']?.fullscreenCursor).toBeNull();
    });

    it('should maintain null cursor until explicitly set', () => {
      addLogLines(store, 'api', 50);
      expect(store.getState().services['api']?.fullscreenCursor).toBeNull();
    });
  });

  describe('cursor movement', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
    });

    it('should set cursor to specific line', () => {
      store.getState().setFullscreenCursor('api', 25);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(25);
    });

    it('should allow cursor at line 0', () => {
      store.getState().setFullscreenCursor('api', 0);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(0);
    });

    it('should allow cursor at last line', () => {
      store.getState().setFullscreenCursor('api', 99);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(99);
    });

    it('should allow moving cursor up', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setFullscreenCursor('api', 49);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(49);
    });

    it('should allow moving cursor down', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setFullscreenCursor('api', 51);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(51);
    });

    it('should allow page-sized jumps', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setFullscreenCursor('api', 40); // page up (10 lines)
      expect(store.getState().services['api']?.fullscreenCursor).toBe(40);
    });

    it('should allow jump to top (line 0)', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setFullscreenCursor('api', 0);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(0);
    });

    it('should allow jump to bottom', () => {
      store.getState().setFullscreenCursor('api', 0);
      store.getState().setFullscreenCursor('api', 99);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(99);
    });
  });

  describe('cursor persistence', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
    });

    it('should persist cursor across mode changes', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setMode('normal');
      store.getState().setMode('fullscreen');
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });

    it('should persist cursor when entering and exiting visual mode', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().enterVisualMode(50);
      store.getState().exitVisualMode();
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });

    it('should not affect cursor when appending new logs', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().appendLog('api', createLogLine('New line'));
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });
  });

  describe('cursor isolation between services', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
      addLogLines(store, 'web', 100);
    });

    it('should maintain separate cursors for each service', () => {
      store.getState().setFullscreenCursor('api', 25);
      store.getState().setFullscreenCursor('web', 75);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(25);
      expect(store.getState().services['web']?.fullscreenCursor).toBe(75);
    });

    it('should not affect other service cursor when moving one', () => {
      store.getState().setFullscreenCursor('api', 25);
      store.getState().setFullscreenCursor('web', 75);
      store.getState().setFullscreenCursor('api', 30);
      expect(store.getState().services['web']?.fullscreenCursor).toBe(75);
    });
  });

  describe('integration with visual mode', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
    });

    it('should use fullscreen cursor position when entering visual mode', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().enterVisualMode(50);
      expect(store.getState().visualModeState?.selectionStart).toBe(50);
      expect(store.getState().visualModeState?.cursorLine).toBe(50);
    });

    it('should preserve fullscreen cursor after visual mode selection', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().enterVisualMode(50);
      store.getState().moveVisualCursor(60); // extend selection
      store.getState().exitVisualMode();
      // Fullscreen cursor should still be at 50 (unchanged)
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });

    it('visual mode cursor is independent from fullscreen cursor', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().enterVisualMode(50);
      store.getState().moveVisualCursor(60);
      // Visual cursor moved, but fullscreen cursor unchanged
      expect(store.getState().visualModeState?.cursorLine).toBe(60);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });
  });

  describe('cursor with empty logs', () => {
    it('should allow setting cursor even with no logs', () => {
      store.getState().setFullscreenCursor('api', 0);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(0);
    });

    it('should handle cursor reset to null', () => {
      store.getState().setFullscreenCursor('api', 5);
      store.getState().setFullscreenCursor('api', null);
      expect(store.getState().services['api']?.fullscreenCursor).toBeNull();
    });
  });

  describe('cursor after log clearing', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
    });

    it('should preserve cursor value after clearing logs', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().clearLogs('api');
      // Cursor value is preserved (though it may be invalid now)
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });

    it('should allow resetting cursor after clearing logs', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().clearLogs('api');
      store.getState().setFullscreenCursor('api', null);
      expect(store.getState().services['api']?.fullscreenCursor).toBeNull();
    });
  });

  describe('cursor edge cases', () => {
    it('should handle setting cursor on nonexistent service', () => {
      const statesBefore = { ...store.getState().services };
      store.getState().setFullscreenCursor('nonexistent', 10);
      expect(store.getState().services).toEqual(statesBefore);
    });

    it('should handle negative cursor values', () => {
      // The store accepts any number, bounds checking is done in handlers
      store.getState().setFullscreenCursor('api', -5);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(-5);
    });

    it('should handle cursor beyond log length', () => {
      addLogLines(store, 'api', 10);
      // Store accepts any value, bounds checking is in handlers
      store.getState().setFullscreenCursor('api', 100);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(100);
    });

    it('should handle rapid cursor updates', () => {
      addLogLines(store, 'api', 100);
      for (let i = 0; i < 50; i++) {
        store.getState().setFullscreenCursor('api', i);
      }
      expect(store.getState().services['api']?.fullscreenCursor).toBe(49);
    });
  });

  describe('scroll offset interaction', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
    });

    it('should allow setting both cursor and scroll offset independently', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setScrollOffset('api', 40);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
      expect(store.getState().services['api']?.scrollOffset).toBe(40);
    });

    it('should not modify scroll offset when setting cursor', () => {
      store.getState().setScrollOffset('api', 30);
      store.getState().setFullscreenCursor('api', 50);
      expect(store.getState().services['api']?.scrollOffset).toBe(30);
    });

    it('should not modify cursor when setting scroll offset', () => {
      store.getState().setFullscreenCursor('api', 50);
      store.getState().setScrollOffset('api', 30);
      expect(store.getState().services['api']?.fullscreenCursor).toBe(50);
    });
  });

  describe('state preservation', () => {
    beforeEach(() => {
      addLogLines(store, 'api', 100);
    });

    it('should preserve all service state when setting cursor', () => {
      store.getState().updateServiceState('api', { status: 'ready', pid: 12345 });
      store.getState().setScrollOffset('api', 20);

      store.getState().setFullscreenCursor('api', 50);

      const runtime = store.getState().services['api'];
      expect(runtime?.state.status).toBe('ready');
      expect(runtime?.state.pid).toBe(12345);
      expect(runtime?.scrollOffset).toBe(20);
      expect(runtime?.logs.length).toBe(100);
      expect(runtime?.fullscreenCursor).toBe(50);
    });
  });
});

describe('visual mode with fullscreen cursor', () => {
  let store: AppStoreApi;

  beforeEach(() => {
    store = createAppStore(createTestConfig());
    addLogLines(store, 'api', 100);
  });

  it('should start visual selection from fullscreen cursor position', () => {
    store.getState().setFullscreenCursor('api', 30);
    store.getState().enterVisualMode(30);

    expect(store.getState().visualModeState).toEqual({
      cursorLine: 30,
      selectionStart: 30,
    });
  });

  it('should allow extending selection downward from cursor', () => {
    store.getState().setFullscreenCursor('api', 30);
    store.getState().enterVisualMode(30);
    store.getState().moveVisualCursor(40);

    expect(store.getState().visualModeState?.selectionStart).toBe(30);
    expect(store.getState().visualModeState?.cursorLine).toBe(40);
  });

  it('should allow extending selection upward from cursor', () => {
    store.getState().setFullscreenCursor('api', 30);
    store.getState().enterVisualMode(30);
    store.getState().moveVisualCursor(20);

    expect(store.getState().visualModeState?.selectionStart).toBe(30);
    expect(store.getState().visualModeState?.cursorLine).toBe(20);
  });

  it('should return to fullscreen mode when exiting visual mode', () => {
    store.getState().setMode('fullscreen');
    store.getState().setFullscreenCursor('api', 30);
    store.getState().enterVisualMode(30);

    expect(store.getState().mode).toBe('visual');

    store.getState().exitVisualMode();

    expect(store.getState().mode).toBe('fullscreen');
    expect(store.getState().visualModeState).toBeNull();
  });

  it('should support selection from middle of logs', () => {
    store.getState().setFullscreenCursor('api', 50);
    store.getState().enterVisualMode(50);
    store.getState().moveVisualCursor(55);

    const visualState = store.getState().visualModeState;
    expect(visualState?.selectionStart).toBe(50);
    expect(visualState?.cursorLine).toBe(55);
    // Selection covers lines 50-55 (6 lines)
  });

  it('should support reverse selection (cursor above start)', () => {
    store.getState().setFullscreenCursor('api', 50);
    store.getState().enterVisualMode(50);
    store.getState().moveVisualCursor(45);

    const visualState = store.getState().visualModeState;
    expect(visualState?.selectionStart).toBe(50);
    expect(visualState?.cursorLine).toBe(45);
    // Selection covers lines 45-50 (6 lines)
  });
});
