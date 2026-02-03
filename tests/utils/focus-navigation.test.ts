import { describe, it, expect } from 'vitest';

import {
  calculateNextFocusIndex,
  calculatePrevFocusIndex,
  parseNumberKeyFocus,
} from '../../src/utils/focus-navigation.js';

describe('focus-navigation', () => {
  describe('calculateNextFocusIndex', () => {
    it('should return 0 when no panel is focused', () => {
      expect(calculateNextFocusIndex(null, 3)).toBe(0);
    });

    it('should return next index when a panel is focused', () => {
      expect(calculateNextFocusIndex(0, 3)).toBe(1);
      expect(calculateNextFocusIndex(1, 3)).toBe(2);
    });

    it('should wrap around to 0 at the end', () => {
      expect(calculateNextFocusIndex(2, 3)).toBe(0);
    });

    it('should work with single service', () => {
      expect(calculateNextFocusIndex(0, 1)).toBe(0);
      expect(calculateNextFocusIndex(null, 1)).toBe(0);
    });

    it('should work with many services', () => {
      expect(calculateNextFocusIndex(8, 9)).toBe(0);
      expect(calculateNextFocusIndex(4, 9)).toBe(5);
    });
  });

  describe('calculatePrevFocusIndex', () => {
    it('should return last index when no panel is focused', () => {
      expect(calculatePrevFocusIndex(null, 3)).toBe(2);
    });

    it('should return previous index when a panel is focused', () => {
      expect(calculatePrevFocusIndex(2, 3)).toBe(1);
      expect(calculatePrevFocusIndex(1, 3)).toBe(0);
    });

    it('should wrap around to last at the beginning', () => {
      expect(calculatePrevFocusIndex(0, 3)).toBe(2);
    });

    it('should work with single service', () => {
      expect(calculatePrevFocusIndex(0, 1)).toBe(0);
      expect(calculatePrevFocusIndex(null, 1)).toBe(0);
    });

    it('should work with many services', () => {
      expect(calculatePrevFocusIndex(0, 9)).toBe(8);
      expect(calculatePrevFocusIndex(5, 9)).toBe(4);
    });
  });

  describe('parseNumberKeyFocus', () => {
    it('should return index for valid number keys', () => {
      expect(parseNumberKeyFocus('1', 3)).toBe(0);
      expect(parseNumberKeyFocus('2', 3)).toBe(1);
      expect(parseNumberKeyFocus('3', 3)).toBe(2);
    });

    it('should return null for numbers exceeding service count', () => {
      expect(parseNumberKeyFocus('4', 3)).toBeNull();
      expect(parseNumberKeyFocus('9', 3)).toBeNull();
    });

    it('should return null for 0', () => {
      expect(parseNumberKeyFocus('0', 3)).toBeNull();
    });

    it('should return null for non-numeric input', () => {
      expect(parseNumberKeyFocus('a', 3)).toBeNull();
      expect(parseNumberKeyFocus('q', 3)).toBeNull();
      expect(parseNumberKeyFocus('', 3)).toBeNull();
      expect(parseNumberKeyFocus(' ', 3)).toBeNull();
    });

    it('should work with single service', () => {
      expect(parseNumberKeyFocus('1', 1)).toBe(0);
      expect(parseNumberKeyFocus('2', 1)).toBeNull();
    });

    it('should work with many services (up to 9)', () => {
      expect(parseNumberKeyFocus('9', 9)).toBe(8);
      expect(parseNumberKeyFocus('1', 9)).toBe(0);
    });

    it('should handle double-digit input if within range', () => {
      // Note: In practice, keyboard input is single characters, but the function
      // doesn't restrict this. parseInt('10') = 10, which is valid for 15 services.
      expect(parseNumberKeyFocus('10', 15)).toBe(9);
      expect(parseNumberKeyFocus('10', 5)).toBeNull(); // 10 > 5, so null
    });
  });
});
