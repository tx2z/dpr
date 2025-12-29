import { describe, it, expect } from 'vitest';

import { buildDependencyGraph, detectCircularDependencies, getStartOrder } from '../../src/config/dependencies.js';

import type { ServiceConfig } from '../../src/config/types.js';

const createService = (id: string, dependsOn: string[] = []): ServiceConfig => ({
  id,
  name: id,
  dir: '.',
  start: 'npm start',
  stop: null,
  autostart: false,
  color: 'green',
  logs: false,
  env: {},
  dependsOn,
  readyPattern: null,
  readyDelay: 500,
});

describe('buildDependencyGraph', () => {
  it('should build graph with no dependencies', () => {
    const services = [createService('api'), createService('web')];
    const graph = buildDependencyGraph(services);

    expect(graph.nodes.has('api')).toBe(true);
    expect(graph.nodes.has('web')).toBe(true);
    expect([...(graph.edges.get('api') ?? [])]).toEqual([]);
    expect([...(graph.edges.get('web') ?? [])]).toEqual([]);
  });

  it('should build graph with dependencies', () => {
    const services = [createService('api'), createService('web', ['api'])];
    const graph = buildDependencyGraph(services);

    expect([...(graph.edges.get('api') ?? [])]).toEqual([]);
    expect([...(graph.edges.get('web') ?? [])]).toEqual(['api']);
  });

  it('should handle complex dependency chains', () => {
    const services = [
      createService('db'),
      createService('cache'),
      createService('api', ['db', 'cache']),
      createService('web', ['api']),
    ];
    const graph = buildDependencyGraph(services);

    expect([...(graph.edges.get('db') ?? [])]).toEqual([]);
    expect([...(graph.edges.get('cache') ?? [])]).toEqual([]);
    expect([...(graph.edges.get('api') ?? [])].sort()).toEqual(['cache', 'db']);
    expect([...(graph.edges.get('web') ?? [])]).toEqual(['api']);
  });
});

describe('detectCircularDependencies', () => {
  it('should return null for no dependencies', () => {
    const services = [createService('api'), createService('web')];
    const graph = buildDependencyGraph(services);
    const cycle = detectCircularDependencies(graph);

    expect(cycle).toBeNull();
  });

  it('should return null for valid dependencies', () => {
    const services = [createService('api'), createService('web', ['api'])];
    const graph = buildDependencyGraph(services);
    const cycle = detectCircularDependencies(graph);

    expect(cycle).toBeNull();
  });

  it('should detect direct circular dependency', () => {
    const services = [createService('api', ['web']), createService('web', ['api'])];
    const graph = buildDependencyGraph(services);
    const cycle = detectCircularDependencies(graph);

    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect indirect circular dependency', () => {
    const services = [
      createService('a', ['c']),
      createService('b', ['a']),
      createService('c', ['b']),
    ];
    const graph = buildDependencyGraph(services);
    const cycle = detectCircularDependencies(graph);

    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getStartOrder', () => {
  it('should return services in order when no dependencies', () => {
    const services = [createService('api'), createService('web')];
    const order = getStartOrder(['api', 'web'], services);

    expect(order).toHaveLength(2);
    expect(order).toContain('api');
    expect(order).toContain('web');
  });

  it('should return dependencies before dependents', () => {
    const services = [createService('api'), createService('web', ['api'])];
    const order = getStartOrder(['api', 'web'], services);

    expect(order.indexOf('api')).toBeLessThan(order.indexOf('web'));
  });

  it('should handle complex dependency chains', () => {
    const services = [
      createService('db'),
      createService('cache'),
      createService('api', ['db', 'cache']),
      createService('web', ['api']),
    ];
    const order = getStartOrder(['db', 'cache', 'api', 'web'], services);

    expect(order.indexOf('db')).toBeLessThan(order.indexOf('api'));
    expect(order.indexOf('cache')).toBeLessThan(order.indexOf('api'));
    expect(order.indexOf('api')).toBeLessThan(order.indexOf('web'));
  });

  it('should only include requested services', () => {
    const services = [
      createService('db'),
      createService('api', ['db']),
      createService('web', ['api']),
    ];
    const order = getStartOrder(['api', 'web'], services);

    expect(order).not.toContain('db');
    expect(order).toContain('api');
    expect(order).toContain('web');
  });

  it('should throw on circular dependencies', () => {
    const services = [createService('api', ['web']), createService('web', ['api'])];

    expect(() => getStartOrder(['api', 'web'], services)).toThrow(/Circular dependency/);
  });
});
