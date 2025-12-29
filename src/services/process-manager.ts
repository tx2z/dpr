import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import type { ServiceConfig, ServiceStatus, LogLine } from '../config/index.js';
import type { ChildProcess } from 'node:child_process';

const SIGTERM_TIMEOUT = 5000;
const SIGKILL_TIMEOUT = 2000;

export interface ProcessManagerEvents {
  log: (line: LogLine) => void;
  statusChange: (status: ServiceStatus, exitCode?: number | null) => void;
  ready: () => void;
  error: (error: Error) => void;
}

export interface ProcessManager {
  readonly serviceId: string;
  readonly status: ServiceStatus;
  readonly pid: number | null;
  start: () => void;
  stop: () => void;
  kill: () => void;
  on: <K extends keyof ProcessManagerEvents>(event: K, listener: ProcessManagerEvents[K]) => void;
  off: <K extends keyof ProcessManagerEvents>(event: K, listener: ProcessManagerEvents[K]) => void;
  dispose: () => void;
}

interface ProcessState {
  status: ServiceStatus;
  pid: number | null;
  process: ChildProcess | null;
  exitCode: number | null;
  readyTimeout: NodeJS.Timeout | null;
  stopTimeout: NodeJS.Timeout | null;
  killTimeout: NodeJS.Timeout | null;
}

function createLogLine(content: string, stream: 'stdout' | 'stderr'): LogLine {
  return {
    timestamp: new Date(),
    content,
    stream,
  };
}

function parseEnvConfig(env: Record<string, string> | undefined): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...env,
  };
}

function emitStatus(
  emitter: EventEmitter,
  state: ProcessState,
  status: ServiceStatus,
  exitCode?: number | null,
): void {
  state.status = status;
  if (exitCode !== undefined) {
    state.exitCode = exitCode;
  }
  emitter.emit('statusChange', status, exitCode);
}

function clearAllTimeouts(state: ProcessState): void {
  if (state.readyTimeout !== null) {
    clearTimeout(state.readyTimeout);
    state.readyTimeout = null;
  }
  if (state.stopTimeout !== null) {
    clearTimeout(state.stopTimeout);
    state.stopTimeout = null;
  }
  if (state.killTimeout !== null) {
    clearTimeout(state.killTimeout);
    state.killTimeout = null;
  }
}

function handleReadyPattern(
  emitter: EventEmitter,
  state: ProcessState,
  content: string,
  readyPattern: RegExp | null,
): boolean {
  if (state.status !== 'starting') {
    return false;
  }
  if (readyPattern?.test(content) === true) {
    emitStatus(emitter, state, 'ready');
    emitter.emit('ready');
    return true;
  }
  return false;
}

function setupReadyTimeout(
  emitter: EventEmitter,
  state: ProcessState,
  readyDelay: number,
): void {
  if (state.readyTimeout !== null) {
    return;
  }
  state.readyTimeout = setTimeout(() => {
    if (state.status === 'starting') {
      emitStatus(emitter, state, 'ready');
      emitter.emit('ready');
    }
  }, readyDelay);
}

function handleStdout(
  emitter: EventEmitter,
  state: ProcessState,
  data: Buffer,
  readyPattern: RegExp | null,
  readyDelay: number,
): void {
  const lines = data.toString().split('\n').filter((line) => line.length > 0);
  for (const line of lines) {
    emitter.emit('log', createLogLine(line, 'stdout'));
    const matched = handleReadyPattern(emitter, state, line, readyPattern);
    if (!matched && readyPattern === null && state.status === 'starting') {
      setupReadyTimeout(emitter, state, readyDelay);
    }
  }
}

function handleStderr(emitter: EventEmitter, data: Buffer): void {
  const lines = data.toString().split('\n').filter((line) => line.length > 0);
  for (const line of lines) {
    emitter.emit('log', createLogLine(line, 'stderr'));
  }
}

function handleProcessExit(
  emitter: EventEmitter,
  state: ProcessState,
  code: number | null,
): void {
  clearAllTimeouts(state);
  state.process = null;
  state.pid = null;

  if (state.status === 'stopping') {
    emitStatus(emitter, state, 'stopped', code);
    return;
  }
  emitStatus(emitter, state, 'crashed', code);
}

function handleProcessError(emitter: EventEmitter, state: ProcessState, error: Error): void {
  clearAllTimeouts(state);
  state.process = null;
  state.pid = null;
  emitStatus(emitter, state, 'crashed', null);
  emitter.emit('error', error);
}

