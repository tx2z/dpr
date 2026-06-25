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
      <Text>[←→/Tab/1-9] focus panel · [↑↓/jk] scroll · [g/G] top/bottom</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>panel actions (when focused)</Text>
      </Box>
      <Text>[s] start · [x] stop · [K] kill · [Enter] fullscreen · [Esc] unfocus</Text>
      <Text>[r] scripts menu · [h] script history · [y] copy logs · [Y] copy all</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>global actions</Text>
      </Box>
      <Text>[S] start all · [X] stop all · [H] all script history · [q] quit</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>commands (press [/])</Text>
      </Box>
      <Text>/start · /stop · /kill · /restart · /clear · /focus · /copy · /quit</Text>
      <Text>/start-all · /stop-all · /help · /history</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>fullscreen mode (when in fullscreen)</Text>
      </Box>
      <Text>[↑↓/jk] cursor · [←→] page · [g/G] top/bottom · [y/Y] copy visible/all</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>sidebar view</Text>
      </Box>
      <Text>[↑↓/jk] select · [Enter] show · [w] add window · [Tab] focus window</Text>
      <Text>[ []/] · g/G] scroll window · [c] close window · [o] fullscreen · [t] toggle grid</Text>
      <Text>drag in a window with the mouse to select &amp; copy log lines</Text>
      <Text>[v] stream mode — logs in native scrollback you can select char-by-char</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text bold>other</Text>
      </Box>
      <Text>[?] help · [f] find in logs · [t] toggle sidebar/grid</Text>
      <Text color="gray">Select log text with the mouse and copy with your terminal (Cmd+C)</Text>

      <Box marginTop={1}>
        <Text color="gray">[Esc] close</Text>
      </Box>
    </Box>
  );
}
