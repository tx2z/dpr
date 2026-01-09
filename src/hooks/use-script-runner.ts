import { spawn } from 'node:child_process';

import { useCallback, useRef } from 'react';

import type { ScriptConfig, ScriptExecution, ServiceConfig } from '../config/index.js';
import type { ChildProcess } from 'node:child_process';

export interface ScriptRunnerOptions {
  readonly serviceConfig: ServiceConfig;
  readonly onExecutionStart: (execution: ScriptExecution) => void;
  readonly onOutputLine: (executionId: string, line: string) => void;
  readonly onExecutionEnd: (executionId: string, exitCode: number | null) => void;
}

export interface ScriptRunnerResult {
  readonly runScript: (script: ScriptConfig, paramValues: Record<string, string>) => string;
  readonly cancelScript: (executionId: string) => void;
}

function generateExecutionId(): string {
  return `exec_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}`;
}

function substituteParams(command: string, params: Record<string, string>): string {
  let result = command;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

function parseEnv(env: Record<string, string> | undefined): NodeJS.ProcessEnv {
  return { ...process.env, ...env };
}

function createExecution(
  id: string,
  cmd: string,
  script: ScriptConfig,
  svc: ServiceConfig,
): ScriptExecution {
  return {
    id,
    serviceId: svc.id,
    serviceName: svc.name,
    scriptId: script.id,
    scriptName: script.name,
    command: cmd,
    startedAt: new Date(),
    endedAt: null,
    exitCode: null,
    output: [],
  };
}

interface ProcessHandlers {
  onLine: (id: string, line: string) => void;
  onEnd: (id: string, code: number | null) => void;
  processes: Map<string, ChildProcess>;
}

function setupProcessListeners(
  child: ChildProcess,
  execId: string,
  handlers: ProcessHandlers,
): void {
  const handleData = (data: Buffer): void => {
    const lines = data
      .toString()
      .split('\n')
      .filter((line) => line.length > 0);
    for (const line of lines) handlers.onLine(execId, line);
  };
  if (child.stdout !== null) child.stdout.on('data', handleData);
  if (child.stderr !== null) child.stderr.on('data', handleData);
  child.on('exit', (code) => {
    handlers.processes.delete(execId);
    handlers.onEnd(execId, code);
  });
  child.on('error', () => {
    handlers.processes.delete(execId);
    handlers.onEnd(execId, null);
  });
}

export function useScriptRunner(options: ScriptRunnerOptions): ScriptRunnerResult {
  const { serviceConfig, onExecutionStart, onOutputLine, onExecutionEnd } = options;
  const runningProcesses = useRef<Map<string, ChildProcess>>(new Map());

  const runScript = useCallback(
    (script: ScriptConfig, paramValues: Record<string, string>): string => {
      const executionId = generateExecutionId();
      const command = substituteParams(script.command, paramValues);
      const execution = createExecution(executionId, command, script, serviceConfig);
      onExecutionStart(execution);

      const child = spawn(command, {
        cwd: serviceConfig.dir,
        shell: true,
        env: parseEnv(serviceConfig.env),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      runningProcesses.current.set(executionId, child);
      setupProcessListeners(child, executionId, {
        onLine: onOutputLine,
        onEnd: onExecutionEnd,
        processes: runningProcesses.current,
      });
      return executionId;
    },
    [serviceConfig, onExecutionStart, onOutputLine, onExecutionEnd],
  );

  const cancelScript = useCallback((executionId: string): void => {
    const child = runningProcesses.current.get(executionId);
    if (child !== undefined) {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }, []);

  return { runScript, cancelScript };
}
