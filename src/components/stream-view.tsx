import { Box, Static, Text } from 'ink';
import React, { useEffect, useRef, useState } from 'react';

import { sanitizeLogContent } from './log-view.js';

import type { ServiceDisplay } from './layout.js';
import type { LogLine } from '../config/index.js';

export interface StreamViewProps {
  readonly service: ServiceDisplay;
}

interface StreamLine {
  readonly key: number;
  readonly content: string;
  readonly stream: LogLine['stream'];
}

function toStreamLines(logs: readonly LogLine[], baseKey: number): StreamLine[] {
  return logs.map((line, i) => ({
    key: baseKey + i,
    content: sanitizeLogContent(line.content),
    stream: line.stream,
  }));
}

/**
 * Full-screen, single-service log view rendered through ink's <Static>.
 *
 * <Static> prints each line once into the terminal's native scrollback, so the
 * output is stable (no repaint flicker) and can be selected and copied with the
 * mouse exactly like normal terminal output. New lines are detected via the
 * service's monotonic appendSeq so trimming the 1000-line buffer never stalls it.
 */
export function StreamView({ service }: StreamViewProps): React.ReactElement {
  const [lines, setLines] = useState<StreamLine[]>(() => toStreamLines(service.logs, 0));
  const seqRef = useRef(service.appendSeq);
  const totalRef = useRef(service.logs.length);

  useEffect(() => {
    const delta = service.appendSeq - seqRef.current;
    if (delta <= 0) {
      return;
    }
    const fresh = service.logs.slice(Math.max(0, service.logs.length - delta));
    setLines((prev) => [...prev, ...toStreamLines(fresh, totalRef.current)]);
    seqRef.current = service.appendSeq;
    totalRef.current += fresh.length;
  }, [service.appendSeq, service.logs]);

  return (
    <Box flexDirection="column">
      <Static items={lines}>
        {(line): React.ReactElement =>
          line.stream === 'stderr' ? (
            <Text key={line.key} color="red">
              {line.content}
            </Text>
          ) : (
            <Text key={line.key}>{line.content}</Text>
          )
        }
      </Static>
      <Box>
        <Text color="cyan">
          ── streaming {service.config.name} · select &amp; copy with the mouse · [q]/[Esc] back ──
        </Text>
      </Box>
    </Box>
  );
}
