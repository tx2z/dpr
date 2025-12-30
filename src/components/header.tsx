import { Box, Text } from 'ink';
import React from 'react';

export interface HeaderProps {
  readonly projectName: string | null;
}

export const Header = React.memo(function Header({ projectName }: HeaderProps): React.ReactElement {
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
      <Text color="gray">
        [/] cmd · [?] help · [f] find · [Tab] focus · [S] start all · [X] stop all · [q] quit
      </Text>
    </Box>
  );
});
