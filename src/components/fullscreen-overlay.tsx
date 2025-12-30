import { Box, Text, useStdout } from 'ink';
import React from 'react';

import { LogView } from './log-view.js';

import type { LogLine, ServiceConfig, ServiceState } from '../config/index.js';
import type { SearchMatch } from '../store/index.js';

export interface FullscreenOverlayProps {
  readonly config: ServiceConfig;
  readonly state: ServiceState;
  readonly logs: readonly LogLine[];
  readonly scrollOffset: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
}

function getStatusText(state: ServiceState): { text: string; color: string } {
  switch (state.status) {
    case 'stopped':
      return { text: 'Stopped', color: 'gray' };
    case 'waiting':
      return { text: `Waiting: ${state.waitingFor.join(', ')}`, color: 'yellow' };
    case 'starting':
      return { text: 'Starting...', color: 'yellow' };
    case 'ready':
      return { text: 'Running', color: 'green' };
    case 'stopping':
      return { text: 'Stopping...', color: 'yellow' };
    case 'crashed': {
      const exitCode = state.exitCode !== null ? String(state.exitCode) : '?';
      return { text: `Crashed (exit ${exitCode})`, color: 'red' };
    }
  }
}

export function FullscreenOverlay({
  config,
  state,
  logs,
  scrollOffset,
  searchTerm,
  searchMatches,
  currentMatchIndex,
}: FullscreenOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalHeight = stdout.rows;
  const contentHeight = Math.max(1, terminalHeight - 6);
  const status = getStatusText(state);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={config.color}
      paddingX={1}
      flexGrow={1}
    >
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={config.color} bold>
          {config.name}
        </Text>
        <Text color={status.color}>{status.text}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <LogView
          lines={logs}
          scrollOffset={scrollOffset}
          height={contentHeight}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          serviceId={config.id}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">[↑↓/jk] scroll · [←→] page · [g/G] top/bottom · [Esc] close</Text>
      </Box>
    </Box>
  );
}
