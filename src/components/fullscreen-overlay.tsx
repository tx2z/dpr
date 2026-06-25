import { Box, Text, useStdout } from 'ink';
import React from 'react';

import { getStatusDisplay } from '../utils/index.js';

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
  readonly fullscreenCursor: number | null;
}

const FOOTER_TEXT =
  '[↑↓/jk] move cursor · [←→] page · [g/G] top/bottom · [y/Y] copy · [Esc] close';

interface HeaderProps {
  readonly config: ServiceConfig;
  readonly status: { text: string; color: string };
}

function FullscreenHeader({ config, status }: HeaderProps): React.ReactElement {
  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Text color={config.color} bold>
        {config.name}
      </Text>
      <Text color={status.color}>{status.text}</Text>
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
  fullscreenCursor,
}: FullscreenOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalHeight = stdout.rows;
  // Budget: outer Header (3) + this overlay's border (2) + its header (2) +
  // footer (2) = 9, plus 1 row of headroom so the frame never fills the
  // terminal exactly (a full-height frame makes ink repaint everything =
  // flicker). The overlay must NOT flexGrow, or it stretches to full height.
  const contentHeight = Math.max(1, terminalHeight - 10);
  const status = getStatusDisplay(state);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={config.color} paddingX={1}>
      <FullscreenHeader config={config} status={status} />
      <Box flexDirection="column">
        <LogView
          lines={logs}
          scrollOffset={scrollOffset}
          height={contentHeight}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          serviceId={config.id}
          cursorLine={fullscreenCursor}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">{FOOTER_TEXT}</Text>
      </Box>
    </Box>
  );
}
