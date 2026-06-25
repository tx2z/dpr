import { describe, it, expect } from 'vitest';

import { computeWindowRows } from '../../src/components/main-area.js';

describe('computeWindowRows', () => {
  it('should return an empty array for zero windows', () => {
    expect(computeWindowRows(0, 40)).toEqual([]);
  });

  it('should give a single window the full height', () => {
    expect(computeWindowRows(1, 40)).toEqual([40]);
  });

  it('should split evenly when divisible', () => {
    expect(computeWindowRows(2, 40)).toEqual([20, 20]);
    expect(computeWindowRows(4, 40)).toEqual([10, 10, 10, 10]);
  });

  it('should give the remainder to the last window', () => {
    const rows = computeWindowRows(3, 40);
    expect(rows).toEqual([13, 13, 14]);
    expect(rows.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it('should keep heights summing to the total for any count', () => {
    for (let count = 1; count <= 4; count++) {
      const rows = computeWindowRows(count, 37);
      expect(rows).toHaveLength(count);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(37);
    }
  });
});
