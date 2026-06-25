/**
 * Geometry for mapping a terminal mouse coordinate to a log line inside one of
 * the stacked log windows in the sidebar view. All rows/cols are 1-indexed to
 * match terminal SGR mouse coordinates.
 */
export interface WindowLayout {
  readonly serviceId: string;
  readonly logStartRow: number; // first row showing a log line
  readonly logEndRow: number; // last row showing a log line (inclusive)
  readonly effectiveOffset: number; // index of the first visible log line
  readonly logCount: number;
}

export interface HitGeometry {
  readonly sidebarWidth: number; // columns occupied by the sidebar on the left
  readonly windows: readonly WindowLayout[];
}

export interface WindowHit {
  readonly serviceId: string;
  readonly logIndex: number;
}

/**
 * Resolve which window and log line a (col, row) click lands on.
 * Returns null when the point is in the sidebar, between/around windows, or on
 * an empty padded row of a window with no logs.
 */
export function hitTestWindow(col: number, row: number, geo: HitGeometry): WindowHit | null {
  if (col <= geo.sidebarWidth) {
    return null;
  }
  for (const w of geo.windows) {
    if (row < w.logStartRow || row > w.logEndRow || w.logCount === 0) {
      continue;
    }
    const lineInView = row - w.logStartRow;
    const logIndex = Math.min(w.logCount - 1, w.effectiveOffset + lineInView);
    return { serviceId: w.serviceId, logIndex };
  }
  return null;
}
