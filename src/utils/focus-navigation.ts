/**
 * Calculate the next focus index when cycling forward through panels.
 * @param currentIndex - The currently focused index, or null if none focused
 * @param serviceCount - Total number of services/panels
 * @returns The next index to focus
 */
export function calculateNextFocusIndex(
  currentIndex: number | null,
  serviceCount: number,
): number {
  const current = currentIndex ?? -1;
  return (current + 1) % serviceCount;
}

/**
 * Calculate the previous focus index when cycling backward through panels.
 * @param currentIndex - The currently focused index, or null if none focused
 * @param serviceCount - Total number of services/panels
 * @returns The previous index to focus
 */
export function calculatePrevFocusIndex(
  currentIndex: number | null,
  serviceCount: number,
): number {
  if (currentIndex === null || currentIndex === 0) {
    return serviceCount - 1;
  }
  return currentIndex - 1;
}

/**
 * Parse a number key input (1-9) and return the corresponding panel index.
 * @param input - The key input string
 * @param serviceCount - Total number of services/panels
 * @returns The panel index (0-based), or null if input is not a valid number key
 */
export function parseNumberKeyFocus(input: string, serviceCount: number): number | null {
  const num = Number.parseInt(input, 10);
  if (num >= 1 && num <= serviceCount) {
    return num - 1;
  }
  return null;
}
