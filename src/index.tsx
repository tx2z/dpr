#!/usr/bin/env node

import { render } from 'ink';
import React from 'react';

import { App } from './app.js';
import { CircularDependencyError } from './config/dependencies.js';
import {
  ConfigNotFoundError,
  ConfigValidationError,
  loadConfig,
  validateConfig,
} from './config/index.js';

interface CliArgs {
  configPath: string | undefined;
  validate: boolean;
  help: boolean;
  version: boolean;
}

function isConfigFlag(arg: string): boolean {
  return arg === '--config' || arg === '-c';
}

function isValidateFlag(arg: string): boolean {
  return arg === '--validate' || arg === '-v';
}

function isHelpFlag(arg: string): boolean {
  return arg === '--help' || arg === '-h';
}

function isVersionFlag(arg: string): boolean {
  return arg === '--version' || arg === '-V';
}

function parseArgs(args: readonly string[]): CliArgs {
  let configPath: string | undefined;
  let validate = false;
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }
    if (isConfigFlag(arg)) {
      configPath = args[i + 1];
      i++;
    } else if (isValidateFlag(arg)) {
      validate = true;
    } else if (isHelpFlag(arg)) {
      help = true;
    } else if (isVersionFlag(arg)) {
      version = true;
    } else if (arg.startsWith('--config=')) {
      configPath = arg.slice(9);
    }
  }

  return { configPath, validate, help, version };
}

function printHelp(): void {
  const helpText = `
dpr - Dev Process Runner

A TUI tool to manage multiple development services simultaneously.

USAGE:
  dpr [OPTIONS]

OPTIONS:
  -c, --config <path>  Path to config file (default: ./dpr.yaml)
  -v, --validate       Validate config file and exit
  -h, --help           Show this help message
  -V, --version        Show version

KEYBOARD SHORTCUTS:
  Tab / Shift+Tab      Navigate between spaces
  1-6                  Focus space by number
  /                    Open command palette
  ?                    Open search
  q / Ctrl+C           Quit

COMMANDS:
  /start <n>           Start service in space n
  /stop <n>            Stop service in space n
  /kill <n>            Force kill service in space n
  /restart <n>         Restart service in space n
  /start-all           Start all services
  /stop-all            Stop all services
  /clear <n>           Clear logs in space n
  /quit                Stop all and exit

For more information, see: https://github.com/your-repo/dpr
`;
  process.stdout.write(`${helpText}\n`);
}

function printVersion(): void {
  process.stdout.write('dpr v1.0.0\n');
}

function printError(message: string): void {
  process.stderr.write(`\x1b[31mError:\x1b[0m ${message}\n`);
}

function printErrorList(header: string, errors: readonly string[]): void {
  printError(header);
  for (const error of errors) {
    process.stderr.write(`  - ${error}\n`);
  }
}

function handleValidation(configPath: string | undefined): void {
  const result = validateConfig(configPath);
  if (result.valid) {
    process.stdout.write('\x1b[32m✓\x1b[0m Config is valid\n');
    process.exit(0);
  }
  printErrorList('Config validation failed:', result.errors);
  process.exit(1);
}

function handleConfigError(error: unknown): void {
  if (error instanceof ConfigNotFoundError) {
    const paths = error.searchedPaths.join(', ');
    printError(`Config file not found.\nSearched: ${paths}`);
    printError('Create a dpr.yaml file or specify a path with --config');
    process.exit(1);
  }
  if (error instanceof ConfigValidationError) {
    printErrorList('Config validation failed:', error.issues);
    process.exit(1);
  }
  if (error instanceof CircularDependencyError) {
    printError(`Circular dependency detected: ${error.cycle.join(' → ')}`);
    process.exit(1);
  }
  throw error;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    printVersion();
    process.exit(0);
  }

  if (args.validate) {
    handleValidation(args.configPath);
    return;
  }

  try {
    const config = loadConfig(args.configPath);
    render(<App config={config} />);
  } catch (error) {
    handleConfigError(error);
  }
}

main();
