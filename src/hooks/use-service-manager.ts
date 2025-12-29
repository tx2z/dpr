import { useCallback, useEffect, useRef } from 'react';

import { getStartOrder } from '../config/dependencies.js';
import { createProcessManager } from '../services/index.js';
import { createFileLogger } from '../utils/index.js';

import type { Config } from '../config/index.js';
import type { ProcessManager } from '../services/index.js';
import type { AppStoreApi } from '../store/index.js';
import type { FileLogger } from '../utils/index.js';

interface ServiceManagerState {
  managers: Map<string, ProcessManager>;
  fileLoggers: Map<string, FileLogger>;
  pendingAutostart: Set<string>;
}

function createServiceManager(): ServiceManagerState {
  return {
    managers: new Map(),
    fileLoggers: new Map(),
    pendingAutostart: new Set(),
  };
}

function areAllDependenciesReady(serviceId: string, config: Config, store: AppStoreApi): boolean {
  const serviceConfig = config.services.find((s) => s.id === serviceId);
  if (serviceConfig === undefined || serviceConfig.dependsOn.length === 0) {
    return true;
  }

  const storeState = store.getState();
  for (const depId of serviceConfig.dependsOn) {
    const depRuntime = storeState.services[depId];
    if (depRuntime?.state.status !== 'ready') {
      return false;
    }
  }
  return true;
}

function getWaitingDependencies(serviceId: string, config: Config, store: AppStoreApi): readonly string[] {
  const serviceConfig = config.services.find((s) => s.id === serviceId);
  if (serviceConfig === undefined) {
    return [];
  }

  const storeState = store.getState();
  const waiting: string[] = [];
  for (const depId of serviceConfig.dependsOn) {
    const depRuntime = storeState.services[depId];
    if (depRuntime?.state.status !== 'ready') {
      waiting.push(depId);
    }
  }
  return waiting;
}

function shouldLogToFile(serviceConfig: { logs: boolean }, globalConfig: { logs: boolean }): boolean {
  return serviceConfig.logs || globalConfig.logs;
}

function setupFileLogger(serviceId: string, config: Config, state: ServiceManagerState): FileLogger | undefined {
  const serviceConfig = config.services.find((s) => s.id === serviceId);
  if (serviceConfig === undefined) {
    return undefined;
  }
  if (!shouldLogToFile(serviceConfig, config.global)) {
    return undefined;
  }
  if (state.fileLoggers.has(serviceId)) {
    return state.fileLoggers.get(serviceId);
  }
  const logger = createFileLogger(config.global.logsDir, serviceId);
  state.fileLoggers.set(serviceId, logger);
  return logger;
}

function setupProcessManager(
  serviceId: string,
  config: Config,
  store: AppStoreApi,
  state: ServiceManagerState,
): ProcessManager | undefined {
  const serviceConfig = config.services.find((s) => s.id === serviceId);
  if (serviceConfig === undefined) {
    return undefined;
  }

  if (state.managers.has(serviceId)) {
    return state.managers.get(serviceId);
  }

  const manager = createProcessManager(serviceConfig);
  state.managers.set(serviceId, manager);
  const fileLogger = setupFileLogger(serviceId, config, state);

  manager.on('statusChange', (status, exitCode) => {
    store.getState().updateServiceState(serviceId, {
      status,
      exitCode: exitCode ?? null,
      pid: manager.pid,
      startedAt: status === 'starting' ? new Date() : null,
    });
  });

  manager.on('log', (line) => {
    store.getState().appendLog(serviceId, line);
    fileLogger?.write(line);
  });

  manager.on('ready', () => {
    checkPendingAutostart(config, store, state);
  });

  return manager;
}

function startServiceInternal(
  serviceId: string,
  config: Config,
  store: AppStoreApi,
  state: ServiceManagerState,
): void {
  const manager = setupProcessManager(serviceId, config, store, state);
  if (manager === undefined) {
    return;
  }

  if (!areAllDependenciesReady(serviceId, config, store)) {
    const waiting = getWaitingDependencies(serviceId, config, store);
    store.getState().updateServiceState(serviceId, {
      status: 'waiting',
      waitingFor: waiting,
    });
    state.pendingAutostart.add(serviceId);
    return;
  }

  manager.start();
}

function checkPendingAutostart(config: Config, store: AppStoreApi, state: ServiceManagerState): void {
  const pending = [...state.pendingAutostart];
  for (const serviceId of pending) {
    if (areAllDependenciesReady(serviceId, config, store)) {
      state.pendingAutostart.delete(serviceId);
      const manager = state.managers.get(serviceId);
      manager?.start();
    } else {
      const waiting = getWaitingDependencies(serviceId, config, store);
      store.getState().updateServiceState(serviceId, {
        waitingFor: waiting,
      });
    }
  }
}

export interface UseServiceManagerResult {
  readonly startService: (serviceId: string) => void;
  readonly stopService: (serviceId: string) => void;
  readonly killService: (serviceId: string) => void;
  readonly startAll: () => void;
  readonly stopAll: () => void;
}

function runAutostart(config: Config, store: AppStoreApi, state: ServiceManagerState): void {
  const autostartServices = config.services.filter((s) => s.autostart);
  if (autostartServices.length === 0) {
    return;
  }

  const autostartIds = autostartServices.map((s) => s.id);
  const startOrder = getStartOrder(autostartIds, config.services);

  for (const serviceId of startOrder) {
    startServiceInternal(serviceId, config, store, state);
  }
}

function disposeAllManagers(state: ServiceManagerState): void {
  for (const manager of state.managers.values()) {
    manager.dispose();
  }
  for (const logger of state.fileLoggers.values()) {
    logger.close();
  }
  state.managers.clear();
  state.fileLoggers.clear();
  state.pendingAutostart.clear();
}

export function useServiceManager(config: Config, store: AppStoreApi): UseServiceManagerResult {
  const stateRef = useRef<ServiceManagerState>(createServiceManager());

  useEffect(() => {
    runAutostart(config, store, stateRef.current);
  }, [config, store]);

  useEffect(() => {
    const currentState = stateRef.current;
    return (): void => {
      disposeAllManagers(currentState);
    };
  }, []);

  const startService = useCallback(
    (serviceId: string): void => {
      startServiceInternal(serviceId, config, store, stateRef.current);
    },
    [config, store],
  );

  const stopService = useCallback((serviceId: string): void => {
    stateRef.current.managers.get(serviceId)?.stop();
  }, []);

  const killService = useCallback((serviceId: string): void => {
    stateRef.current.managers.get(serviceId)?.kill();
  }, []);

  const startAll = useCallback((): void => {
    const allServiceIds = config.services.map((s) => s.id);
    const startOrder = getStartOrder(allServiceIds, config.services);
    for (const serviceId of startOrder) {
      startServiceInternal(serviceId, config, store, stateRef.current);
    }
  }, [config, store]);

  const stopAll = useCallback((): void => {
    for (const manager of stateRef.current.managers.values()) {
      manager.stop();
    }
  }, []);

  return { startService, stopService, killService, startAll, stopAll };
}
