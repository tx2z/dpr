import { Box, Text } from 'ink';
import React from 'react';

export interface SearchBarProps {
  readonly term: string;
  readonly matchCount: number;
  readonly currentMatch: number;
}

export function SearchBar({ term, matchCount, currentMatch }: SearchBarProps): React.ReactElement {
  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1} justifyContent="space-between">
      <Box>
        <Text color="yellow">? </Text>
        <Text>{term}</Text>
        <Text color="gray">_</Text>
      </Box>
      {matchCount > 0 && (
        <Text color="gray">
          [{currentMatch + 1}/{matchCount} matches]
        </Text>
      )}
      {matchCount === 0 && term.length > 0 && <Text color="red">[No matches]</Text>}
    </Box>
  );
}
