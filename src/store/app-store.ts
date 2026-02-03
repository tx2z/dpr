import { createStore } from 'zustand';

import type {
  Config,
  LogLine,
  ScriptExecution,
  ServiceConfig,
  ServiceState,
  ServiceStatus,
} from '../config/index.js';
import type { StoreApi } from 'zustand';

export interface SearchMatch {
  readonly serviceId: string;
  readonly lineIndex: number;
  readonly startCol: number;
  readonly endCol: number;
}

export interface SearchState {
  readonly term: string;
  readonly serviceFilter: string | null;
  readonly matches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
}

export type AppMode =
  | 'normal'
  | 'command'
  | 'search'
  | 'help'
  | 'fullscreen'
  | 'visual'
  | 'scripts'
  | 'scriptOutput'
  | 'scriptHistory';

/**
 * State for visual (vim-like) selection mode.
 * Tracks cursor position and selection range.
 */
export interface VisualModeState {
  readonly cursorLine: number;
  readonly selectionStart: number;
}

/**
 * State for the scripts menu overlay.
 * Tracks which service's scripts are shown and navigation state.
 */
export interface ScriptsMenuState {
  readonly serviceId: string;
  readonly selectedIndex: number;
  readonly paramValues: Readonly<Record<string, string>>;
  readonly currentParamIndex: number;
  readonly inputValue: string;
}

/**
 * State for the script output overlay.
 * Shows the currently running or just-completed script's output.
 */
export interface ScriptOutputState {
  readonly executionId: string;
}

/**
 * State for the script history overlay.
 * Can show history for a single service or all services.
 */
export interface ScriptHistoryState {
  readonly serviceFilter: string | null;
  readonly selectedIndex: number;
  readonly scrollOffset: number;
}

export interface ServiceRuntime {
  readonly state: ServiceState;
  readonly logs: readonly LogLine[];
  readonly scrollOffset: number;
  readonly fullscreenCursor: number | null;
}

interface AppState {
  readonly config: Config;
  readonly services: Record<string, ServiceRuntime>;
  readonly focusedSpaceIndex: number | null;
  readonly mode: AppMode;
  readonly commandInput: string;
  readonly searchState: SearchState | null;
  readonly scriptsMenuState: ScriptsMenuState | null;
  readonly scriptOutputState: ScriptOutputState | null;
  readonly scriptHistoryState: ScriptHistoryState | null;
  readonly scriptHistory: readonly ScriptExecution[];
  readonly notification: string | null;
  readonly visualModeState: VisualModeState | null;
}

interface AppActions {
  setFocusedSpace: (index: number | null) => void;
  setMode: (mode: AppMode) => void;
  setCommandInput: (input: string) => void;
  updateServiceState: (serviceId: string, updates: Partial<ServiceState>) => void;
  setServiceStatus: (serviceId: string, status: ServiceStatus) => void;
  appendLog: (serviceId: string, line: LogLine) => void;
  clearLogs: (serviceId: string) => void;
  setScrollOffset: (serviceId: string, offset: number) => void;
  setSearchState: (state: SearchState | null) => void;
  getServiceById: (serviceId: string) => ServiceConfig | undefined;
  getServiceByIndex: (index: number) => ServiceConfig | undefined;
  getServiceRuntime: (serviceId: string) => ServiceRuntime | undefined;
  // Scripts actions
  openScriptsMenu: (serviceId: string) => void;
  closeScriptsMenu: () => void;
  setScriptsMenuSelection: (index: number) => void;
  setScriptsMenuInput: (value: string) => void;
  advanceScriptsMenuParam: () => void;
  openScriptOutput: (executionId: string) => void;
  closeScriptOutput: () => void;
  openScriptHistory: (serviceFilter: string | null) => void;
  closeScriptHistory: () => void;
  setScriptHistorySelection: (index: number) => void;
  setScriptHistoryScroll: (offset: number) => void;
  addScriptExecution: (execution: ScriptExecution) => void;
  updateScriptExecution: (id: string, updates: Partial<ScriptExecution>) => void;
  getScriptExecution: (id: string) => ScriptExecution | undefined;
  setNotification: (message: string | null) => void;
  // Visual mode actions
  enterVisualMode: (startLine: number) => void;
  exitVisualMode: () => void;
  moveVisualCursor: (line: number) => void;
  // Fullscreen cursor
  setFullscreenCursor: (serviceId: string, line: number | null) => void;
}

export type AppStore = AppState & AppActions;
export type AppStoreApi = StoreApi<AppStore>;

const LOG_BUFFER_SIZE = 1000;

function createInitialServiceRuntime(): ServiceRuntime {
  return {
    state: {
      status: 'stopped',
      pid: null,
      exitCode: null,
      startedAt: null,
      waitingFor: [],
    },
    logs: [],
    scrollOffset: 0,
    fullscreenCursor: null,
  };
}

