import { vi } from 'vitest';

import type NodeProcess from 'node:process';

// Mock process.stdout for ink tests
vi.mock('node:process', async () => {
  const actual = await vi.importActual<typeof NodeProcess>('node:process');
  return {
    ...actual,
    stdout: {
      ...actual.stdout,
      columns: 120,
      rows: 40,
    },
  };
});
