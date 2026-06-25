import { Box, Text } from 'ink';
import React from 'react';

import { WindowPane } from './window-pane.js';

import type { ServiceDisplay } from './layout.js';
import type { SelectionRange } from './log-view.js';
import type { SearchMatch, SelectionState } from '../store/index.js';

export interface MainAreaProps {
  readonly windows: readonly ServiceDisplay[];
  readonly focusedWindowIndex: number;
  readonly width: number;
  readonly height: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly selection: SelectionState | null;
}

function rangeForService(
  serviceId: string,
  selection: SelectionState | null,
): SelectionRange | null {
  if (selection?.serviceId !== serviceId) {
    return null;
  }
  return {
    startLine: Math.min(selection.anchorLine, selection.headLine),
    endLine: Math.max(selection.anchorLine, selection.headLine),
  };
}

/**
 * Split the available height into one full-width row per window.
 * Each terminal line belongs to exactly one window so native text
 * selection never bleeds across windows. The last row absorbs the remainder.
 */
export function computeWindowRows(count: number, height: number): number[] {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(height / count);
  const rows: number[] = [];
  for (let i = 0; i < count; i++) {
    rows.push(i === count - 1 ? height - base * (count - 1) : base);
  }
  return rows;
}

function EmptyMain({ width, height }: { width: number; height: number }): React.ReactElement {
  return (
    <Box width={width} height={height} alignItems="center" justifyContent="center">
      <Text color="gray">Select a service · [Enter] show · [w] add window</Text>
    </Box>
  );
}

export function MainArea({
  windows,
  focusedWindowIndex,
  width,
  height,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  selection,
}: MainAreaProps): React.ReactElement {
  if (windows.length === 0) {
    return <EmptyMain width={width} height={height} />;
  }
  const rows = computeWindowRows(windows.length, height);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {windows.map((service, i) => (
        <WindowPane
          key={service.config.id}
          service={service}
          focused={i === focusedWindowIndex}
          width={width}
          height={rows[i] ?? 0}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          selectedRange={rangeForService(service.config.id, selection)}
        />
      ))}
    </Box>
  );
}
