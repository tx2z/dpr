import { Box, useStdout } from 'ink';
import React from 'react';

import { Space } from './space.js';

import type { ServiceConfig, ServiceState, LogLine } from '../config/index.js';
import type { SearchMatch } from '../store/index.js';

export interface ServiceDisplay {
  readonly config: ServiceConfig;
  readonly state: ServiceState;
  readonly logs: readonly LogLine[];
  readonly scrollOffset: number;
}

export interface LayoutProps {
  readonly services: readonly ServiceDisplay[];
  readonly columnsConfig: number | 'auto';
  readonly focusedIndex: number | null;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly onStart?: (serviceId: string) => void;
  readonly onStop?: (serviceId: string) => void;
  readonly onKill?: (serviceId: string) => void;
}

const HEADER_FOOTER_HEIGHT = 6;
const MIN_HEIGHT = 10;

function calculateColumns(
  configColumns: number | 'auto',
  serviceCount: number,
  terminalWidth: number,
): number {
  if (configColumns !== 'auto') {
    return Math.min(configColumns, serviceCount);
  }

  if (terminalWidth < 80) {
    return 1;
  }
  if (terminalWidth < 120) {
    return Math.min(2, serviceCount);
  }
  return Math.min(3, serviceCount);
}

function chunkArray<T>(array: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push([...array.slice(i, i + size)]);
  }
  return result;
}

interface LayoutRowProps {
  readonly rowServices: readonly ServiceDisplay[];
  readonly rowIndex: number;
  readonly isLastRow: boolean;
  readonly columns: number;
  readonly spaceWidth: number;
  readonly rowHeight: number;
  readonly rows: readonly (readonly ServiceDisplay[])[];
  readonly focusedIndex: number | null;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly onStart: (serviceId: string) => void;
  readonly onStop: (serviceId: string) => void;
  readonly onKill: (serviceId: string) => void;
}

function calculateGlobalIndex(
  rows: readonly (readonly ServiceDisplay[])[],
  rowIndex: number,
): number {
  return rows.slice(0, rowIndex).reduce((sum, r) => sum + r.length, 0);
}

function calculateSpaceWidth(
  isLastItem: boolean,
  lastRowSpan: boolean,
  spaceWidth: number,
  columns: number,
  colIndex: number,
): number {
  if (lastRowSpan && isLastItem) {
    return spaceWidth * (columns - colIndex);
  }
  return spaceWidth;
}

function LayoutRow(props: LayoutRowProps): React.ReactElement {
  const { rowServices, rowIndex, isLastRow, columns, spaceWidth, rowHeight } = props;
  const { rows, focusedIndex, searchTerm, searchMatches, currentMatchIndex } = props;
  const { onStart, onStop, onKill } = props;

  const servicesInRow = rowServices.length;
  const lastRowSpan = isLastRow && servicesInRow < columns;
  const baseIndex = calculateGlobalIndex(rows, rowIndex);

  return (
    <Box flexDirection="row">
      {rowServices.map((service, colIndex) => {
        const globalIndex = baseIndex + colIndex;
        const isFocused = focusedIndex === globalIndex;
        const isLastItem = isLastRow && colIndex === servicesInRow - 1;
        const width = calculateSpaceWidth(isLastItem, lastRowSpan, spaceWidth, columns, colIndex);

        return (
          <Space
            key={service.config.id}
            index={globalIndex}
            config={service.config}
            state={service.state}
            logs={service.logs}
            scrollOffset={service.scrollOffset}
            focused={isFocused}
            width={width}
            height={rowHeight}
            searchTerm={searchTerm}
            searchMatches={searchMatches}
            currentMatchIndex={currentMatchIndex}
            onStart={(): void => {
              onStart(service.config.id);
            }}
            onStop={(): void => {
              onStop(service.config.id);
            }}
            onKill={(): void => {
              onKill(service.config.id);
            }}
          />
        );
      })}
    </Box>
  );
}

function noop(): void {
  // Intentional no-op for default callbacks
}

function getTerminalDimensions(stdout: NodeJS.WriteStream): {
  width: number;
  height: number;
} {
  return {
    width: stdout.columns,
    height: stdout.rows,
  };
}

export function Layout({
  services,
  columnsConfig,
  focusedIndex,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  onStart = noop,
  onStop = noop,
  onKill = noop,
}: LayoutProps): React.ReactElement {
  const { stdout } = useStdout();
  const { width: terminalWidth, height: terminalHeight } = getTerminalDimensions(stdout);

  const columns = calculateColumns(columnsConfig, services.length, terminalWidth);
  const rows = chunkArray(services, columns);
  const availableHeight = Math.max(MIN_HEIGHT, terminalHeight - HEADER_FOOTER_HEIGHT);
  const rowHeight = Math.floor(availableHeight / rows.length);
  const spaceWidth = Math.floor((terminalWidth - 2) / columns);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {rows.map((rowServices, rowIndex) => (
        <LayoutRow
          key={rowIndex}
          rowServices={rowServices}
          rowIndex={rowIndex}
          isLastRow={rowIndex === rows.length - 1}
          columns={columns}
          spaceWidth={spaceWidth}
          rowHeight={rowHeight}
          rows={rows}
          focusedIndex={focusedIndex}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          onStart={onStart}
          onStop={onStop}
          onKill={onKill}
        />
      ))}
    </Box>
  );
}
