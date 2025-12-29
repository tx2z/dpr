import { Box, Text } from 'ink';
import React from 'react';

import type { AppMode } from '../store/index.js';

export interface FooterProps {
  readonly mode: AppMode;
  readonly commandInput?: string;
  readonly searchTerm?: string;
  readonly matchCount?: number;
  readonly currentMatch?: number;
}

export function Footer({
  mode,
  commandInput = '',
  searchTerm = '',
  matchCount = 0,
  currentMatch = 0,
}: FooterProps): React.ReactElement {
  if (mode === 'command') {
    return (
      <Box borderStyle="round" borderColor="blue" paddingX={1}>
        <Text color="blue">/ </Text>
        <Text>{commandInput}</Text>
        <Text color="gray">_</Text>
      </Box>
    );
  }

  if (mode === 'search') {
    return (
      <Box borderStyle="round" borderColor="yellow" paddingX={1} justifyContent="space-between">
        <Box>
          <Text color="yellow">? </Text>
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

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="gray">Press / for commands • ? to search • Tab to navigate • q to quit</Text>
    </Box>
  );
}
