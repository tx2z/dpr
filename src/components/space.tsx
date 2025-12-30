import { Box, Text } from 'ink';
import React from 'react';

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
      return { text: 'Stopped', color: 'gray' };
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
  const isCrashed = state.status === 'crashed';
  const crashEmoji = isCrashed ? '💥 ' : '';

  return (
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
  );
}

function getStoppedHint(focused: boolean, action: string): React.ReactElement {
  if (focused) {
    return (
      <Text color="green" bold>
        Press [s] to {action}
      </Text>
    );
  }
  return <Text color="gray">Focus with Tab or number</Text>;
}

function StoppedContent({
  config,
  isCrashed,
  focused,
}: {
  readonly config: ServiceConfig;
  readonly isCrashed: boolean;
  readonly focused: boolean;
}): React.ReactElement {
  const action = isCrashed ? 'Restart' : 'Start';
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text>{config.name}</Text>
      <Box marginTop={1}>{getStoppedHint(focused, action)}</Box>
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

interface LogViewWrapperProps {
  readonly props: SpaceProps & { readonly contentHeight: number };
}

function LogViewWrapper({ props }: LogViewWrapperProps): React.ReactElement {
  const {
    logs,
    scrollOffset,
    contentHeight,
    searchTerm,
    searchMatches,
    currentMatchIndex,
    config,
  } = props;
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

function SpaceContent(props: SpaceProps & { readonly contentHeight: number }): React.ReactElement {
  const { state, logs, config, focused } = props;

  if (state.status === 'stopped' || state.status === 'crashed') {
    if (logs.length > 0) {
      return <LogViewWrapper props={props} />;
    }
    return (
      <StoppedContent config={config} isCrashed={state.status === 'crashed'} focused={focused} />
    );
  }

  if (state.status === 'waiting') {
    return <WaitingContent waitingFor={state.waitingFor} />;
  }

  return <LogViewWrapper props={props} />;
}

export const Space = React.memo(function Space(props: SpaceProps): React.ReactElement {
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
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        <SpaceContent {...props} contentHeight={contentHeight} />
      </Box>
    </Box>
  );
});
