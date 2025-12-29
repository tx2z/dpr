import { Box, useApp, useInput } from 'ink';
import React, { useMemo } from 'react';
import { useStore } from 'zustand';

import { Footer, Header, Layout } from './components/index.js';
import { useCommands, useSearch, useServiceManager } from './hooks/index.js';
import { createAppStore } from './store/index.js';

import type { ServiceDisplay } from './components/index.js';
import type { Config, ServiceState } from './config/index.js';
import type { UseCommandsResult, UseSearchResult } from './hooks/index.js';
import type { AppMode, AppStoreApi, SearchMatch, SearchState, ServiceRuntime } from './store/index.js';

export interface AppProps {
  readonly config: Config;
}

interface KeyHandlers {
  readonly setMode: (mode: AppMode) => void;
  readonly setCommandInput: (input: string) => void;
  readonly setSearchState: (state: SearchState | null) => void;
  readonly setFocusedSpace: (index: number | null) => void;
  readonly exit: () => void;
  readonly executeCommand: UseCommandsResult['executeCommand'];
  readonly updateSearchTerm: UseSearchResult['updateSearchTerm'];
  readonly nextMatch: UseSearchResult['nextMatch'];
  readonly prevMatch: UseSearchResult['prevMatch'];
  readonly scrollUp: () => void;
  readonly scrollDown: () => void;
  readonly scrollToTop: () => void;
  readonly scrollToBottom: () => void;
}

interface KeyState {
  readonly escape: boolean;
  readonly return: boolean;
  readonly backspace: boolean;
  readonly delete: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly tab: boolean;
  readonly shift: boolean;
  readonly upArrow: boolean;
  readonly downArrow: boolean;
}

const DEFAULT_SEARCH_STATE: SearchState = {
  term: '',
  serviceFilter: null,
  matches: [],
  currentMatchIndex: 0,
};

const DEFAULT_SERVICE_STATE: ServiceState = {
  status: 'stopped',
  pid: null,
  exitCode: null,
  startedAt: null,
  waitingFor: [],
};

function isQuitInput(input: string, key: KeyState): boolean {
  return input === 'q' || (key.ctrl && input === 'c');
}

function isTypableInput(input: string, key: KeyState): boolean {
  return input.length === 1 && !key.ctrl && !key.meta;
}

function handleCommandModeInput(
  input: string,
  key: KeyState,
  commandInput: string,
  handlers: KeyHandlers,
): void {
  if (key.escape) {
    handlers.setMode('normal');
    handlers.setCommandInput('');
    return;
  }
  if (key.return) {
    handlers.executeCommand(commandInput);
    handlers.setMode('normal');
    handlers.setCommandInput('');
    return;
  }
  if (key.backspace || key.delete) {
    handlers.setCommandInput(commandInput.slice(0, -1));
    return;
  }
  if (isTypableInput(input, key)) {
    handlers.setCommandInput(commandInput + input);
  }
}

function isSearchNavigationKey(key: KeyState): 'prev' | 'next' | null {
  if (key.upArrow || (key.shift && key.tab)) {
    return 'prev';
  }
  if (key.downArrow || key.tab) {
    return 'next';
  }
  return null;
}

function handleSearchNavigation(direction: 'prev' | 'next', handlers: KeyHandlers): void {
  if (direction === 'prev') {
    handlers.prevMatch();
  } else {
    handlers.nextMatch();
  }
}

function handleSearchTextInput(
  input: string,
  key: KeyState,
  searchState: SearchState | null,
  handlers: KeyHandlers,
): boolean {
  if (key.backspace || key.delete) {
    const currentTerm = searchState?.term ?? '';
    handlers.updateSearchTerm(currentTerm.slice(0, -1));
    return true;
  }
  if (isTypableInput(input, key)) {
    const currentTerm = searchState?.term ?? '';
    handlers.updateSearchTerm(currentTerm + input);
    return true;
  }
  return false;
}

function handleSearchModeInput(
  input: string,
  key: KeyState,
  searchState: SearchState | null,
  handlers: KeyHandlers,
): void {
  if (key.escape) {
    handlers.setMode('normal');
    handlers.setSearchState(null);
    return;
  }
  if (key.return) {
    handlers.setMode('normal');
    return;
  }
  const navDirection = isSearchNavigationKey(key);
  if (navDirection !== null) {
    handleSearchNavigation(navDirection, handlers);
    return;
  }
  handleSearchTextInput(input, key, searchState, handlers);
}