function startProcess(config: ServiceConfig, emitter: EventEmitter, state: ProcessState): void {
  if (state.process !== null) {
    return;
  }

  emitStatus(emitter, state, 'starting');

  const readyPattern = config.readyPattern !== null ? new RegExp(config.readyPattern) : null;
  const readyDelay = config.readyDelay;

  const child = spawn(config.start, {
    cwd: config.dir,
    shell: true,
    env: parseEnvConfig(config.env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  state.process = child;
  state.pid = child.pid ?? null;

  child.stdout.on('data', (data: Buffer) => {
    handleStdout(emitter, state, data, readyPattern, readyDelay);
  });

  child.stderr.on('data', (data: Buffer) => {
    handleStderr(emitter, data);
  });

  child.on('exit', (code) => {
    handleProcessExit(emitter, state, code);
  });

  child.on('error', (error) => {
    handleProcessError(emitter, state, error);
  });
}

function sendSignal(state: ProcessState, signal: NodeJS.Signals): boolean {
  if (state.process === null) {
    return false;
  }
  try {
    state.process.kill(signal);
    return true;
  } catch {
    return false;
  }
}

function stopWithCommand(
  config: ServiceConfig,
  emitter: EventEmitter,
  state: ProcessState,
): void {
  if (config.stop === null) {
    return;
  }

  const stopProcess = spawn(config.stop, {
    cwd: config.dir,
    shell: true,
    env: parseEnvConfig(config.env),
    stdio: 'ignore',
  });

  stopProcess.on('exit', () => {
    if (state.status === 'stopping' && state.process !== null) {
      escalateToSigterm(emitter, state);
    }
  });

  stopProcess.on('error', () => {
    if (state.status === 'stopping' && state.process !== null) {
      escalateToSigterm(emitter, state);
    }
  });
}

function escalateToSigterm(emitter: EventEmitter, state: ProcessState): void {
  sendSignal(state, 'SIGTERM');
  state.stopTimeout = setTimeout(() => {
    if (state.process !== null) {
      escalateToSigkill(emitter, state);
    }
  }, SIGTERM_TIMEOUT);
}

function escalateToSigkill(emitter: EventEmitter, state: ProcessState): void {
  sendSignal(state, 'SIGKILL');
  state.killTimeout = setTimeout(() => {
    if (state.process !== null) {
      emitStatus(emitter, state, 'crashed', null);
      emitter.emit('error', new Error('Process did not terminate after SIGKILL'));
    }
  }, SIGKILL_TIMEOUT);
}

function stopProcess(config: ServiceConfig, emitter: EventEmitter, state: ProcessState): void {
  if (state.process === null) {
    return;
  }

  emitStatus(emitter, state, 'stopping');
  clearAllTimeouts(state);

  if (config.stop !== null) {
    stopWithCommand(config, emitter, state);
    return;
  }

  sendSignal(state, 'SIGINT');
  state.stopTimeout = setTimeout(() => {
    if (state.process !== null) {
      escalateToSigterm(emitter, state);
    }
  }, SIGTERM_TIMEOUT);
}

function killProcess(emitter: EventEmitter, state: ProcessState): void {
  if (state.process === null) {
    return;
  }

  emitStatus(emitter, state, 'stopping');
  clearAllTimeouts(state);
  sendSignal(state, 'SIGKILL');

  state.killTimeout = setTimeout(() => {
    if (state.process !== null) {
      emitStatus(emitter, state, 'crashed', null);
      emitter.emit('error', new Error('Process did not terminate after SIGKILL'));
    }
  }, SIGKILL_TIMEOUT);
}

function disposeProcess(state: ProcessState): void {
  clearAllTimeouts(state);
  if (state.process !== null) {
    sendSignal(state, 'SIGKILL');
    state.process = null;
    state.pid = null;
  }
}

export function createProcessManager(config: ServiceConfig): ProcessManager {
  const emitter = new EventEmitter();
  const state: ProcessState = {
    status: 'stopped',
    pid: null,
    process: null,
    exitCode: null,
    readyTimeout: null,
    stopTimeout: null,
    killTimeout: null,
  };

  return {
    get serviceId(): string {
      return config.id;
    },
    get status(): ServiceStatus {
      return state.status;
    },
    get pid(): number | null {
      return state.pid;
    },
    start: (): void => {
      startProcess(config, emitter, state);
    },
    stop: (): void => {
      stopProcess(config, emitter, state);
    },
    kill: (): void => {
      killProcess(emitter, state);
    },
    on: <K extends keyof ProcessManagerEvents>(
      event: K,
      listener: ProcessManagerEvents[K],
    ): void => {
      emitter.on(event, listener as (...args: unknown[]) => void);
    },
    off: <K extends keyof ProcessManagerEvents>(
      event: K,
      listener: ProcessManagerEvents[K],
    ): void => {
      emitter.off(event, listener as (...args: unknown[]) => void);
    },
    dispose: (): void => {
      disposeProcess(state);
      emitter.removeAllListeners();
    },
  };
}
