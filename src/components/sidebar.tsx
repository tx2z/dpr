import { Box, Text } from 'ink';
import React from 'react';

import { clampListScroll, getStatusDisplay, getStatusGlyph } from '../utils/index.js';

import type { ServiceDisplay } from './layout.js';

export interface SidebarProps {
  readonly services: readonly ServiceDisplay[];
  readonly selectedIndex: number;
  readonly openWindowIds: readonly string[];
  readonly width: number;
  readonly height: number;
}

interface SidebarRowProps {
  readonly service: ServiceDisplay;
  readonly index: number;
  readonly selected: boolean;
  readonly windowSlot: number | null;
}

function SidebarRow({ service, index, selected, windowSlot }: SidebarRowProps): React.ReactElement {
  const status = getStatusDisplay(service.state);
  const glyph = getStatusGlyph(service.state);
  const marker = windowSlot === null ? '' : ` [${String(windowSlot)}]`;
  return (
    <Box>
      <Text color={status.color}>{glyph} </Text>
      <Text color={service.config.color} bold={selected} inverse={selected} wrap="truncate">
        {index + 1}:{service.config.name}
      </Text>
      <Text color="gray">{marker}</Text>
    </Box>
  );
}

export function Sidebar({
  services,
  selectedIndex,
  openWindowIds,
  width,
  height,
}: SidebarProps): React.ReactElement {
  const visibleRows = Math.max(1, height - 3);
  const offset = clampListScroll(selectedIndex, services.length, visibleRows);
  const visible = services.slice(offset, offset + visibleRows);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Text bold>Services ({String(services.length)})</Text>
      {visible.map((service, i) => {
        const globalIndex = offset + i;
        const slot = openWindowIds.indexOf(service.config.id);
        return (
          <SidebarRow
            key={service.config.id}
            service={service}
            index={globalIndex}
            selected={globalIndex === selectedIndex}
            windowSlot={slot >= 0 ? slot + 1 : null}
          />
        );
      })}
    </Box>
  );
}
