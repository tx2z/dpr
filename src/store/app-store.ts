import { createStore } from 'zustand';

import type {
  Config,
  LogLine,
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

export type AppMode = 'normal' | 'command' | 'search' | 'help' | 'fullscreen';

export interface ServiceRuntime {
  readonly state: ServiceState;
  readonly logs: readonly LogLine[];
  readonly scrollOffset: number;
}

interface AppState {
  readonly config: Config;
  readonly services: Record<string, ServiceRuntime>;
  readonly focusedSpaceIndex: number | null;
  readonly mode: AppMode;
  readonly commandInput: string;
  readonly searchState: SearchState | null;
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
    ...createStoreActions(set, get),
  }));
}
