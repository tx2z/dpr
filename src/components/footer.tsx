import { Box, Text } from 'ink';
import React from 'react';

import type { AppMode, ViewMode } from '../store/index.js';

export interface FooterProps {
  readonly mode: AppMode;
  readonly viewMode?: ViewMode;
  readonly focusedIndex?: number | null;
  readonly commandInput?: string;
  readonly searchTerm?: string;
  readonly matchCount?: number;
  readonly currentMatch?: number;
  readonly notification?: string | null;
}

// Service actions shared by both views; keep wording identical for consistency.
const SERVICE_ACTIONS = '[s] start · [x] stop · [K] kill · [r] scripts · [h] history · [y/Y] copy';

function getFocusedModeHint(): string {
  return `[1-9/←→/Tab] focus · ${SERVICE_ACTIONS} · [↑↓/g/G] scroll · [Enter] full · [v] stream · [t] sidebar · [Esc] back`;
}

function getSidebarHint(): string {
  return `[jk] select · ${SERVICE_ACTIONS} · [ []/]/g/G] scroll · [Enter] show · [w] window · [Tab] win · [o] full · [v] stream · [t] grid · drag=copy`;
}

function SidebarFooter(): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan" wrap="truncate">
        {getSidebarHint()}
      </Text>
    </Box>
  );
}

function CommandFooter({ commandInput }: { readonly commandInput: string }): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="blue" paddingX={1}>
      <Text color="blue">/ </Text>
      <Text>{commandInput}</Text>
      <Text color="gray">_</Text>
    </Box>
  );
}

function SearchFooter({
  searchTerm,
  matchCount,
  currentMatch,
}: {
  readonly searchTerm: string;
  readonly matchCount: number;
  readonly currentMatch: number;
}): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1} justifyContent="space-between">
      <Box>
        <Text color="yellow">Find: </Text>
        <Text>{searchTerm}</Text>
        <Text color="gray">_</Text>
      </Box>
      {matchCount > 0 && (
        <Text color="gray">
          [{currentMatch + 1}/{matchCount} matches]
        </Text>
      )}
    </Box>
  );
}

function FocusedFooter(): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan" wrap="truncate">
        {getFocusedModeHint()}
      </Text>
    </Box>
  );
}

function EmptyFooter(): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1}>
      <Text> </Text>
    </Box>
  );
}

function NotificationFooter({
  notification,
}: {
  readonly notification: string;
}): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="green" paddingX={1}>
      <Text color="green">{notification}</Text>
    </Box>
  );
}

interface ModeFooterProps {
  readonly mode: AppMode;
  readonly viewMode: ViewMode;
  readonly commandInput: string;
  readonly searchTerm: string;
  readonly matchCount: number;
  readonly currentMatch: number;
  readonly focusedIndex: number | null;
}

function renderModeFooter({
  mode,
  viewMode,
  commandInput,
  searchTerm,
  matchCount,
  currentMatch,
  focusedIndex,
}: ModeFooterProps): React.ReactElement {
  if (mode === 'command') {
    return <CommandFooter commandInput={commandInput} />;
  }
  if (mode === 'search') {
    return (
      <SearchFooter searchTerm={searchTerm} matchCount={matchCount} currentMatch={currentMatch} />
    );
  }
  if (viewMode === 'sidebar') {
    return <SidebarFooter />;
  }
  if (focusedIndex !== null) {
    return <FocusedFooter />;
  }
  return <EmptyFooter />;
}

export const Footer = React.memo(function Footer({
  mode,
  viewMode = 'grid',
  focusedIndex = null,
  commandInput = '',
  searchTerm = '',
  matchCount = 0,
  currentMatch = 0,
  notification = null,
}: FooterProps): React.ReactElement {
  if (notification !== null) {
    return <NotificationFooter notification={notification} />;
  }
  return renderModeFooter({
    mode,
    viewMode,
    commandInput,
    searchTerm,
    matchCount,
    currentMatch,
    focusedIndex,
  });
});