function handleTabNavigation(key: KeyState, serviceCount: number, focusedSpaceIndex: number | null): number {
  const current = focusedSpaceIndex ?? -1;
  if (key.shift) {
    return (current - 1 + serviceCount) % serviceCount;
  }
  return (current + 1) % serviceCount;
}

function handleScrollInput(input: string, key: KeyState, focusedSpaceIndex: number | null, handlers: KeyHandlers): boolean {
  if (focusedSpaceIndex === null) {
    return false;
  }
  if (key.upArrow || input === 'k') {
    handlers.scrollUp();
    return true;
  }
  if (key.downArrow || input === 'j') {
    handlers.scrollDown();
    return true;
  }
  if (input === 'g') {
    handlers.scrollToTop();
    return true;
  }
  if (input === 'G') {
    handlers.scrollToBottom();
    return true;
  }
  return false;
}

function handleNormalModeInput(
  input: string,
  key: KeyState,
  serviceCount: number,
  focusedSpaceIndex: number | null,
  handlers: KeyHandlers,
): void {
  if (isQuitInput(input, key)) {
    handlers.exit();
    return;
  }
  if (input === '/') {
    handlers.setMode('command');
    return;
  }
  if (input === '?') {
    handlers.setMode('search');
    handlers.setSearchState(DEFAULT_SEARCH_STATE);
    return;
  }
  if (handleScrollInput(input, key, focusedSpaceIndex, handlers)) {
    return;
  }
  const num = Number.parseInt(input, 10);
  if (num >= 1 && num <= serviceCount) {
    handlers.setFocusedSpace(num - 1);
    return;
  }
  if (key.tab) {
    handlers.setFocusedSpace(handleTabNavigation(key, serviceCount, focusedSpaceIndex));
    return;
  }
  if (key.escape) {
    handlers.setFocusedSpace(null);
  }
}

function buildServiceDisplay(
  serviceId: string,
  config: Config,
  runtime: ServiceRuntime | undefined,
): ServiceDisplay {
  const serviceConfig = config.services.find((s) => s.id === serviceId);
  if (serviceConfig === undefined) {
    throw new Error(`Service not found: ${serviceId}`);
  }
  return {
    config: serviceConfig,
    state: runtime?.state ?? DEFAULT_SERVICE_STATE,
    logs: runtime?.logs ?? [],
    scrollOffset: runtime?.scrollOffset ?? 0,
  };
}

function buildServiceDisplays(
  config: Config,
  services: Record<string, ServiceRuntime>,
): ServiceDisplay[] {
  return config.services.map((svc) => buildServiceDisplay(svc.id, config, services[svc.id]));
}

interface AppState {
  config: Config;
  services: Record<string, ServiceRuntime>;
  focusedSpaceIndex: number | null;
  mode: AppMode;
  commandInput: string;
  searchState: SearchState | null;
}

interface AppActions {
  setFocusedSpace: (index: number | null) => void;
  setMode: (mode: AppMode) => void;
  setCommandInput: (input: string) => void;
  setSearchState: (state: SearchState | null) => void;
}

function useAppState(store: AppStoreApi): AppState {
  const config = useStore(store, (s) => s.config);
  const services = useStore(store, (s) => s.services);
  const focusedSpaceIndex = useStore(store, (s) => s.focusedSpaceIndex);
  const mode = useStore(store, (s) => s.mode);
  const commandInput = useStore(store, (s) => s.commandInput);
  const searchState = useStore(store, (s) => s.searchState);

  return { config, services, focusedSpaceIndex, mode, commandInput, searchState };
}

function useAppActions(store: AppStoreApi): AppActions {
  const setFocusedSpace = useStore(store, (s) => s.setFocusedSpace);
  const setMode = useStore(store, (s) => s.setMode);
  const setCommandInput = useStore(store, (s) => s.setCommandInput);
  const setSearchState = useStore(store, (s) => s.setSearchState);

  return { setFocusedSpace, setMode, setCommandInput, setSearchState };
}

function getSearchTerm(searchState: SearchState | null): string {
  return searchState?.term ?? '';
}

function getSearchMatches(searchState: SearchState | null): readonly SearchMatch[] {
  return searchState?.matches ?? [];
}

function getCurrentMatchIndex(searchState: SearchState | null): number {
  return searchState?.currentMatchIndex ?? 0;
}

function getMatchCount(searchState: SearchState | null): number {
  return searchState?.matches.length ?? 0;
}

