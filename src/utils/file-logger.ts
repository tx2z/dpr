import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { LogLine } from '../config/index.js';

export interface FileLogger {
  readonly write: (line: LogLine) => void;
  readonly close: () => void;
}

function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  if (inputPath === '~') {
    return os.homedir();
  }
  return inputPath;
}

function ensureDirectory(dirPath: string): void {
  const expandedPath = expandPath(dirPath);
  if (!fs.existsSync(expandedPath)) {
    fs.mkdirSync(expandedPath, { recursive: true });
  }
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function formatLogLine(line: LogLine): string {
  const timestamp = formatTimestamp(line.timestamp);
  const streamPrefix = line.stream === 'stderr' ? '[ERR] ' : '';
  return `[${timestamp}] ${streamPrefix}${line.content}\n`;
}

export function createFileLogger(logsDir: string, serviceId: string): FileLogger {
  const expandedDir = expandPath(logsDir);
  ensureDirectory(expandedDir);

  const logPath = path.join(expandedDir, `${serviceId}.log`);
  const stream = fs.createWriteStream(logPath, { flags: 'a' });

  return {
    write: (line: LogLine): void => {
      stream.write(formatLogLine(line));
    },
    close: (): void => {
      stream.end();
    },
  };
}
