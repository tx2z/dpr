import { useCallback, useMemo } from 'react';

import { copyToClipboard } from '../utils/index.js';

import type { UseServiceManagerResult } from './use-service-manager.js';
import type { Config } from '../config/index.js';
import type { AppStoreApi } from '../store/index.js';

export interface Command {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly execute: (args: readonly string[]) => void;
}

export interface CommandSuggestion {
  readonly command: string;
  readonly description: string;
}

export interface UseCommandsResult {
  readonly commands: readonly Command[];
  readonly getSuggestions: (input: string) => readonly CommandSuggestion[];
  readonly executeCommand: (input: string) => boolean;
}

function parseServiceArg(arg: string | undefined, config: Config): string | null {
  if (arg === undefined) {
    return null;
  }

  const num = Number.parseInt(arg, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= config.services.length) {
    const service = config.services[num - 1];
    return service?.id ?? null;
  }

  const service = config.services.find((s) => s.id === arg || s.name === arg);
  return service?.id ?? null;
}

function createStartCommand(config: Config, serviceManager: UseServiceManagerResult): Command {
  return {
    name: 'start',
    aliases: ['s'],
    description: 'Start a service',
    usage: '/start <service>',
    execute: (args): void => {
      const serviceId = parseServiceArg(args[0], config);
      if (serviceId !== null) {
        serviceManager.startService(serviceId);
      }
    },
  };
}

function createStopCommand(config: Config, serviceManager: UseServiceManagerResult): Command {
  return {
    name: 'stop',
    aliases: ['x'],
    description: 'Stop a service',
    usage: '/stop <service>',
    execute: (args): void => {
      const serviceId = parseServiceArg(args[0], config);
      if (serviceId !== null) {
        serviceManager.stopService(serviceId);
      }
    },
  };
}

function createKillCommand(config: Config, serviceManager: UseServiceManagerResult): Command {
  return {
    name: 'kill',
    aliases: ['k'],
    description: 'Force kill a service',
    usage: '/kill <service>',
    execute: (args): void => {
      const serviceId = parseServiceArg(args[0], config);
      if (serviceId !== null) {
        serviceManager.killService(serviceId);
      }
    },
  };
}

function createRestartCommand(
  config: Config,
  serviceManager: UseServiceManagerResult,
  store: AppStoreApi,
): Command {
  return {
    name: 'restart',
    aliases: ['r'],
    description: 'Restart a service',
    usage: '/restart <service>',
    execute: (args): void => {
      const serviceId = parseServiceArg(args[0], config);
      if (serviceId === null) {
        return;
      }
      const runtime = store.getState().services[serviceId];
      if (runtime?.state.status === 'ready' || runtime?.state.status === 'starting') {
        serviceManager.stopService(serviceId);
        const checkAndStart = (): void => {
          const currentRuntime = store.getState().services[serviceId];
          if (
            currentRuntime?.state.status === 'stopped' ||
            currentRuntime?.state.status === 'crashed'
          ) {
            serviceManager.startService(serviceId);
          } else {
            setTimeout(checkAndStart, 100);
          }
        };
        setTimeout(checkAndStart, 100);
      } else {
        serviceManager.startService(serviceId);
      }
    },
  };
}

function createStartAllCommand(serviceManager: UseServiceManagerResult): Command {
  return {
    name: 'start-all',
    aliases: ['sa'],
    description: 'Start all services',
    usage: '/start-all',
    execute: (): void => {
      serviceManager.startAll();
    },
  };
}

function createStopAllCommand(serviceManager: UseServiceManagerResult): Command {
  return {
    name: 'stop-all',
    aliases: ['xa'],
    description: 'Stop all services',
    usage: '/stop-all',
    execute: (): void => {
      serviceManager.stopAll();
    },
  };
}

function createClearCommand(config: Config, store: AppStoreApi): Command {
  return {
    name: 'clear',
    aliases: ['c'],
    description: 'Clear logs for a service',
    usage: '/clear <service>',
    execute: (args): void => {
      const serviceId = parseServiceArg(args[0], config);
      if (serviceId !== null) {
        store.getState().clearLogs(serviceId);
      }
    },
  };
}

function createFocusCommand(config: Config, store: AppStoreApi): Command {
  return {
    name: 'focus',
    aliases: ['f'],
    description: 'Focus a service panel',
    usage: '/focus <service>',
    execute: (args): void => {
      const serviceId = parseServiceArg(args[0], config);
      if (serviceId !== null) {
        const index = config.services.findIndex((s) => s.id === serviceId);
        if (index !== -1) {
          store.getState().setFocusedSpace(index);
        }
      }
    },
  };
}

function createQuitCommand(exit: () => void, serviceManager: UseServiceManagerResult): Command {
  return {
    name: 'quit',
    aliases: ['q'],
    description: 'Stop all and exit',
    usage: '/quit',
    execute: (): void => {
      serviceManager.stopAllAndWait(exit);
    },
  };
}

function createHelpCommand(store: AppStoreApi): Command {
  return {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show help',
    usage: '/help',
    execute: (): void => {
      store.getState().setMode('help');
    },
  };
}