function dispatchInput(input: string, key: KeyState, state: AppState, handlers: KeyHandlers): void {
  if (state.mode === 'command') {
    handleCommandModeInput(input, key, state.commandInput, handlers);
    return;
  }
  if (state.mode === 'search') {
    handleSearchModeInput(input, key, state.searchState, handlers);
    return;
  }
  handleNormalModeInput(input, key, state.config.services.length, state.focusedSpaceIndex, handlers);
}

interface ScrollContext {
  readonly store: AppStoreApi;
  readonly config: Config;
  readonly focusedSpaceIndex: number | null;
}

function createScrollHandlers(ctx: ScrollContext): Pick<KeyHandlers, 'scrollUp' | 'scrollDown' | 'scrollToTop' | 'scrollToBottom'> {
  const getFocusedService = (): { serviceId: string; runtime: ServiceRuntime } | null => {
    if (ctx.focusedSpaceIndex === null) {
      return null;
    }
    const service = ctx.config.services[ctx.focusedSpaceIndex];
    if (service === undefined) {
      return null;
    }
    const runtime = ctx.store.getState().services[service.id];
    return runtime ? { serviceId: service.id, runtime } : null;
  };

  return {
    scrollUp: (): void => {
      const focused = getFocusedService();
      if (focused !== null) {
        ctx.store.getState().setScrollOffset(focused.serviceId, focused.runtime.scrollOffset - 1);
      }
    },
    scrollDown: (): void => {
      const focused = getFocusedService();
      if (focused !== null) {
        ctx.store.getState().setScrollOffset(focused.serviceId, focused.runtime.scrollOffset + 1);
      }
    },
    scrollToTop: (): void => {
      const focused = getFocusedService();
      if (focused !== null) {
        ctx.store.getState().setScrollOffset(focused.serviceId, 0);
      }
    },
    scrollToBottom: (): void => {
      const focused = getFocusedService();
      if (focused !== null) {
        const maxOffset = Math.max(0, focused.runtime.logs.length - 10);
        ctx.store.getState().setScrollOffset(focused.serviceId, maxOffset);
      }
    },
  };
}

function useKeyHandlers(
  actions: AppActions,
  exit: () => void,
  commands: UseCommandsResult,
  search: UseSearchResult,
  scrollCtx: ScrollContext,
): KeyHandlers {
  return useMemo(() => {
    const scrollHandlers = createScrollHandlers(scrollCtx);
    return {
      ...actions,
      exit,
      executeCommand: commands.executeCommand,
      updateSearchTerm: search.updateSearchTerm,
      nextMatch: search.nextMatch,
      prevMatch: search.prevMatch,
      ...scrollHandlers,
    };
  }, [actions, exit, commands.executeCommand, search.updateSearchTerm, search.nextMatch, search.prevMatch, scrollCtx]);
}

function AppContent({ store, config }: { readonly store: AppStoreApi; readonly config: Config }): React.ReactElement {
  const { exit } = useApp();
  const state = useAppState(store);
  const actions = useAppActions(store);
  const serviceManager = useServiceManager(config, store);
  const commands = useCommands(config, store, serviceManager, exit);
  const search = useSearch(store);
  const scrollCtx = useMemo(() => ({ store, config: state.config, focusedSpaceIndex: state.focusedSpaceIndex }), [store, state.config, state.focusedSpaceIndex]);
  const handlers = useKeyHandlers(actions, exit, commands, search, scrollCtx);
  const serviceDisplays = useMemo(() => buildServiceDisplays(state.config, state.services), [state.config, state.services]);

  useInput((input, key) => {
    dispatchInput(input, key, state, handlers);
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header projectName={state.config.global.name} />
      <Layout
        services={serviceDisplays}
        columnsConfig={state.config.global.columns}
        focusedIndex={state.focusedSpaceIndex}
        searchTerm={getSearchTerm(state.searchState)}
        searchMatches={getSearchMatches(state.searchState)}
        currentMatchIndex={getCurrentMatchIndex(state.searchState)}
        onStart={serviceManager.startService}
        onStop={serviceManager.stopService}
        onKill={serviceManager.killService}
      />
      <Footer
        mode={state.mode}
        commandInput={state.commandInput}
        searchTerm={getSearchTerm(state.searchState)}
        matchCount={getMatchCount(state.searchState)}
        currentMatch={getCurrentMatchIndex(state.searchState)}
      />
    </Box>
  );
}

export function App({ config }: AppProps): React.ReactElement {
  const store = useMemo(() => createAppStore(config), [config]);

  return <AppContent store={store} config={config} />;
}
