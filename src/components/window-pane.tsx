import { Box, Text } from 'ink';
import React from 'react';

import { getStatusDisplay } from '../utils/index.js';

import { LogView } from './log-view.js';

import type { ServiceDisplay } from './layout.js';
import type { SelectionRange } from './log-view.js';
import type { SearchMatch } from '../store/index.js';

export interface WindowPaneProps {
  readonly service: ServiceDisplay;
  readonly focused: boolean;
  readonly width: number;
  readonly height: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly selectedRange?: SelectionRange | null;
}

export function WindowPane({
  service,
  focused,
  width,
  height,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  selectedRange,
}: WindowPaneProps): React.ReactElement {
  const status = getStatusDisplay(service.state);
  const contentHeight = Math.max(1, height - 3);
  const borderColor = focused ? service.config.color : 'gray';

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={focused ? 'double' : 'round'}
      borderColor={borderColor}
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text color={service.config.color} bold={focused} wrap="truncate">
          {service.config.name}
        </Text>
        <Text color={status.color}>{status.text}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        <LogView
          lines={service.logs}
          scrollOffset={service.scrollOffset}
          height={contentHeight}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          serviceId={service.config.id}
          cursorLine={null}
          selectedRange={selectedRange ?? null}
        />
      </Box>
    </Box>
  );
}
