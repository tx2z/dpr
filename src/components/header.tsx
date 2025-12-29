import { Box, Text } from 'ink';
import React from 'react';

export interface HeaderProps {
  readonly projectName: string | null;
  readonly onStartAll?: () => void;
  readonly onStopAll?: () => void;
  readonly onQuit?: () => void;
}

export function Header({ projectName }: HeaderProps): React.ReactElement {
  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      marginBottom={0}
    >
      <Text bold color="white">
        {projectName ?? 'dpr'}
      </Text>
      <Box gap={1}>
        <Text color="gray">[▶ Start All]</Text>
        <Text color="gray">[■ Stop All]</Text>
        <Text color="gray">[Q Quit]</Text>
      </Box>
    </Box>
  );
}
