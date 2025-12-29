import type { ServiceConfig } from './types.js';

export class CircularDependencyError extends Error {
  public readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

interface DependencyGraph {
  readonly nodes: ReadonlySet<string>;
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>;
}

export function buildDependencyGraph(services: readonly ServiceConfig[]): DependencyGraph {
  const nodes = new Set(services.map((s) => s.id));
  const edges = new Map<string, Set<string>>();

  for (const service of services) {
    edges.set(service.id, new Set(service.dependsOn));
  }

  return {
    nodes,
    edges: edges as ReadonlyMap<string, ReadonlySet<string>>,
  };
}

export function detectCircularDependencies(graph: DependencyGraph): readonly string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): readonly string[] | null {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const dependencies = graph.edges.get(nodeId);
    if (dependencies !== undefined) {
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          const cycle = dfs(dep);
          if (cycle !== null) {
            return cycle;
          }
        } else if (recursionStack.has(dep)) {
          // Found cycle - extract it from path
          const cycleStart = path.indexOf(dep);
          return [...path.slice(cycleStart), dep];
        }
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return null;
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle !== null) {
        return cycle;
      }
    }
  }

  return null;
}

export function topologicalSort(services: readonly ServiceConfig[]): readonly ServiceConfig[] {
  const graph = buildDependencyGraph(services);
  const cycle = detectCircularDependencies(graph);

  if (cycle !== null) {
    throw new CircularDependencyError(cycle);
  }

  const visited = new Set<string>();
  const result: ServiceConfig[] = [];
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const dependencies = graph.edges.get(nodeId);
    if (dependencies !== undefined) {
      for (const dep of dependencies) {
        visit(dep);
      }
    }

    const service = serviceMap.get(nodeId);
    if (service !== undefined) {
      result.push(service);
    }
  }

  for (const node of graph.nodes) {
    visit(node);
  }

  return result;
}

export function getServiceDependents(
  serviceId: string,
  services: readonly ServiceConfig[],
): readonly string[] {
  return services.filter((s) => s.dependsOn.includes(serviceId)).map((s) => s.id);
}

export function getStartOrder(
  serviceIds: readonly string[],
  services: readonly ServiceConfig[],
): readonly string[] {
  const sorted = topologicalSort(services);
  const idSet = new Set(serviceIds);
  return sorted.filter((s) => idSet.has(s.id)).map((s) => s.id);
}