function createHistoryCommand(store: AppStoreApi): Command {
  return {
    name: 'history',
    aliases: ['H'],
    description: 'Show script execution history',
    usage: '/history',
    execute: (): void => {
      store.getState().openScriptHistory(null);
    },
  };
}

function calculateVisibleLines(config: Config, isFullscreen: boolean): number {
  const { stdout } = process;
  const termHeight = stdout.rows;

  if (isFullscreen) {
    return Math.max(1, termHeight - 6);
  }

  const serviceCount = config.services.length;
  const termWidth = stdout.columns;
  let columns: number;
  if (config.global.columns !== 'auto') {
    columns = Math.min(config.global.columns, serviceCount);
  } else if (termWidth < 80) {
    columns = 1;
  } else if (termWidth < 120) {
    columns = Math.min(2, serviceCount);
  } else {
    columns = Math.min(3, serviceCount);
  }
  const rows = Math.ceil(serviceCount / columns);
  const availableHeight = termHeight - 6;
  const panelHeight = Math.floor(availableHeight / rows);
  return Math.max(1, panelHeight - 4);
}

function createCopyCommand(config: Config, store: AppStoreApi): Command {
  return {
    name: 'copy',
    aliases: ['y'],
    description: 'Copy logs from focused service',
    usage: '/copy [all]',
    execute: (args): void => {
      const state = store.getState();
      const focusedIndex = state.focusedSpaceIndex;
      if (focusedIndex === null) {
        state.setNotification('No service focused');
        setTimeout(() => {
          state.setNotification(null);
        }, 2000);
        return;
      }
      const service = config.services[focusedIndex];
      if (service === undefined) {
        return;
      }
      const runtime = state.services[service.id];
      if (runtime === undefined) {
        return;
      }
      const copyAll = args[0] === 'all';
      const logs = runtime.logs;
      let linesToCopy: typeof logs;
      if (copyAll) {
        linesToCopy = logs;
      } else {
        const isFullscreen = state.mode === 'fullscreen';
        const visibleLines = calculateVisibleLines(config, isFullscreen);
        // Clamp offset (scrollOffset can be MAX_SAFE_INTEGER for auto-scroll)
        const maxOffset = Math.max(0, logs.length - visibleLines);
        const offset = Math.min(runtime.scrollOffset, maxOffset);
        linesToCopy = logs.slice(offset, offset + visibleLines);
      }
      const text = linesToCopy.map((line) => line.content).join('\n');
      const success = copyToClipboard(text);
      const message = success
        ? `Copied ${String(linesToCopy.length)} lines`
        : 'Failed to copy to clipboard';
      state.setNotification(message);
      setTimeout(() => {
        state.setNotification(null);
      }, 2000);
    },
  };
}

function matchesCommand(cmd: Command, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  if (cmd.name.toLowerCase().startsWith(lowerQuery)) {
    return true;
  }
  return cmd.aliases.some((alias) => alias.toLowerCase().startsWith(lowerQuery));
}

function toSuggestion(cmd: Command): CommandSuggestion {
  return { command: cmd.name, description: cmd.description };
}

function getSuggestionsForInput(
  commands: readonly Command[],
  input: string,
): readonly CommandSuggestion[] {
  if (input.length === 0) {
    return commands.map(toSuggestion);
  }
  return commands.filter((cmd) => matchesCommand(cmd, input)).map(toSuggestion);
}

function findAndExecuteCommand(commands: readonly Command[], input: string): boolean {
  const parts = input.trim().split(/\s+/);
  const cmdName = parts[0]?.toLowerCase();
  const args = parts.slice(1);
  if (cmdName === undefined || cmdName.length === 0) {
    return false;
  }
  const command = commands.find(
    (cmd) => cmd.name.toLowerCase() === cmdName || cmd.aliases.includes(cmdName),
  );
  if (command === undefined) {
    return false;
  }
  command.execute(args);
  return true;
}

function createAllCommands(
  config: Config,
  store: AppStoreApi,
  serviceManager: UseServiceManagerResult,
  exit: () => void,
): readonly Command[] {
  return [
    createStartCommand(config, serviceManager),
    createStopCommand(config, serviceManager),
    createKillCommand(config, serviceManager),
    createRestartCommand(config, serviceManager, store),
    createStartAllCommand(serviceManager),
    createStopAllCommand(serviceManager),
    createClearCommand(config, store),
    createFocusCommand(config, store),
    createCopyCommand(config, store),
    createQuitCommand(exit, serviceManager),
    createHelpCommand(store),
    createHistoryCommand(store),
  ];
}

export function useCommands(
  config: Config,
  store: AppStoreApi,
  serviceManager: UseServiceManagerResult,
  exit: () => void,
): UseCommandsResult {
  const commands = useMemo(
    () => createAllCommands(config, store, serviceManager, exit),
    [config, store, serviceManager, exit],
  );
  const getSuggestions = useCallback(
    (input: string) => getSuggestionsForInput(commands, input),
    [commands],
  );
  const executeCommand = useCallback(
    (input: string) => findAndExecuteCommand(commands, input),
    [commands],
  );
  return { commands, getSuggestions, executeCommand };
}
