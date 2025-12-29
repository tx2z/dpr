export type ServiceStatus =
  | 'stopped'
  | 'waiting'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'crashed';

export type ServiceColor = 'green' | 'blue' | 'yellow' | 'magenta' | 'cyan' | 'red';

export interface ServiceState {
  readonly status: ServiceStatus;
  readonly pid: number | null;
  readonly exitCode: number | null;
  readonly startedAt: Date | null;
  readonly waitingFor: readonly string[];
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
