import { describe, it, expect } from 'vitest';

import { hitTestWindow } from '../../src/utils/window-hit-test.js';

import type { HitGeometry } from '../../src/utils/window-hit-test.js';

// Two stacked windows. svc-a logs occupy rows 6-10 (offset 0), svc-b logs
// occupy rows 14-18 (scrolled so the first visible line is index 20).
const geo: HitGeometry = {
  sidebarWidth: 24,
  windows: [
    { serviceId: 'svc-a', logStartRow: 6, logEndRow: 10, effectiveOffset: 0, logCount: 50 },
    { serviceId: 'svc-b', logStartRow: 14, logEndRow: 18, effectiveOffset: 20, logCount: 50 },
  ],
};

describe('hitTestWindow', () => {
  it('returns null inside the sidebar', () => {
    expect(hitTestWindow(10, 7, geo)).toBeNull();
    expect(hitTestWindow(24, 7, geo)).toBeNull();
  });

  it('maps a click in the first window to the right log index', () => {
    expect(hitTestWindow(30, 6, geo)).toEqual({ serviceId: 'svc-a', logIndex: 0 });
    expect(hitTestWindow(30, 10, geo)).toEqual({ serviceId: 'svc-a', logIndex: 4 });
  });

  it('accounts for scroll offset in the second window', () => {
    expect(hitTestWindow(40, 14, geo)).toEqual({ serviceId: 'svc-b', logIndex: 20 });
    expect(hitTestWindow(40, 18, geo)).toEqual({ serviceId: 'svc-b', logIndex: 24 });
  });

  it('returns null in the gap between windows', () => {
    expect(hitTestWindow(30, 11, geo)).toBeNull();
    expect(hitTestWindow(30, 13, geo)).toBeNull();
  });

  it('returns null below the last window', () => {
    expect(hitTestWindow(30, 25, geo)).toBeNull();
  });

  it('clamps to the last log when the row exceeds the available lines', () => {
    const shortGeo: HitGeometry = {
      sidebarWidth: 10,
      windows: [
        { serviceId: 'x', logStartRow: 5, logEndRow: 9, effectiveOffset: 0, logCount: 2 },
      ],
    };
    expect(hitTestWindow(20, 9, shortGeo)).toEqual({ serviceId: 'x', logIndex: 1 });
  });

  it('returns null for a window with no logs', () => {
    const emptyGeo: HitGeometry = {
      sidebarWidth: 10,
      windows: [{ serviceId: 'x', logStartRow: 5, logEndRow: 9, effectiveOffset: 0, logCount: 0 }],
    };
    expect(hitTestWindow(20, 6, emptyGeo)).toBeNull();
  });
});
