import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createFileLogger } from '../../src/utils/file-logger.js';

import type { LogLine } from '../../src/config/types.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('createFileLogger', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `dpr-test-${String(Date.now())}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(async () => {
    await wait(50);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should create log directory if it does not exist', () => {
    const logger = createFileLogger(testDir, 'api');
    expect(fs.existsSync(testDir)).toBe(true);
    logger.close();
  });

  it('should create log file for service', async () => {
    const logger = createFileLogger(testDir, 'api');
    const logLine: LogLine = {
      timestamp: new Date('2024-01-15T10:30:00Z'),
      content: 'Server started',
      stream: 'stdout',
    };
    logger.write(logLine);
    logger.close();
    await wait(50);

    const logPath = path.join(testDir, 'api.log');
    expect(fs.existsSync(logPath)).toBe(true);
  });

  it('should write log line with timestamp', async () => {
    const logger = createFileLogger(testDir, 'api');
    const logLine: LogLine = {
      timestamp: new Date('2024-01-15T10:30:00.000Z'),
      content: 'Server started',
      stream: 'stdout',
    };
    logger.write(logLine);
    logger.close();
    await wait(50);

    const logPath = path.join(testDir, 'api.log');
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('[2024-01-15T10:30:00.000Z]');
    expect(content).toContain('Server started');
  });

  it('should mark stderr lines with [ERR] prefix', async () => {
    const logger = createFileLogger(testDir, 'api');
    const logLine: LogLine = {
      timestamp: new Date('2024-01-15T10:30:00.000Z'),
      content: 'Error occurred',
      stream: 'stderr',
    };
    logger.write(logLine);
    logger.close();
    await wait(50);

    const logPath = path.join(testDir, 'api.log');
    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('[ERR]');
    expect(content).toContain('Error occurred');
  });

  it('should append multiple log lines', async () => {
    const logger = createFileLogger(testDir, 'api');
    logger.write({ timestamp: new Date(), content: 'Line 1', stream: 'stdout' });
    logger.write({ timestamp: new Date(), content: 'Line 2', stream: 'stdout' });
    logger.write({ timestamp: new Date(), content: 'Line 3', stream: 'stdout' });
    logger.close();
    await wait(50);

    const logPath = path.join(testDir, 'api.log');
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  it('should expand tilde in path', async () => {
    const homeTempDir = path.join(os.homedir(), `.dpr-test-temp-${String(Date.now())}`);

    try {
      const tildeDir = `~/${path.basename(homeTempDir)}`;
      const logger = createFileLogger(tildeDir, 'api');
      logger.write({ timestamp: new Date(), content: 'test', stream: 'stdout' });
      logger.close();
      await wait(50);

      expect(fs.existsSync(path.join(homeTempDir, 'api.log'))).toBe(true);
    } finally {
      if (fs.existsSync(homeTempDir)) {
        fs.rmSync(homeTempDir, { recursive: true });
      }
    }
  });

  it('should handle different service IDs', async () => {
    const logger1 = createFileLogger(testDir, 'api');
    const logger2 = createFileLogger(testDir, 'web');

    logger1.write({ timestamp: new Date(), content: 'api log', stream: 'stdout' });
    logger2.write({ timestamp: new Date(), content: 'web log', stream: 'stdout' });

    logger1.close();
    logger2.close();
    await wait(50);

    expect(fs.existsSync(path.join(testDir, 'api.log'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'web.log'))).toBe(true);
  });
});
