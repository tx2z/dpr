import { useEffect } from 'react';

// Terminal escape sequences for mouse tracking
const ENABLE_MOUSE_TRACKING = '\x1b[?1000h\x1b[?1006h'; // Enable mouse + SGR mode
const DISABLE_MOUSE_TRACKING = '\x1b[?1000l\x1b[?1006l';

// SGR mouse event pattern: ESC[<button;col;row(M|m)
// Button 0 = left click, 64 = scroll up, 65 = scroll down
// eslint-disable-next-line no-control-regex
const SGR_MOUSE_REGEX = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;

const BUTTON_LEFT_CLICK = 0;
const BUTTON_SCROLL_UP = 64;
const BUTTON_SCROLL_DOWN = 65;

interface MouseHandlers {
  readonly onScrollUp: () => void;
  readonly onScrollDown: () => void;
  readonly onClick?: (col: number, row: number) => void;
}

interface ParsedMouseEvent {
  readonly button: number;
  readonly col: number;
  readonly row: number;
  readonly isPress: boolean;
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
    isPress: eventType === 'M',
  };
}

function handleMouseEvent(event: ParsedMouseEvent, handlers: MouseHandlers): void {
  if (!event.isPress) {
    return;
  }
  if (event.button === BUTTON_LEFT_CLICK && handlers.onClick !== undefined) {
    handlers.onClick(event.col, event.row);
  } else if (event.button === BUTTON_SCROLL_UP) {
    handlers.onScrollUp();
  } else if (event.button === BUTTON_SCROLL_DOWN) {
    handlers.onScrollDown();
  }
}

function parseMouseEvents(data: string, handlers: MouseHandlers): void {
  let match;
  while ((match = SGR_MOUSE_REGEX.exec(data)) !== null) {
    const event = parseMouseEvent(match);
    if (event !== null) {
      handleMouseEvent(event, handlers);
    }
  }
}

export function useMouse(handlers: MouseHandlers, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const { stdin, stdout } = process;

    if (!stdin.isTTY || !stdout.isTTY) {
      return;
    }

    // Enable mouse tracking
    stdout.write(ENABLE_MOUSE_TRACKING);

    const handleData = (data: Buffer): void => {
      const str = data.toString();
      parseMouseEvents(str, handlers);
    };

    stdin.on('data', handleData);

    return (): void => {
      stdin.off('data', handleData);
      // Disable mouse tracking
      stdout.write(DISABLE_MOUSE_TRACKING);
    };
  }, [handlers, enabled]);
}
