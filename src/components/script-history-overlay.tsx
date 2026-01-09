import { Box, Text, useStdout } from 'ink';
import React from 'react';

import type { ScriptExecution } from '../config/index.js';
import type { ScriptHistoryState } from '../store/index.js';

export interface ScriptHistoryOverlayProps {
  readonly historyState: ScriptHistoryState;
  readonly executions: readonly ScriptExecution[];
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getStatusIcon(execution: ScriptExecution): { icon: string; color: string } {
  if (execution.endedAt === null) {
    return { icon: '...', color: 'yellow' };
  }
  if (execution.exitCode === 0) {
    return { icon: 'ok', color: 'green' };
  }
  return { icon: 'err', color: 'red' };
}

interface ExecutionListItemProps {
  readonly execution: ScriptExecution;
  readonly isSelected: boolean;
  readonly showService: boolean;
}

function ExecutionListItem({
  execution,
  isSelected,
  showService,
}: ExecutionListItemProps): React.ReactElement {
  const status = getStatusIcon(execution);

  if (isSelected) {
    return (
      <Box>
        <Text backgroundColor="blue" color="white">
          {'> '}
        </Text>
        <Text backgroundColor="blue" color={status.color}>
          [{status.icon}]
        </Text>
        <Text backgroundColor="blue" color="white">
          {' '}
          {execution.scriptName}
        </Text>
        {showService && (
          <Text backgroundColor="blue" color="gray">
            {' '}
            ({execution.serviceName})
          </Text>
        )}
        <Text backgroundColor="blue" color="gray">
          {' '}
          - {formatDateTime(execution.startedAt)}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>{'  '}</Text>
      <Text color={status.color}>[{status.icon}]</Text>
      <Text> {execution.scriptName}</Text>
      {showService && <Text color="gray"> ({execution.serviceName})</Text>}
      <Text color="gray"> - {formatDateTime(execution.startedAt)}</Text>
    </Box>
  );
}

interface OutputPaneProps {
  readonly execution: ScriptExecution | undefined;
  readonly height: number;
  readonly scrollOffset: number;
}

function OutputPane({ execution, height, scrollOffset }: OutputPaneProps): React.ReactElement {
  if (execution === undefined) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Text color="gray">No execution selected</Text>
      </Box>
    );
  }

  // Account for command header (2 lines with margin) and scroll indicators (2 lines)
  const effectiveHeight = Math.max(1, height - 4);
  const clampedOffset = Math.min(
    scrollOffset,
    Math.max(0, execution.output.length - effectiveHeight),
  );
  const visibleLines = execution.output.slice(clampedOffset, clampedOffset + effectiveHeight);
  const hasMore = execution.output.length > clampedOffset + effectiveHeight;
  const hasPrev = clampedOffset > 0;

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        <Text color="gray" dimColor>
          $ {execution.command}
        </Text>
      </Box>
      {hasPrev && <Text color="gray">... {clampedOffset} earlier lines</Text>}
      {visibleLines.map((line, index) => (
        <Text key={index} wrap="truncate">
          {line}
        </Text>
      ))}
      {hasMore && (
        <Text color="gray">
          ... {execution.output.length - clampedOffset - effectiveHeight} more lines
        </Text>
      )}
      {execution.output.length === 0 && <Text color="gray">No output</Text>}
    </Box>
  );
}

interface ExecutionListPaneProps {
  readonly executions: readonly ScriptExecution[];
  readonly selectedIndex: number;
  readonly showService: boolean;
  readonly maxHeight: number;
  readonly listWidth: number;
}

function ExecutionListPane({
  executions,
  selectedIndex,
  showService,
  maxHeight,
  listWidth,
}: ExecutionListPaneProps): React.ReactElement {
  const visibleExecutions = executions.slice(0, maxHeight);
  return (
    <Box
      flexDirection="column"
      width={listWidth}
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {visibleExecutions.map((exec, index) => (
        <ExecutionListItem
          key={exec.id}
          execution={exec}
          isSelected={index === selectedIndex}
          showService={showService}
        />
      ))}
      {executions.length > maxHeight && (
        <Text color="gray">... {executions.length - maxHeight} more</Text>
      )}
    </Box>
  );
}

interface HistoryContentProps {
  readonly executions: readonly ScriptExecution[];
  readonly historyState: ScriptHistoryState;
  readonly contentHeight: number;
  readonly listWidth: number;
}

function HistoryContent({
  executions,
  historyState,
  contentHeight,
  listWidth,
}: HistoryContentProps): React.ReactElement {
  const showService = historyState.serviceFilter === null;
  const selectedExecution = executions[historyState.selectedIndex];
  if (executions.length === 0) {
    return (
      <Box flexGrow={1}>
        <Text color="gray">No script executions yet.</Text>
      </Box>
    );
  }
  return (
    <Box flexGrow={1}>
      <ExecutionListPane
        executions={executions}
        selectedIndex={historyState.selectedIndex}
        showService={showService}
        maxHeight={contentHeight}
        listWidth={listWidth}
      />
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <OutputPane
          execution={selectedExecution}
          height={contentHeight}
          scrollOffset={historyState.scrollOffset}
        />
      </Box>
    </Box>
  );
}

export function ScriptHistoryOverlay({
  historyState,
  executions,
}: ScriptHistoryOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const listWidth = Math.min(50, Math.floor(stdout.columns / 3));
  const contentHeight = Math.max(1, stdout.rows - 10);
  const title =
    historyState.serviceFilter !== null
      ? `Script History - ${historyState.serviceFilter}`
      : 'Script History - All Services';

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="magenta"
      paddingX={1}
      paddingY={1}
      flexGrow={1}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          {title}
        </Text>
      </Box>
      <HistoryContent
        executions={executions}
        historyState={historyState}
        contentHeight={contentHeight}
        listWidth={listWidth}
      />
      <Box marginTop={1}>
        <Text color="gray">[↑↓] select · [←→] scroll output · [g/G] top/bottom · [Esc] close</Text>
      </Box>
    </Box>
  );
}
