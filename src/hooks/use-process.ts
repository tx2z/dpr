import { useCallback, useEffect, useRef } from 'react';

import { createProcessManager } from '../services/index.js';

import type { ServiceConfig, ServiceStatus, LogLine } from '../config/index.js';
import type { ProcessManager } from '../services/index.js';

export interface UseProcessResult {
  readonly start: () => void;
  readonly stop: () => void;
  readonly kill: () => void;
}

export interface UseProcessOptions {
  readonly config: ServiceConfig;
  readonly onStatusChange: (status: ServiceStatus, exitCode?: number | null) => void;
  readonly onLog: (line: LogLine) => void;
  readonly onReady?: () => void;
  readonly onError?: (error: Error) => void;
}

export function useProcess(options: UseProcessOptions): UseProcessResult {
  const { config, onStatusChange, onLog, onReady, onError } = options;
  const managerRef = useRef<ProcessManager | null>(null);

  useEffect(() => {
    const manager = createProcessManager(config);
    managerRef.current = manager;

    manager.on('statusChange', onStatusChange);
    manager.on('log', onLog);

    if (onReady !== undefined) {
      manager.on('ready', onReady);
    }
    if (onError !== undefined) {
      manager.on('error', onError);
    }

    return (): void => {
      manager.dispose();
      managerRef.current = null;
    };
  }, [config, onStatusChange, onLog, onReady, onError]);

  const start = useCallback((): void => {
    managerRef.current?.start();
  }, []);

  const stop = useCallback((): void => {
    managerRef.current?.stop();
  }, []);

  const kill = useCallback((): void => {
    managerRef.current?.kill();
  }, []);

  return { start, stop, kill };
}
