import { Box, Text, useStdout } from 'ink';
import React from 'react';

import type { ScriptConfig, ServiceConfig } from '../config/index.js';
import type { ScriptsMenuState } from '../store/index.js';

export interface ScriptsOverlayProps {
  readonly serviceConfig: ServiceConfig;
  readonly menuState: ScriptsMenuState;
}

interface ScriptItemProps {
  readonly script: ScriptConfig;
  readonly isSelected: boolean;
  readonly index: number;
}

function ScriptItem({ script, isSelected, index }: ScriptItemProps): React.ReactElement {
  if (isSelected) {
    const keyColor = script.key !== null ? 'white' : 'gray';
    return (
      <Box>
        <Text backgroundColor="blue" color="white">
          {'> '}
        </Text>
        <Text backgroundColor="blue" color={keyColor} bold={script.key !== null}>
          [{script.key ?? String(index + 1)}]
        </Text>
        <Text backgroundColor="blue" color="white">
          {' '}
          {script.name}
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>{'  '}</Text>
      {script.key !== null ? (
        <Text color="cyan" bold>
          [{script.key}]
        </Text>
      ) : (
        <Text color="gray">[{String(index + 1)}]</Text>
      )}
      <Text> {script.name}</Text>
    </Box>
  );
}

interface ParamInputProps {
  readonly script: ScriptConfig;
  readonly currentParamIndex: number;
  readonly inputValue: string;
}

function ParamInput({
  script,
  currentParamIndex,
  inputValue,
}: ParamInputProps): React.ReactElement {
  const param = script.params[currentParamIndex];
  if (param === undefined) {
    return <></>;
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">{param.prompt}:</Text>
      <Box>
        <Text color="cyan">&gt; </Text>
        <Text>{inputValue}</Text>
        <Text color="gray">_</Text>
      </Box>
    </Box>
  );
}

interface ScriptListProps {
  readonly scripts: readonly ScriptConfig[];
  readonly selectedIndex: number;
  readonly maxHeight: number;
}

function ScriptList({ scripts, selectedIndex, maxHeight }: ScriptListProps): React.ReactElement {
  const visibleScripts = scripts.slice(0, maxHeight);
  return (
    <Box flexDirection="column" marginBottom={1}>
      {visibleScripts.map((script, index) => (
        <ScriptItem
          key={script.id}
          script={script}
          isSelected={index === selectedIndex}
          index={index}
        />
      ))}
      {scripts.length > maxHeight && (
        <Text color="gray">... and {scripts.length - maxHeight} more</Text>
      )}
    </Box>
  );
}

function getHintText(isCollectingParams: boolean): string {
  return isCollectingParams
    ? '[Enter] confirm · [Esc] cancel'
    : '[↑↓] navigate · [Enter/key] run · [Esc] close';
}

interface ScriptsContentProps {
  readonly scripts: readonly ScriptConfig[];
  readonly menuState: ScriptsMenuState;
  readonly maxListHeight: number;
  readonly isCollectingParams: boolean;
  readonly selectedScript: ScriptConfig | undefined;
}

function ScriptsContent({
  scripts,
  menuState,
  maxListHeight,
  isCollectingParams,
  selectedScript,
}: ScriptsContentProps): React.ReactElement {
  if (scripts.length === 0) {
    return (
      <Box marginBottom={1}>
        <Text color="gray">No scripts defined for this service.</Text>
      </Box>
    );
  }

  return (
    <>
      <ScriptList
        scripts={scripts}
        selectedIndex={menuState.selectedIndex}
        maxHeight={maxListHeight}
      />
      {isCollectingParams && selectedScript !== undefined && (
        <ParamInput
          script={selectedScript}
          currentParamIndex={menuState.currentParamIndex}
          inputValue={menuState.inputValue}
        />
      )}
    </>
  );
}

export function ScriptsOverlay({
  serviceConfig,
  menuState,
}: ScriptsOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const scripts = serviceConfig.scripts;
  const selectedScript = scripts[menuState.selectedIndex];
  const isCollectingParams =
    selectedScript !== undefined &&
    menuState.currentParamIndex >= 0 &&
    menuState.currentParamIndex < selectedScript.params.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={serviceConfig.color}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color={serviceConfig.color}>
          {serviceConfig.name} - Scripts
        </Text>
      </Box>
      <ScriptsContent
        scripts={scripts}
        menuState={menuState}
        maxListHeight={Math.max(1, stdout.rows - 12)}
        isCollectingParams={isCollectingParams}
        selectedScript={selectedScript}
      />
      <Box marginTop={1}>
        <Text color="gray">{getHintText(isCollectingParams)}</Text>
      </Box>
    </Box>
  );
}
