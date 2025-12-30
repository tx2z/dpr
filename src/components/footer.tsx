import { Box, Text } from 'ink';
import React from 'react';

import type { AppMode } from '../store/index.js';

export interface FooterProps {
  readonly mode: AppMode;
  readonly focusedIndex?: number | null;
  readonly commandInput?: string;
  readonly searchTerm?: string;
  readonly matchCount?: number;
  readonly currentMatch?: number;
}

function getFocusedModeHint(): string {
  return '[s] start · [x] stop · [K] kill · [↑↓/jk] scroll · [←→] page · [Enter] full · [Esc] back';
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
      <Text color="cyan">{getFocusedModeHint()}</Text>
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

export const Footer = React.memo(function Footer({
  mode,
  focusedIndex = null,
  commandInput = '',
  searchTerm = '',
  matchCount = 0,
  currentMatch = 0,
}: FooterProps): React.ReactElement {
  if (mode === 'command') {
    return <CommandFooter commandInput={commandInput} />;
  }
  if (mode === 'search') {
    return (
      <SearchFooter searchTerm={searchTerm} matchCount={matchCount} currentMatch={currentMatch} />
    );
  }
  if (focusedIndex !== null) {
    return <FocusedFooter />;
  }
  return <EmptyFooter />;
});
