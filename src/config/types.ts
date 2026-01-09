export type ServiceStatus = 'stopped' | 'waiting' | 'starting' | 'ready' | 'stopping' | 'crashed';

export type ServiceColor = 'green' | 'blue' | 'yellow' | 'magenta' | 'cyan' | 'red';

export interface ServiceState {
  readonly status: ServiceStatus;
  readonly pid: number | null;
  readonly exitCode: number | null;
  readonly startedAt: Date | null;
  readonly waitingFor: readonly string[];
}

/**
 * Parameter definition for a one-time script.
 * Parameters are substituted into the command using {paramId} placeholders.
 */
export interface ScriptParam {
  readonly id: string;
  readonly prompt: string;
}

/**
 * Configuration for a one-time script.
 * Scripts are commands that run once and complete (not background services).
 * Use cases: database resets, migrations, build commands, cache clearing, etc.
 */
export interface ScriptConfig {
  readonly id: string;
  readonly name: string;
  readonly command: string;
  readonly key: string | null;
  readonly params: readonly ScriptParam[];
}

export interface ServiceConfig {
  readonly id: string;
  readonly name: string;
  readonly dir: string;
  readonly start: string;
  readonly stop: string | null;
  readonly autostart: boolean;
  readonly color: ServiceColor;
  readonly logs: boolean;
  readonly env: Readonly<Record<string, string>>;
  readonly dependsOn: readonly string[];
  readonly readyPattern: string | null;
  readonly readyDelay: number;
  readonly runOnce: boolean;
  readonly keepRunning: boolean;
  readonly scripts: readonly ScriptConfig[];
}

export interface GlobalConfig {
  readonly name: string | null;
  readonly columns: number | 'auto';
  readonly logs: boolean;
  readonly logsDir: string;
}

export interface Config {
  readonly global: GlobalConfig;
  readonly services: readonly ServiceConfig[];
}

export interface LogLine {
  readonly timestamp: Date;
  readonly content: string;
  readonly stream: 'stdout' | 'stderr';
}

export interface ServiceLogs {
  readonly lines: readonly LogLine[];
  readonly scrollOffset: number;
}

export const DEFAULT_COLORS: readonly ServiceColor[] = [
  'green',
  'blue',
  'yellow',
  'magenta',
  'cyan',
  'red',
];

export const MIN_SERVICES = 2;
export const MAX_SERVICES = 6;
export const DEFAULT_READY_DELAY = 500;
export const DEFAULT_LOGS_DIR = '~/.dpr/logs';
export const LOG_BUFFER_SIZE = 1000;

/**
 * Record of a one-time script execution.
 * Stored in history for later review.
 */
export interface ScriptExecution {
  readonly id: string;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly scriptId: string;
  readonly scriptName: string;
  readonly command: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly exitCode: number | null;
  readonly output: readonly string[];
}
