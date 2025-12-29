import { describe, it, expect } from 'vitest';

import { parseConfig, assignDefaultColors } from '../../src/config/schema.js';

describe('parseConfig', () => {
  const validMinimalConfig = {
    services: [
      { id: 'api', start: 'npm run api' },
      { id: 'web', start: 'npm run web' },
    ],
  };

  it('should parse a valid minimal config', () => {
    const result = parseConfig(validMinimalConfig);
    expect(result.services).toHaveLength(2);
    expect(result.columns).toBe('auto');
    expect(result.logs).toBe(false);
  });

  it('should apply default values', () => {
    const result = parseConfig(validMinimalConfig);
    expect(result.services[0]?.autostart).toBe(false);
    expect(result.services[0]?.dependsOn).toEqual([]);
    expect(result.services[0]?.readyDelay).toBe(500);
  });

  it('should parse full config with all options', () => {
    const fullConfig = {
      name: 'My Project',
      columns: 2,
      logs: true,
      logsDir: '/tmp/logs',
      services: [
        {
          id: 'api',
          name: 'API Server',
          dir: '/app/api',
          start: 'npm run start',
          stop: 'npm run stop',
          autostart: true,
          color: 'green',
          logs: true,
          env: { NODE_ENV: 'production' },
          dependsOn: [],
          readyPattern: 'listening on',
          readyDelay: 1000,
        },
        {
          id: 'web',
          start: 'npm run web',
        },
      ],
    };

    const result = parseConfig(fullConfig);
    expect(result.name).toBe('My Project');
    expect(result.columns).toBe(2);
    expect(result.logs).toBe(true);
    expect(result.logsDir).toBe('/tmp/logs');
    expect(result.services[0]?.name).toBe('API Server');
  });

  it('should reject config with less than 2 services', () => {
    expect(() => parseConfig({ services: [{ id: 'api', start: 'npm run api' }] })).toThrow();
  });

  it('should reject config with more than 6 services', () => {
    const services = Array.from({ length: 7 }, (_, i) => ({
      id: `service-${String(i)}`,
      start: 'npm start',
    }));
    expect(() => parseConfig({ services })).toThrow();
  });

  it('should reject duplicate service IDs', () => {
    const config = {
      services: [
        { id: 'api', start: 'npm run api' },
        { id: 'api', start: 'npm run api2' },
      ],
    };
    expect(() => parseConfig(config)).toThrow(/Duplicate service IDs/);
  });

  it('should reject invalid dependsOn references', () => {
    const config = {
      services: [
        { id: 'api', start: 'npm run api', dependsOn: ['nonexistent'] },
        { id: 'web', start: 'npm run web' },
      ],
    };
    expect(() => parseConfig(config)).toThrow(/depends on unknown service/);
  });

  it('should reject self-referencing dependencies', () => {
    const config = {
      services: [
        { id: 'api', start: 'npm run api', dependsOn: ['api'] },
        { id: 'web', start: 'npm run web' },
      ],
    };
    expect(() => parseConfig(config)).toThrow(/cannot depend on itself/);
  });

  it('should reject invalid service ID characters', () => {
    const config = {
      services: [
        { id: 'api server', start: 'npm run api' },
        { id: 'web', start: 'npm run web' },
      ],
    };
    expect(() => parseConfig(config)).toThrow();
  });

  it('should reject invalid color values', () => {
    const config = {
      services: [
        { id: 'api', start: 'npm run api', color: 'purple' },
        { id: 'web', start: 'npm run web' },
      ],
    };
    expect(() => parseConfig(config)).toThrow();
  });
});

describe('assignDefaultColors', () => {
  const baseService = {
    autostart: false,
    env: {},
    dependsOn: [] as string[],
    readyDelay: 500,
  };

  it('should preserve explicit colors', () => {
    const services = [
      { ...baseService, id: 'api', start: 'npm start', color: 'red' as const },
      { ...baseService, id: 'web', start: 'npm start', color: 'blue' as const },
    ];
    const colors = assignDefaultColors(services);
    expect(colors).toEqual(['red', 'blue']);
  });

  it('should assign default colors in order', () => {
    const services = [
      { ...baseService, id: 'api', start: 'npm start' },
      { ...baseService, id: 'web', start: 'npm start' },
      { ...baseService, id: 'worker', start: 'npm start' },
    ];
    const colors = assignDefaultColors(services);
    expect(colors).toEqual(['green', 'blue', 'yellow']);
  });

  it('should cycle through colors when more than 6 services', () => {
    const services = Array.from({ length: 7 }, (_, i) => ({
      ...baseService,
      id: `service-${String(i)}`,
      start: 'npm start',
    }));
    const colors = assignDefaultColors(services);
    expect(colors[6]).toBe('green');
  });
});
