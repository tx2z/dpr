import { useEffect } from 'react';

// Mode 1002 = button-event tracking (reports motion only while a button is held)
// + 1006 = SGR extended coordinates (so columns/rows past 223 work).
const ENABLE_MOUSE = '\x1b[?1002h\x1b[?1006h';
const DISABLE_MOUSE = '\x1b[?1002l\x1b[?1006l';

// SGR mouse event: ESC[<button;col;row(M|m). M = press/motion, m = release.
// eslint-disable-next-line no-control-regex
const SGR_MOUSE_REGEX = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

const MOTION_FLAG = 32;
const WHEEL_FLAG = 64;
const WHEEL_UP = 64;
const WHEEL_DOWN = 65;

export interface MouseDragHandlers {
  readonly onDown: (col: number, row: number) => void;
  readonly onDrag: (col: number, row: number) => void;
  readonly onUp: (col: number, row: number) => void;
  readonly onScrollUp: () => void;
  readonly onScrollDown: () => void;
}

interface ParsedMouseEvent {
  readonly button: number;
  readonly col: number;
  readonly row: number;
  readonly release: boolean;
}

function parseMouseEvent(match: RegExpExecArray): ParsedMouseEvent | null {
  const [, buttonStr, colStr, rowStr, eventType] = match;
  if (buttonStr === undefined || colStr === undefined || rowStr === undefined) {
    return null;
  }
  return {
    button: parseInt(buttonStr, 10),
    col: parseInt(colStr, 10),
    row: parseInt(rowStr, 10),
    release: eventType === 'm',
  };
}

function dispatchMouseEvent(event: ParsedMouseEvent, handlers: MouseDragHandlers): void {
  if (event.button === WHEEL_UP) {
    handlers.onScrollUp();
    return;
  }
  if (event.button === WHEEL_DOWN) {
    handlers.onScrollDown();
    return;
  }
  if ((event.button & WHEEL_FLAG) !== 0) {
    return;
  }
  if (event.release) {
    handlers.onUp(event.col, event.row);
    return;
  }
  if ((event.button & MOTION_FLAG) !== 0) {
    handlers.onDrag(event.col, event.row);
    return;
  }
  handlers.onDown(event.col, event.row);
}

function parseMouseData(data: string, handlers: MouseDragHandlers): void {
  let match;
  while ((match = SGR_MOUSE_REGEX.exec(data)) !== null) {
    const event = parseMouseEvent(match);
    if (event !== null) {
      dispatchMouseEvent(event, handlers);
    }
  }
}

export function useMouse(handlers: MouseDragHandlers, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const { stdin, stdout } = process;
    if (!stdin.isTTY || !stdout.isTTY) {
      return;
    }
    stdout.write(ENABLE_MOUSE);
    const handleData = (data: Buffer): void => {
      parseMouseData(data.toString(), handlers);
    };
    stdin.on('data', handleData);
    return (): void => {
      stdin.off('data', handleData);
      stdout.write(DISABLE_MOUSE);
    };
  }, [handlers, enabled]);
}