function createInitialServices(config: Config): Record<string, ServiceRuntime> {
  const services: Record<string, ServiceRuntime> = {};
  for (const service of config.services) {
    services[service.id] = createInitialServiceRuntime();
  }
  return services;
}

type SetState = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
) => void;
type GetState = () => AppStore;

function createUpdateServiceState(set: SetState) {
  return (serviceId: string, updates: Partial<ServiceState>): void => {
    set((state) => {
      const existing = state.services[serviceId];
      if (existing === undefined) {
        return state;
      }
      return {
        services: {
          ...state.services,
          [serviceId]: { ...existing, state: { ...existing.state, ...updates } },
        },
      };
    });
  };
}

function createAppendLog(set: SetState) {
  return (serviceId: string, line: LogLine): void => {
    set((state) => {
      const existing = state.services[serviceId];
      if (existing === undefined) {
        return state;
      }
      const newLogs = [...existing.logs, line];
      const trimmedLogs =
        newLogs.length > LOG_BUFFER_SIZE ? newLogs.slice(-LOG_BUFFER_SIZE) : newLogs;
      // Auto-scroll to bottom by setting scrollOffset to a large value
      // LogView will clamp this to the valid range
      return {
        services: {
          ...state.services,
          [serviceId]: {
            ...existing,
            logs: trimmedLogs,
            scrollOffset: Number.MAX_SAFE_INTEGER,
          },
        },
      };
    });
  };
}

function createClearLogs(set: SetState) {
  return (serviceId: string): void => {
    set((state) => {
      const existing = state.services[serviceId];
      if (existing === undefined) {
        return state;
      }
      return {
        services: {
          ...state.services,
          [serviceId]: { ...existing, logs: [], scrollOffset: 0 },
        },
      };
    });
  };
}

function createSetScrollOffset(set: SetState) {
  return (serviceId: string, offset: number): void => {
    set((state) => {
      const existing = state.services[serviceId];
      if (existing === undefined) {
        return state;
      }
      return {
        services: {
          ...state.services,
          [serviceId]: { ...existing, scrollOffset: Math.max(0, offset) },
        },
      };
    });
  };
}

function updateScriptsMenuSelection(state: AppState, index: number): Partial<AppState> {
  if (state.scriptsMenuState === null) return state;
  return { scriptsMenuState: { ...state.scriptsMenuState, selectedIndex: index } };
}

function updateScriptsMenuInput(state: AppState, value: string): Partial<AppState> {
  if (state.scriptsMenuState === null) return state;
  return { scriptsMenuState: { ...state.scriptsMenuState, inputValue: value } };
}

function advanceScriptsParam(state: AppState): Partial<AppState> {
  if (state.scriptsMenuState === null) return state;
  const { currentParamIndex, inputValue, paramValues } = state.scriptsMenuState;
  const paramId = `param_${String(currentParamIndex)}`;
  return {
    scriptsMenuState: {
      ...state.scriptsMenuState,
      currentParamIndex: currentParamIndex + 1,
      paramValues: { ...paramValues, [paramId]: inputValue },
      inputValue: '',
    },
  };
}

function createScriptsMenuActions(
  set: SetState,
): Pick<
  AppActions,
  | 'openScriptsMenu'
  | 'closeScriptsMenu'
  | 'setScriptsMenuSelection'
  | 'setScriptsMenuInput'
  | 'advanceScriptsMenuParam'
> {
  return {
    openScriptsMenu: (serviceId): void => {
      set({
        mode: 'scripts',
        scriptsMenuState: {
          serviceId,
          selectedIndex: 0,
          paramValues: {},
          currentParamIndex: -1,
          inputValue: '',
        },
      });
    },
    closeScriptsMenu: (): void => {
      set({ mode: 'normal', scriptsMenuState: null });
    },
    setScriptsMenuSelection: (index): void => {
      set((s) => updateScriptsMenuSelection(s, index));
    },
    setScriptsMenuInput: (value): void => {
      set((s) => updateScriptsMenuInput(s, value));
    },
    advanceScriptsMenuParam: (): void => {
      set(advanceScriptsParam);
    },
  };
}

function createScriptOutputActions(
  set: SetState,
): Pick<AppActions, 'openScriptOutput' | 'closeScriptOutput'> {
  return {
    openScriptOutput: (executionId): void => {
      set({ mode: 'scriptOutput', scriptOutputState: { executionId }, scriptsMenuState: null });
    },
    closeScriptOutput: (): void => {
      set({ mode: 'normal', scriptOutputState: null });
    },
  };
}

function createScriptHistoryActions(
  set: SetState,
): Pick<
  AppActions,
  | 'openScriptHistory'
  | 'closeScriptHistory'
  | 'setScriptHistorySelection'
  | 'setScriptHistoryScroll'
