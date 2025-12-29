import { Box, Text } from 'ink';
import React from 'react';

import type { ServiceColor } from '../config/index.js';

export interface ButtonProps {
  readonly label: string;
  readonly icon?: string;
  readonly color?: ServiceColor;
  readonly focused?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}

function getTextColor(disabled: boolean, focused: boolean, color: ServiceColor): string {
  if (disabled) {
    return 'gray';
  }
  if (focused) {
    return 'white';
  }
  return color;
}

export function Button({
  label,
  icon,
  color = 'blue',
  focused = false,
  disabled = false,
}: ButtonProps): React.ReactElement {
  const textColor = getTextColor(disabled, focused, color);
  const iconText = icon !== undefined ? `${icon} ` : '';

  if (focused && !disabled) {
    return (
      <Box>
        <Text color={textColor} backgroundColor={color} bold>
          {' '}
          [{iconText}
          {label}]{' '}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color={textColor} bold={focused}>
        {' '}
        [{iconText}
        {label}]{' '}
      </Text>
    </Box>
  );
}
