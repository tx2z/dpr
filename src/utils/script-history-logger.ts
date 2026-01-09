import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ScriptExecution } from '../config/index.js';

export interface ScriptHistoryLogger {
  readonly saveExecution: (execution: ScriptExecution) => void;
  readonly loadHistory: () => ScriptExecution[];
}

function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~/')) return path.join(os.homedir(), inputPath.slice(2));
  if (inputPath === '~') return os.homedir();
  return inputPath;
}

function ensureDirectory(dirPath: string): void {
  const expandedPath = expandPath(dirPath);
  if (!fs.existsSync(expandedPath)) {
    fs.mkdirSync(expandedPath, { recursive: true });
  }
}

interface SerializedExecution {
  id: string;
  serviceId: string;
  serviceName: string;
  scriptId: string;
  scriptName: string;
  command: string;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  output: string[];
}

function serializeExecution(execution: ScriptExecution): SerializedExecution {
  return {
    id: execution.id,
    serviceId: execution.serviceId,
    serviceName: execution.serviceName,
    scriptId: execution.scriptId,
    scriptName: execution.scriptName,
    command: execution.command,
    startedAt: execution.startedAt.toISOString(),
    endedAt: execution.endedAt !== null ? execution.endedAt.toISOString() : null,
    exitCode: execution.exitCode,
    output: [...execution.output],
  };
}

function deserializeExecution(data: SerializedExecution): ScriptExecution {
  return {
    id: data.id,
    serviceId: data.serviceId,
    serviceName: data.serviceName,
    scriptId: data.scriptId,
    scriptName: data.scriptName,
    command: data.command,
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt !== null ? new Date(data.endedAt) : null,
    exitCode: data.exitCode,
    output: data.output,
  };
}

function getHistoryFilePath(logsDir: string): string {
  return path.join(expandPath(logsDir), 'script-history.json');
}

export function createScriptHistoryLogger(logsDir: string): ScriptHistoryLogger {
  const expandedDir = expandPath(logsDir);
  ensureDirectory(expandedDir);
  const historyPath = getHistoryFilePath(logsDir);

  return {
    saveExecution: (execution: ScriptExecution): void => {
      const history = loadHistoryFromFile(historyPath);
      const existingIndex = history.findIndex((e) => e.id === execution.id);
      if (existingIndex >= 0) {
        history[existingIndex] = serializeExecution(execution);
      } else {
        history.push(serializeExecution(execution));
      }
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    },
    loadHistory: (): ScriptExecution[] => {
      return loadHistoryFromFile(historyPath).map(deserializeExecution);
    },
  };
}

function loadHistoryFromFile(historyPath: string): SerializedExecution[] {
  if (!fs.existsSync(historyPath)) return [];
  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(content) as SerializedExecution[];
  } catch {
    return [];
  }
}

export function createNoOpHistoryLogger(): ScriptHistoryLogger {
  return {
    saveExecution: (): void => {
      /* no-op */
    },
    loadHistory: (): ScriptExecution[] => [],
  };
}
