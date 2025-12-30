import { Box, Text } from 'ink';
import React from 'react';

import type { LogLine } from '../config/index.js';
import type { SearchMatch } from '../store/index.js';

export interface LogViewProps {
  readonly lines: readonly LogLine[];
  readonly scrollOffset: number;
  readonly height: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly serviceId: string;
}

interface HighlightProps {
  readonly text: string;
  readonly searchTerm: string;
  readonly matches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly lineIndex: number;
  readonly serviceId: string;
}

function isCurrentMatch(
  matches: readonly SearchMatch[],
  currentMatchIndex: number,
  serviceId: string,
  lineIndex: number,
  startCol: number,
): boolean {
  const currentMatch = matches[currentMatchIndex];
  if (currentMatch === undefined) {
    return false;
  }
  return (
    currentMatch.serviceId === serviceId &&
    currentMatch.lineIndex === lineIndex &&
    currentMatch.startCol === startCol
  );
}

function HighlightedText({
  text,
  searchTerm,
  matches,
  currentMatchIndex,
  lineIndex,
  serviceId,
}: HighlightProps): React.ReactElement {
  if (searchTerm === '') {
    return <Text wrap="truncate">{text}</Text>;
  }

  const lineMatches = matches.filter((m) => m.serviceId === serviceId && m.lineIndex === lineIndex);

  if (lineMatches.length === 0) {
    return <Text wrap="truncate">{text}</Text>;
  }

  const parts: React.ReactElement[] = [];
  let lastEnd = 0;

  for (const match of lineMatches) {
    if (match.startCol > lastEnd) {
      parts.push(
        <Text key={`text-${String(lastEnd)}`}>{text.slice(lastEnd, match.startCol)}</Text>,
      );
    }

    const isCurrent = isCurrentMatch(
      matches,
      currentMatchIndex,
      serviceId,
      lineIndex,
      match.startCol,
    );

    parts.push(
      <Text
        key={`match-${String(match.startCol)}`}
        backgroundColor={isCurrent ? 'cyan' : 'yellow'}
        color="black"
      >
        {text.slice(match.startCol, match.endCol)}
      </Text>,
    );

    lastEnd = match.endCol;
  }

  if (lastEnd < text.length) {
    parts.push(<Text key={`text-${String(lastEnd)}`}>{text.slice(lastEnd)}</Text>);
  }

  return <>{parts}</>;
}

// Strip control characters that can break terminal rendering
function sanitizeLogContent(content: string): string {
  // Remove carriage returns and other control chars except newline
  // eslint-disable-next-line no-control-regex
  return content.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
}

interface LogLineComponentProps {
  readonly line: LogLine;
  readonly lineIndex: number;
  readonly searchTerm: string;
  readonly searchMatches: readonly SearchMatch[];
  readonly currentMatchIndex: number;
  readonly serviceId: string;
}

const LogLineComponent = React.memo(function LogLineComponent({
  line,
  lineIndex,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  serviceId,
}: LogLineComponentProps): React.ReactElement {
  const sanitizedContent = sanitizeLogContent(line.content);
  const content = (
    <HighlightedText
      text={sanitizedContent}
      searchTerm={searchTerm}
      matches={searchMatches}
      currentMatchIndex={currentMatchIndex}
      lineIndex={lineIndex}
      serviceId={serviceId}
    />
  );

  if (line.stream === 'stderr') {
    return (
      <Box key={lineIndex} overflowX="hidden">
        <Text color="red" wrap="truncate">
          {content}
        </Text>
      </Box>
    );
  }

  return (
    <Box key={lineIndex} overflowX="hidden">
      {content}
    </Box>
  );
});

export function LogView({
  lines,
  scrollOffset,
  height,
  searchTerm,
  searchMatches,
  currentMatchIndex,
  serviceId,
}: LogViewProps): React.ReactElement {
  // Clamp scrollOffset to valid range (0 to max that shows last line)
  const maxOffset = Math.max(0, lines.length - height);
  const effectiveOffset = Math.min(scrollOffset, maxOffset);
  const visibleLines = lines.slice(effectiveOffset, effectiveOffset + height);
  const emptyLines = Math.max(0, height - visibleLines.length);

  return (
    <Box flexDirection="column" height={height}>
      {visibleLines.map((line, index) => (
        <LogLineComponent
          key={effectiveOffset + index}
          line={line}
          lineIndex={effectiveOffset + index}
          searchTerm={searchTerm}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          serviceId={serviceId}
        />
      ))}
      {Array.from({ length: emptyLines }).map((_, index) => (
        <Box key={`empty-${String(index)}`}>
          <Text> </Text>
        </Box>
      ))}
    </Box>
  );
}
