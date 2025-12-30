import { Box, useApp, useInput } from 'ink';
import React, { useCallback, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import { Footer, FullscreenOverlay, Header, HelpOverlay, Layout } from './components/index.js';
import { useCommands, useMouse, useSearch, useServiceManager } from './hooks/index.js';
import { createAppStore } from './store/index.js';

import type { ServiceDisplay } from './components/index.js';
import type { Config, ServiceState } from './config/index.js';
import type { UseCommandsResult, UseSearchResult, UseServiceManagerResult } from './hooks/index.js';
import type {
  AppMode,
  AppStoreApi,
  SearchMatch,
  SearchState,
  ServiceRuntime,
} from './store/index.js';

export interface AppProps {
  readonly config: Config;
}

interface KeyHandlers {
  readonly setMode: (mode: AppMode) => void;
  readonly setCommandInput: (input: string) => void;
  readonly setSearchState: (state: SearchState | null) => void;
  readonly setFocusedSpace: (index: number | null) => void;
  readonly quit: () => void;
  readonly startAll: () => void;
  readonly stopAll: () => void;
  readonly executeCommand: UseCommandsResult['executeCommand'];
  readonly updateSearchTerm: UseSearchResult['updateSearchTerm'];
  readonly nextMatch: UseSearchResult['nextMatch'];
  readonly prevMatch: UseSearchResult['prevMatch'];
  readonly scrollUp: () => void;
  readonly scrollDown: () => void;
  readonly scrollPageUp: () => void;
  readonly scrollPageDown: () => void;
  readonly scrollToTop: () => void;
  readonly scrollToBottom: () => void;
  readonly startFocusedService: () => void;
  readonly stopFocusedService: () => void;
  readonly killFocusedService: () => void;
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
  readonly leftArrow: boolean;
  readonly rightArrow: boolean;
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

function handleFullscreenModeInput(input: string, key: KeyState, handlers: KeyHandlers): void {
  if (key.escape) {
    handlers.setMode('normal');
    return;
  }
  if (key.upArrow || input === 'k') {
    handlers.scrollUp();
    return;
  }
  if (key.downArrow || input === 'j') {
    handlers.scrollDown();
    return;
  }
  if (key.leftArrow) {
    handlers.scrollPageUp();
    return;
  }
  if (key.rightArrow) {
    handlers.scrollPageDown();
    return;
  }
  if (input === 'g') {
    handlers.scrollToTop();
    return;
  }
  if (input === 'G') {
    handlers.scrollToBottom();
  }
}

function handleTabNavigation(
  key: KeyState,
  serviceCount: number,
  focusedSpaceIndex: number | null,
): number {
  const current = focusedSpaceIndex ?? -1;
  if (key.shift) {
    return (current - 1 + serviceCount) % serviceCount;
  }
  return (current + 1) % serviceCount;
}

function handleScrollInput(
  input: string,
  key: KeyState,
  focusedSpaceIndex: number | null,
  handlers: KeyHandlers,
): boolean {
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
  if (key.leftArrow) {
    handlers.scrollPageUp();
    return true;
  }
  if (key.rightArrow) {
    handlers.scrollPageDown();
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

function handleServiceActions(
  input: string,
  focusedSpaceIndex: number | null,
  handlers: KeyHandlers,
): boolean {
  // Service actions work when a panel is focused
  if (focusedSpaceIndex === null) {
    return false;
  }
  // s to start
  if (input === 's') {
    handlers.startFocusedService();
    return true;
  }
  // x to stop
  if (input === 'x') {
    handlers.stopFocusedService();
    return true;
  }
  // K (capital) to kill
  if (input === 'K') {
    handlers.killFocusedService();
    return true;
  }
  return false;
}

function handleGlobalCommands(input: string, handlers: KeyHandlers): boolean {
  if (input === 'S') {
    handlers.startAll();
    return true;
  }
  if (input === 'X') {
    handlers.stopAll();
    return true;
  }
  return false;
}

function handleModeSwitch(input: string, handlers: KeyHandlers): boolean {
  if (input === '/') {
    handlers.setMode('command');
    return true;
  }
  if (input === '?') {
    handlers.executeCommand('help');
    return true;
  }
  if (input === 'f') {
    handlers.setMode('search');
    handlers.setSearchState(DEFAULT_SEARCH_STATE);
    return true;
  }
  return false;
}

function handleEscapeKey(
  key: KeyState,
  focusedSpaceIndex: number | null,
  handlers: KeyHandlers,
): boolean {
  // Escape unfocuses
  if (key.escape && focusedSpaceIndex !== null) {
    handlers.setFocusedSpace(null);
    return true;
  }
  return false;
}

function handleEnterFullscreen(
  key: KeyState,
  focusedSpaceIndex: number | null,
  handlers: KeyHandlers,
): boolean {
  // Enter opens fullscreen when a panel is focused
  if (key.return && focusedSpaceIndex !== null) {
    handlers.setMode('fullscreen');
    return true;
  }
  return false;
}

function handleFocusNavigation(
  input: string,
  key: KeyState,
  serviceCount: number,
  focusedSpaceIndex: number | null,
  handlers: KeyHandlers,
): boolean {
  const num = Number.parseInt(input, 10);
  if (num >= 1 && num <= serviceCount) {
    handlers.setFocusedSpace(num - 1);
    return true;
  }
  if (key.tab) {
    handlers.setFocusedSpace(handleTabNavigation(key, serviceCount, focusedSpaceIndex));
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
    handlers.quit();
    return;
  }
  if (handleEscapeKey(key, focusedSpaceIndex, handlers)) {
    return;
  }
  if (handleEnterFullscreen(key, focusedSpaceIndex, handlers)) {
    return;
  }
  if (handleGlobalCommands(input, handlers)) {
    return;
  }
  if (handleModeSwitch(input, handlers)) {
    return;
  }
  if (handleServiceActions(input, focusedSpaceIndex, handlers)) {
    return;
  }
  if (handleScrollInput(input, key, focusedSpaceIndex, handlers)) {
    return;
  }
  handleFocusNavigation(input, key, serviceCount, focusedSpaceIndex, handlers);
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
  if (state.mode === 'help') {
    // Any key closes help
    handlers.setMode('normal');
    return;
  }
  if (state.mode === 'fullscreen') {
    handleFullscreenModeInput(input, key, handlers);
    return;
  }
  handleNormalModeInput(
    input,
    key,
    state.config.services.length,
    state.focusedSpaceIndex,
    handlers,
  );
}

interface ScrollContext {
  readonly store: AppStoreApi;
  readonly config: Config;
  readonly focusedSpaceIndex: number | null;
}

interface ServiceActionContext {
  readonly config: Config;
  readonly focusedSpaceIndex: number | null;
  readonly startService: (serviceId: string) => void;
  readonly stopService: (serviceId: string) => void;
  readonly killService: (serviceId: string) => void;
  readonly startAll: () => void;
  readonly stopAll: () => void;
}

function createServiceActionHandlers(
  ctx: ServiceActionContext,
): Pick<
  KeyHandlers,
  'startFocusedService' | 'stopFocusedService' | 'killFocusedService' | 'startAll' | 'stopAll'
> {
  const getFocusedServiceId = (): string | null => {
    if (ctx.focusedSpaceIndex === null) {
      return null;
    }
    const service = ctx.config.services[ctx.focusedSpaceIndex];
    return service?.id ?? null;
  };

  return {
    startFocusedService: (): void => {
      const serviceId = getFocusedServiceId();
      if (serviceId !== null) {
        ctx.startService(serviceId);
      }
    },
    stopFocusedService: (): void => {
      const serviceId = getFocusedServiceId();
      if (serviceId !== null) {
        ctx.stopService(serviceId);
      }
    },
    killFocusedService: (): void => {
      const serviceId = getFocusedServiceId();
      if (serviceId !== null) {
        ctx.killService(serviceId);
      }
    },
    startAll: ctx.startAll,
    stopAll: ctx.stopAll,
  };
}

const SCROLL_LINES = 3;
const PAGE_SIZE = 10;

type ScrollHandlerKeys =
  | 'scrollUp'
  | 'scrollDown'
  | 'scrollPageUp'
  | 'scrollPageDown'
  | 'scrollToTop'
  | 'scrollToBottom';

interface FocusedService {
  readonly serviceId: string;
  readonly runtime: ServiceRuntime;
}

function getFocusedServiceFromContext(ctx: ScrollContext): FocusedService | null {
  const state = ctx.store.getState();
  const focusedIndex = state.focusedSpaceIndex;
  if (focusedIndex === null) {
    return null;
  }
  const service = ctx.config.services[focusedIndex];
  if (service === undefined) {
    return null;
  }
  const runtime = state.services[service.id];
  return runtime ? { serviceId: service.id, runtime } : null;
}

function getClampedOffset(runtime: ServiceRuntime): number {
  // Estimate visible lines based on terminal height
  // Header ~3, Footer ~3, panel border ~4, so content is roughly termHeight - 10
  const { stdout } = process;
  const termHeight = stdout.rows;
  const estimatedVisibleLines = Math.max(5, Math.floor((termHeight - 10) / 2)); // Divided by rows of panels
  const maxOffset = Math.max(0, runtime.logs.length - estimatedVisibleLines);
  return Math.min(runtime.scrollOffset, maxOffset);
}

function createScrollByAmount(ctx: ScrollContext, amount: number): () => void {
  return (): void => {
    const focused = getFocusedServiceFromContext(ctx);
    if (focused !== null) {
      const current = getClampedOffset(focused.runtime);
      ctx.store.getState().setScrollOffset(focused.serviceId, current + amount);
    }
  };
}

function createScrollHandlers(ctx: ScrollContext): Pick<KeyHandlers, ScrollHandlerKeys> {
  return {
    scrollUp: createScrollByAmount(ctx, -SCROLL_LINES),
    scrollDown: createScrollByAmount(ctx, SCROLL_LINES),
    scrollPageUp: createScrollByAmount(ctx, -PAGE_SIZE),
    scrollPageDown: createScrollByAmount(ctx, PAGE_SIZE),
    scrollToTop: (): void => {
      const focused = getFocusedServiceFromContext(ctx);
      if (focused !== null) {
        ctx.store.getState().setScrollOffset(focused.serviceId, 0);
      }
    },
    scrollToBottom: (): void => {
      const focused = getFocusedServiceFromContext(ctx);
      if (focused !== null) {
        const maxOffset = Math.max(0, focused.runtime.logs.length - 1);
        ctx.store.getState().setScrollOffset(focused.serviceId, maxOffset);
      }
    },
  };
}

function useKeyHandlers(
  actions: AppActions,
  quit: () => void,
  commands: UseCommandsResult,
  search: UseSearchResult,
  scrollCtx: ScrollContext,
  serviceCtx: ServiceActionContext,
): KeyHandlers {
  return useMemo(() => {
    const scrollHandlers = createScrollHandlers(scrollCtx);
    const serviceHandlers = createServiceActionHandlers(serviceCtx);
    return {
      ...actions,
      quit,
      executeCommand: commands.executeCommand,
      updateSearchTerm: search.updateSearchTerm,
      nextMatch: search.nextMatch,
      prevMatch: search.prevMatch,
      ...scrollHandlers,
      ...serviceHandlers,
    };
  }, [
    actions,
    quit,
    commands.executeCommand,
    search.updateSearchTerm,
    search.nextMatch,
    search.prevMatch,
    scrollCtx,
    serviceCtx,
  ]);
}

function useScrollContext(store: AppStoreApi, state: AppState): ScrollContext {
  return useMemo(
    () => ({ store, config: state.config, focusedSpaceIndex: state.focusedSpaceIndex }),
    [store, state.config, state.focusedSpaceIndex],
  );
}

function useServiceContext(
  state: AppState,
  serviceManager: UseServiceManagerResult,
): ServiceActionContext {
  return useMemo(
    () => ({
      config: state.config,
      focusedSpaceIndex: state.focusedSpaceIndex,
      startService: serviceManager.startService,
      stopService: serviceManager.stopService,
      killService: serviceManager.killService,
      startAll: serviceManager.startAll,
      stopAll: serviceManager.stopAll,
    }),
    [state.config, state.focusedSpaceIndex, serviceManager],
  );
}

interface FullscreenViewProps {
  readonly state: AppState;
  readonly serviceDisplays: ServiceDisplay[];
}

function FullscreenView({
  state,
  serviceDisplays,
}: FullscreenViewProps): React.ReactElement | null {
  if (state.focusedSpaceIndex === null) {
    return null;
  }
  const focusedService = serviceDisplays[state.focusedSpaceIndex];
  if (focusedService === undefined) {
    return null;
  }
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Header projectName={state.config.global.name} />
      <FullscreenOverlay
        config={focusedService.config}
        state={focusedService.state}
        logs={focusedService.logs}
        scrollOffset={focusedService.scrollOffset}
        searchTerm={getSearchTerm(state.searchState)}
        searchMatches={getSearchMatches(state.searchState)}
        currentMatchIndex={getCurrentMatchIndex(state.searchState)}
      />
    </Box>
  );
}

interface MainViewProps {
  readonly state: AppState;
  readonly serviceDisplays: ServiceDisplay[];
  readonly serviceManager: UseServiceManagerResult;
}

function MainView({ state, serviceDisplays, serviceManager }: MainViewProps): React.ReactElement {
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
        focusedIndex={state.focusedSpaceIndex}
        commandInput={state.commandInput}
        searchTerm={getSearchTerm(state.searchState)}
        matchCount={getMatchCount(state.searchState)}
        currentMatch={getCurrentMatchIndex(state.searchState)}
      />
    </Box>
  );
}

interface MouseConfig {
  readonly serviceCount: number;
  readonly columns: number | 'auto';
}

interface MouseHandlersResult {
  readonly onScrollUp: () => void;
  readonly onScrollDown: () => void;
  readonly onClick: (col: number, row: number) => void;
}

function calculateColumns(configColumns: number | 'auto', serviceCount: number): number {
  const { stdout } = process;
  const termWidth = stdout.columns;
  if (configColumns !== 'auto') {
    return Math.min(configColumns, serviceCount);
  }
  if (termWidth < 80) {
    return 1;
  }
  if (termWidth < 120) {
    return Math.min(2, serviceCount);
  }
  return Math.min(3, serviceCount);
}

function getPanelIndexFromClick(col: number, row: number, config: MouseConfig): number | null {
  const { stdout } = process;
  const termWidth = stdout.columns;
  const termHeight = stdout.rows;

  // Header = 3 rows, Footer = 3 rows
  const headerHeight = 3;
  const footerHeight = 3;
  const contentTop = headerHeight;
  const contentHeight = termHeight - headerHeight - footerHeight;

  if (row <= contentTop || row > contentTop + contentHeight) {
    return null;
  }

  const columns = calculateColumns(config.columns, config.serviceCount);
  const rows = Math.ceil(config.serviceCount / columns);
  const panelWidth = Math.floor(termWidth / columns);
  const panelHeight = Math.floor(contentHeight / rows);

  const panelCol = Math.floor((col - 1) / panelWidth);
  const panelRow = Math.floor((row - contentTop - 1) / panelHeight);
  const panelIndex = panelRow * columns + panelCol;

  return panelIndex >= 0 && panelIndex < config.serviceCount ? panelIndex : null;
}

function createMouseHandlers(
  handlersRef: React.RefObject<KeyHandlers>,
  config: MouseConfig,
): MouseHandlersResult {
  return {
    onScrollUp: (): void => {
      handlersRef.current.scrollUp();
    },
    onScrollDown: (): void => {
      handlersRef.current.scrollDown();
    },
    onClick: (col: number, row: number): void => {
      const panelIndex = getPanelIndexFromClick(col, row, config);
      if (panelIndex !== null) {
        handlersRef.current.setFocusedSpace(panelIndex);
      }
    },
  };
}

function useMouseSupport(state: AppState, handlersRef: React.RefObject<KeyHandlers>): void {
  const mouseEnabled = state.mode !== 'help' && state.mode !== 'command';
  const mouseConfig = useMemo(
    () => ({
      serviceCount: state.config.services.length,
      columns: state.config.global.columns,
    }),
    [state.config.services.length, state.config.global.columns],
  );
  const mouseHandlers = useMemo(
    () => createMouseHandlers(handlersRef, mouseConfig),
    [handlersRef, mouseConfig],
  );
  useMouse(mouseHandlers, mouseEnabled);
}

interface AppContentProps {
  readonly store: AppStoreApi;
  readonly config: Config;
}

function AppContent({ store, config }: AppContentProps): React.ReactElement {
  const { exit } = useApp();
  const state = useAppState(store);
  const actions = useAppActions(store);
  const serviceManager = useServiceManager(config, store);
  const commands = useCommands(config, store, serviceManager, exit);
  const search = useSearch(store);

  const quit = useCallback((): void => {
    serviceManager.stopAllAndWait(exit);
  }, [serviceManager, exit]);
  const scrollCtx = useScrollContext(store, state);
  const serviceCtx = useServiceContext(state, serviceManager);
  const handlers = useKeyHandlers(actions, quit, commands, search, scrollCtx, serviceCtx);
  const serviceDisplays = useMemo(
    () => buildServiceDisplays(state.config, state.services),
    [state.config, state.services],
  );

  // Use refs to ensure useInput always has latest state and handlers
  const stateRef = useRef(state);
  const handlersRef = useRef(handlers);
  stateRef.current = state;
  handlersRef.current = handlers;

  useInput((input, key) => {
    dispatchInput(input, key, stateRef.current, handlersRef.current);
  });

  useMouseSupport(state, handlersRef);

  if (state.mode === 'help') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header projectName={state.config.global.name} />
        <HelpOverlay />
      </Box>
    );
  }

  if (state.mode === 'fullscreen') {
    const fullscreenView = FullscreenView({ state, serviceDisplays });
    if (fullscreenView !== null) {
      return fullscreenView;
    }
  }

  return (
    <MainView state={state} serviceDisplays={serviceDisplays} serviceManager={serviceManager} />
  );
}

export function App({ config }: AppProps): React.ReactElement {
  const store = useMemo(() => createAppStore(config), [config]);

  return <AppContent store={store} config={config} />;
}
