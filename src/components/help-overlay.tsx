import { Box, Text } from 'ink';
import React from 'react';

export function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          dpr · dev process runner · help
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>navigation</Text>
      </Box>
      <Text>[Tab/1-9] focus panel · [↑↓/jk] scroll · [←→] page · [g/G] top/bottom</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>panel actions (when focused)</Text>
      </Box>
      <Text>[s] start · [x] stop · [K] kill · [Enter] fullscreen · [Esc] unfocus</Text>
      <Text>[r] scripts menu · [h] script history</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>global actions</Text>
      </Box>
      <Text>[S] start all · [X] stop all · [H] all script history · [q] quit</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>commands (press [/])</Text>
      </Box>
      <Text>/start · /stop · /kill · /restart · /clear · /focus</Text>
      <Text>/start-all · /stop-all</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>other</Text>
      </Box>
      <Text>[?] help · [f] find in logs</Text>

      <Box marginTop={1}>
        <Text color="gray">[Esc] close</Text>
      </Box>
    </Box>
  );
}
