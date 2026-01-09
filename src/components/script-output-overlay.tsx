import { Box, Text, useStdout } from 'ink';
import React from 'react';

import type { ScriptExecution } from '../config/index.js';

export interface ScriptOutputOverlayProps {
  readonly execution: ScriptExecution;
}

function getStatusIndicator(execution: ScriptExecution): { text: string; color: string } {
  if (execution.endedAt === null) {
    return { text: 'Running...', color: 'yellow' };
  }
  if (execution.exitCode === 0) {
    return { text: 'Completed', color: 'green' };
  }
  const code = execution.exitCode !== null ? String(execution.exitCode) : '?';
  return { text: `Failed (exit ${code})`, color: 'red' };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface OutputLinesProps {
  readonly output: readonly string[];
  readonly hiddenLines: number;
  readonly endedAt: Date | null;
}

function OutputLines({ output, hiddenLines, endedAt }: OutputLinesProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {hiddenLines > 0 && <Text color="gray">... {hiddenLines} earlier lines</Text>}
      {output.map((line, index) => (
        <Text key={index} wrap="truncate">
          {line}
        </Text>
      ))}
      {output.length === 0 && endedAt === null && <Text color="gray">Waiting for output...</Text>}
      {output.length === 0 && endedAt !== null && <Text color="gray">No output</Text>}
    </Box>
  );
}

export function ScriptOutputOverlay({ execution }: ScriptOutputOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const maxOutputLines = Math.max(1, stdout.rows - 12);
  const status = getStatusIndicator(execution);
  const visibleOutput = execution.output.slice(-maxOutputLines);
  const hiddenLines = execution.output.length - visibleOutput.length;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          {execution.scriptName}
        </Text>
        <Text color={status.color}>{status.text}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray">
          {execution.serviceName} - Started at {formatTime(execution.startedAt)}
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          $ {execution.command}
        </Text>
      </Box>
      <OutputLines output={visibleOutput} hiddenLines={hiddenLines} endedAt={execution.endedAt} />
      <Box marginTop={1}>
        <Text color="gray">[Esc] dismiss</Text>
      </Box>
    </Box>
  );
}
