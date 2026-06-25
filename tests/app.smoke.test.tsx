import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { App } from '../src/app.js';

import type { Config, ServiceConfig } from '../src/config/types.js';

const makeService = (id: string): ServiceConfig => ({
  id,
  name: `Service ${id}`,
  dir: '.',
  start: 'npm start',
  stop: null,
  autostart: false,
  color: 'green',
  logs: false,
  env: {},
  dependsOn: [],
  readyPattern: null,
  readyDelay: 500,
  scripts: [],
  runOnce: false,
  keepRunning: false,
});

const makeConfig = (count: number): Config => ({
  global: { name: 'Smoke', columns: 'auto', logs: false, logsDir: '~/.dpr/logs' },
  services: Array.from({ length: count }, (_, i) => makeService(`svc-${String(i)}`)),
});

describe('App render smoke test', () => {
  it('renders the grid view for a small project', () => {
    const { lastFrame, unmount } = render(<App config={makeConfig(3)} />);
    expect(lastFrame()).toContain('Smoke');
    unmount();
  });

  it('renders the sidebar view when forced above the threshold', () => {
    const { lastFrame, unmount } = render(<App config={makeConfig(8)} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Services');
    unmount();
  });

  it('enters the stream view without crashing', async () => {
    const { lastFrame, stdin, unmount } = render(<App config={makeConfig(8)} />);
    // Sidebar is forced (>6 services); 'v' enters the stream view.
    stdin.write('v');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('streaming');
    unmount();
  });
});
