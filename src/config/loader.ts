import * as fs from 'node:fs';
import * as path from 'node:path';

import yaml from 'js-yaml';
import { ZodError } from 'zod';

import {
  CircularDependencyError,
  detectCircularDependencies,
  buildDependencyGraph,
} from './dependencies.js';
import { assignDefaultColors, parseConfig } from './schema.js';

import type { RawConfig } from './schema.js';
import type { Config, ServiceConfig, GlobalConfig } from './types.js';

export class ConfigNotFoundError extends Error {
  public readonly searchedPaths: readonly string[];

  constructor(searchedPaths: readonly string[]) {
    super(`Config file not found. Searched: ${searchedPaths.join(', ')}`);
    this.name = 'ConfigNotFoundError';
    this.searchedPaths = searchedPaths;
  }
}

export class ConfigParseError extends Error {
  public readonly filePath: string;
  public readonly originalError: Error;

  constructor(filePath: string, originalError: Error) {
    super(`Failed to parse config file "${filePath}": ${originalError.message}`);
    this.name = 'ConfigParseError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

export class ConfigValidationError extends Error {
  public readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Config validation failed:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

const DEFAULT_CONFIG_PATHS = ['./dpr.yaml', './dpr.config.yaml', '~/.config/dpr/config.yaml'];

function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/')) {
    const home = process.env['HOME'];
    if (home !== undefined) {
      return path.join(home, filePath.slice(2));
    }
  }
  return filePath;
}

function resolveConfigPath(configPath: string | undefined): string {
  if (configPath !== undefined) {
    const expanded = expandTilde(configPath);
    const resolved = path.resolve(expanded);
    if (!fs.existsSync(resolved)) {
      throw new ConfigNotFoundError([resolved]);
    }
    return resolved;
  }

  const searchedPaths: string[] = [];
  for (const p of DEFAULT_CONFIG_PATHS) {
    const expanded = expandTilde(p);
    const resolved = path.resolve(expanded);
    searchedPaths.push(resolved);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  throw new ConfigNotFoundError(searchedPaths);
}

function transformRawConfig(raw: RawConfig, configDir: string): Config {
  const colors = assignDefaultColors(raw.services);

  const services: ServiceConfig[] = raw.services.map((s, index) => ({
    id: s.id,
    name: s.name ?? s.id,
    dir: s.dir !== undefined ? path.resolve(configDir, s.dir) : configDir,
    start: s.start,
    stop: s.stop ?? null,
    autostart: s.autostart,
    color: colors[index] ?? 'green',
    logs: s.logs ?? raw.logs,
    env: s.env,
    dependsOn: s.dependsOn,
    readyPattern: s.readyPattern ?? null,
    readyDelay: s.readyDelay,
    runOnce: s.runOnce,
    keepRunning: s.keepRunning,
    scripts: s.scripts.map((script) => ({
      id: script.id,
      name: script.name,
      command: script.command,
      key: script.key ?? null,
      params: script.params,
    })),
  }));

  const global: GlobalConfig = {
    name: raw.name ?? null,
    columns: raw.columns,
    logs: raw.logs,
    logsDir: expandTilde(raw.logsDir),
  };

  return { global, services };
}

export function loadConfig(configPath?: string): Config {
  const resolvedPath = resolveConfigPath(configPath);
  const configDir = path.dirname(resolvedPath);

  let content: string;
  try {
    content = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    throw new ConfigParseError(
      resolvedPath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  let data: unknown;
  try {
    data = yaml.load(content);
  } catch (error) {
    throw new ConfigParseError(
      resolvedPath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  let rawConfig: RawConfig;
  try {
    rawConfig = parseConfig(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new ConfigValidationError(issues);
    }
    throw error;
  }

  const config = transformRawConfig(rawConfig, configDir);

  // Check for circular dependencies
  const graph = buildDependencyGraph(config.services);
  const cycle = detectCircularDependencies(graph);
  if (cycle !== null) {
    throw new CircularDependencyError(cycle);
  }

  return config;
}

export function validateConfig(configPath?: string): { valid: boolean; errors: readonly string[] } {
  try {
    loadConfig(configPath);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      return { valid: false, errors: [`Config not found: ${error.searchedPaths.join(', ')}`] };
    }
    if (error instanceof ConfigParseError) {
      return { valid: false, errors: [error.message] };
    }
    if (error instanceof ConfigValidationError) {
      return { valid: false, errors: [...error.issues] };
    }
    if (error instanceof CircularDependencyError) {
      return { valid: false, errors: [error.message] };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
