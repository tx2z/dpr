import { Box, Text } from 'ink';
import React from 'react';

import { Button } from './button.js';
import { LogView } from './log-view.js';

import type { ServiceConfig, ServiceState, LogLine } from '../config/index.js';
import type { SearchMatch } from '../store/index.js';

export interface SpaceProps {
  readonly index: number;
  readonly config: ServiceConfig;
  readonly state: ServiceState;
  readonly logs: readonly LogLine[];
  readonly scrollOffset: number;
  readonly focused: boolean;
  readonly width: number;
  readonly height: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly onStart?: () => void;
  readonly onStop?: () => void;
  readonly onKill?: () => void;
}

interface StatusDisplay {
  readonly text: string;
  readonly color: 'red' | 'green' | 'yellow' | 'gray';
}

function getStatusDisplay(state: ServiceState): StatusDisplay {
  switch (state.status) {
    case 'stopped': {
      return { text: '', color: 'gray' };
    }
    case 'waiting': {
      return { text: `Waiting for: ${state.waitingFor.join(', ')}`, color: 'yellow' };
    }
    case 'starting': {
      return { text: 'Starting...', color: 'yellow' };
    }
    case 'ready': {
      return { text: 'Running', color: 'green' };
    }
    case 'stopping': {
      return { text: 'Stopping...', color: 'yellow' };
    }
    case 'crashed': {
      const exitCode = state.exitCode !== null ? String(state.exitCode) : '?';
      return { text: `CRASHED (exit ${exitCode})`, color: 'red' };
    }
  }
}

function getBorderColor(state: ServiceState, focused: boolean, serviceColor: string): string {
  if (state.status === 'crashed') {
    return 'red';
  }
  if (focused) {
    return serviceColor;
  }
  return 'gray';
}

function SpaceHeader({
  index,
  config,
  state,
  focused,
}: {
  readonly index: number;
  readonly config: ServiceConfig;
  readonly state: ServiceState;
  readonly focused: boolean;
}): React.ReactElement {
  const status = getStatusDisplay(state);
  const isRunning = state.status === 'ready' || state.status === 'starting';
  const isCrashed = state.status === 'crashed';
  const crashEmoji = isCrashed ? '💥 ' : '';

  return (
    <Box justifyContent="space-between">
      <Box>
        <Text color={config.color} bold={focused}>
          {index + 1}: {config.name}
        </Text>
        {status.text !== '' && (
          <Text color={status.color}>
            {' '}
            {crashEmoji}
            {status.text}
          </Text>
        )}
      </Box>
      {isRunning && (
        <Box gap={1}>
          <Text color="gray">[■ Stop] [✕ Kill]</Text>
        </Box>
      )}
    </Box>
  );
}

function StoppedContent({
  config,
  isCrashed,
}: {
  readonly config: ServiceConfig;
  readonly isCrashed: boolean;
}): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text>{config.name}</Text>
      <Box marginTop={1}>
        <Button
          label={isCrashed ? 'Restart' : 'Start'}
          icon="▶"
          color={config.color}
          focused={false}
        />
      </Box>
    </Box>
  );
}

function WaitingContent({
  waitingFor,
}: {
  readonly waitingFor: readonly string[];
}): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text color="yellow">⏳ Waiting for:</Text>
      <Text>{waitingFor.join(', ')}</Text>
    </Box>
  );
}

function SpaceContent(props: SpaceProps & { readonly contentHeight: number }): React.ReactElement {
  const { state, logs, scrollOffset, contentHeight, searchTerm, searchMatches, currentMatchIndex, config } = props;

  if (state.status === 'stopped' || state.status === 'crashed') {
    if (logs.length > 0) {
      return (
        <LogView
          lines={logs}
          scrollOffset={scrollOffset}
          height={contentHeight}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          serviceId={config.id}
        />
      );
    }
    return <StoppedContent config={config} isCrashed={state.status === 'crashed'} />;
  }

  if (state.status === 'waiting') {
    return <WaitingContent waitingFor={state.waitingFor} />;
  }

  return (
    <LogView
      lines={logs}
      scrollOffset={scrollOffset}
      height={contentHeight}
      searchTerm={searchTerm}
      searchMatches={searchMatches}
      currentMatchIndex={currentMatchIndex}
      serviceId={config.id}
    />
  );
}

export function Space(props: SpaceProps): React.ReactElement {
  const { index, config, state, focused, width, height } = props;
  const borderColor = getBorderColor(state, focused, config.color);
  const contentHeight = Math.max(1, height - 4);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
    >
      <SpaceHeader index={index} config={config} state={state} focused={focused} />
      <Box flexDirection="column" flexGrow={1}>
        <SpaceContent {...props} contentHeight={contentHeight} />
      </Box>
    </Box>
  );
}
