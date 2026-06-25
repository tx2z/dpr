import type { ServiceState } from '../config/index.js';

export type StatusColor = 'red' | 'green' | 'yellow' | 'gray';

export interface StatusDisplay {
  readonly text: string;
  readonly color: StatusColor;
}

/**
 * Map a service state to a short status label and color.
 */
export function getStatusDisplay(state: ServiceState): StatusDisplay {
  switch (state.status) {
    case 'stopped': {
      return { text: 'Stopped', color: 'gray' };
    }
    case 'waiting': {
      return { text: `Waiting: ${state.waitingFor.join(', ')}`, color: 'yellow' };
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
      return { text: `Crashed (exit ${exitCode})`, color: 'red' };
    }
  }
}

/**
 * Single-character glyph for a service status, used in the sidebar list.
 */
export function getStatusGlyph(state: ServiceState): string {
  switch (state.status) {
    case 'ready': {
      return '●';
    }
    case 'starting':
    case 'waiting':
    case 'stopping': {
      return '◐';
    }
    case 'crashed': {
      return '✖';
    }
    case 'stopped': {
      return '○';
    }
  }
}
