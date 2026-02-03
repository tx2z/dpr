import { Box, Text, useStdout } from 'ink';
import React from 'react';

import { LogView } from './log-view.js';

import type { LogLine, ServiceConfig, ServiceState } from '../config/index.js';
import type { SearchMatch, VisualModeState } from '../store/index.js';

export interface FullscreenOverlayProps {
  readonly config: ServiceConfig;
  readonly state: ServiceState;
  readonly logs: readonly LogLine[];
  readonly scrollOffset: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly visualModeState: VisualModeState | null;
  readonly isVisualMode: boolean;
  readonly fullscreenCursor: number | null;
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

function getSelectionRange(
  visualModeState: VisualModeState | null,
): { startLine: number; endLine: number } | null {
  if (visualModeState === null) {
    return null;
  }
  const { cursorLine, selectionStart } = visualModeState;
  return {
    startLine: Math.min(cursorLine, selectionStart),
    endLine: Math.max(cursorLine, selectionStart),
  };
}

function getFooterText(isVisualMode: boolean): string {
  if (isVisualMode) {
    return '[↑↓/jk] move cursor · [y] copy selection · [Y] copy all · [Esc] exit visual';
  }
  return '[↑↓/jk] move cursor · [←→] page · [g/G] top/bottom · [v] visual · [Esc] close';
}

interface HeaderProps {
  readonly config: ServiceConfig;
  readonly status: { text: string; color: string };
  readonly isVisualMode: boolean;
}

function FullscreenHeader({ config, status, isVisualMode }: HeaderProps): React.ReactElement {
  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Text color={config.color} bold>
        {config.name}
      </Text>
      <Box>
        {isVisualMode && (
          <Text color="cyan" bold>
            -- VISUAL -- {'  '}
          </Text>
        )}
        <Text color={status.color}>{status.text}</Text>
      </Box>
    </Box>
  );
}

export function FullscreenOverlay({
  config,
  state,
  logs,
  scrollOffset,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  visualModeState,
  isVisualMode,
  fullscreenCursor,
}: FullscreenOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalHeight = stdout.rows;
  const contentHeight = Math.max(1, terminalHeight - 6);
  const status = getStatusText(state);
  const selectionRange = getSelectionRange(visualModeState);
  const footerText = getFooterText(isVisualMode);
  // In visual mode, use visual cursor; otherwise use fullscreen cursor
  const cursorLine = isVisualMode ? visualModeState?.cursorLine ?? null : fullscreenCursor;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={config.color}
      paddingX={1}
      flexGrow={1}
    >
      <FullscreenHeader config={config} status={status} isVisualMode={isVisualMode} />
      <Box flexDirection="column" flexGrow={1}>
        <LogView
          lines={logs}
          scrollOffset={scrollOffset}
          height={contentHeight}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          serviceId={config.id}
          selectionRange={selectionRange}
          cursorLine={cursorLine}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">{footerText}</Text>
      </Box>
    </Box>
  );
}