> {
  return {
    openScriptHistory: (serviceFilter): void => {
      set({
        mode: 'scriptHistory',
        scriptHistoryState: { serviceFilter, selectedIndex: 0, scrollOffset: 0 },
      });
    },
    closeScriptHistory: (): void => {
      set({ mode: 'normal', scriptHistoryState: null });
    },
    setScriptHistorySelection: (index): void => {
      set((state) => {
        if (state.scriptHistoryState === null) {
          return state;
        }
        return {
          scriptHistoryState: { ...state.scriptHistoryState, selectedIndex: index },
        };
      });
    },
    setScriptHistoryScroll: (offset): void => {
      set((state) => {
        if (state.scriptHistoryState === null) {
          return state;
        }
        return {
          scriptHistoryState: { ...state.scriptHistoryState, scrollOffset: Math.max(0, offset) },
        };
      });
    },
  };
}

const SCRIPT_HISTORY_LIMIT = 100;

function createScriptExecutionActions(
  set: SetState,
  get: GetState,
): Pick<AppActions, 'addScriptExecution' | 'updateScriptExecution' | 'getScriptExecution'> {
  return {
    addScriptExecution: (execution): void => {
      set((state) => {
        const newHistory = [execution, ...state.scriptHistory];
        const trimmed = newHistory.slice(0, SCRIPT_HISTORY_LIMIT);
        return { scriptHistory: trimmed };
      });
    },
    updateScriptExecution: (id, updates): void => {
      set((state) => ({
        scriptHistory: state.scriptHistory.map((exec) =>
          exec.id === id ? { ...exec, ...updates } : exec,
        ),
      }));
    },
    getScriptExecution: (id): ScriptExecution | undefined => {
      return get().scriptHistory.find((exec) => exec.id === id);
    },
  };
}

function createVisualModeActions(
  set: SetState,
): Pick<AppActions, 'enterVisualMode' | 'exitVisualMode' | 'moveVisualCursor' | 'setFullscreenCursor'> {
  return {
    enterVisualMode: (startLine): void => {
      set({
        mode: 'visual',
        visualModeState: { cursorLine: startLine, selectionStart: startLine },
      });
    },
    exitVisualMode: (): void => {
      set({ mode: 'fullscreen', visualModeState: null });
    },
    moveVisualCursor: (line): void => {
      set((state) => {
        if (state.visualModeState === null) {
          return state;
        }
        return {
          visualModeState: { ...state.visualModeState, cursorLine: line },
        };
      });
    },
    setFullscreenCursor: (serviceId, line): void => {
      set((state) => {
        const existing = state.services[serviceId];
        if (existing === undefined) {
          return state;
        }
        return {
          services: {
            ...state.services,
            [serviceId]: { ...existing, fullscreenCursor: line },
          },
        };
      });
    },
  };
}

function createStoreActions(set: SetState, get: GetState): AppActions {
  const updateServiceState = createUpdateServiceState(set);

  return {
    setFocusedSpace: (index): void => {
      set({ focusedSpaceIndex: index });
    },
    setMode: (mode): void => {
      set({ mode, commandInput: '' });
    },
    setCommandInput: (input): void => {
      set({ commandInput: input });
    },
    updateServiceState,
    setServiceStatus: (serviceId, status): void => {
      updateServiceState(serviceId, { status });
    },
    appendLog: createAppendLog(set),
    clearLogs: createClearLogs(set),
    setScrollOffset: createSetScrollOffset(set),
    setSearchState: (searchState): void => {
      set({ searchState });
    },
    getServiceById: (serviceId): ServiceConfig | undefined => {
      return get().config.services.find((s) => s.id === serviceId);
    },
    getServiceByIndex: (index): ServiceConfig | undefined => {
      return get().config.services[index];
    },
    getServiceRuntime: (serviceId): ServiceRuntime | undefined => {
      return get().services[serviceId];
    },
    ...createScriptsMenuActions(set),
    ...createScriptOutputActions(set),
    ...createScriptHistoryActions(set),
    ...createScriptExecutionActions(set, get),
    setNotification: (message): void => {
      set({ notification: message });
    },
    ...createVisualModeActions(set),
  };
}

export function createAppStore(config: Config): AppStoreApi {
  const initialServices = createInitialServices(config);

  return createStore<AppStore>((set, get) => ({
    config,
    services: initialServices,
    focusedSpaceIndex: null,
    mode: 'normal',
    commandInput: '',
    searchState: null,
    scriptsMenuState: null,
    scriptOutputState: null,
    scriptHistoryState: null,
    scriptHistory: [],
    notification: null,
    visualModeState: null,
    ...createStoreActions(set, get),
  }));
}
