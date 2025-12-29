import { Box, Text } from 'ink';
import React from 'react';

export interface CommandSuggestion {
  readonly command: string;
  readonly description: string;
}

export interface CommandPaletteProps {
  readonly input: string;
  readonly suggestions: readonly CommandSuggestion[];
  readonly selectedIndex: number;
}

export function CommandPalette({
  input,
  suggestions,
  selectedIndex,
}: CommandPaletteProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="blue" paddingX={1}>
        <Text color="blue">/ </Text>
        <Text>{input}</Text>
        <Text color="gray">_</Text>
      </Box>
      {suggestions.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {suggestions.map((suggestion, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={suggestion.command}>
                {isSelected ? (
                  <Text backgroundColor="blue" color="white">
                    {suggestion.command}
                  </Text>
                ) : (
                  <Text color="gray">{suggestion.command}</Text>
                )}
                <Text color="gray"> - {suggestion.description}</Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
