import { spawn } from 'node:child_process';

import { Box, useApp, useInput } from 'ink';
import React, { useCallback, useMemo, useRef } from 'react';
import { useStore } from 'zustand';

import {
  Footer,
  FullscreenOverlay,
  Header,
  HelpOverlay,
  Layout,
  ScriptHistoryOverlay,
  ScriptOutputOverlay,
  ScriptsOverlay,
} from './components/index.js';
import { useCommands, useMouse, useSearch, useServiceManager } from './hooks/index.js';
import { createAppStore } from './store/index.js';
import { copyToClipboard } from './utils/index.js';

import type { ServiceDisplay } from './components/index.js';
import type { Config, ScriptExecution, ServiceState } from './config/index.js';
import type { UseCommandsResult, UseSearchResult, UseServiceManagerResult } from './hooks/index.js';
import type {
  AppMode,
  AppStoreApi,
  ScriptHistoryState,
  ScriptsMenuState,
  ScriptOutputState,
  SearchMatch,
  SearchState,
  ServiceRuntime,
  VisualModeState,
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
  readonly copyVisibleLogs: () => void;
  readonly copyAllLogs: () => void;
  // Scripts actions
  readonly openScriptsMenu: () => void;
  readonly closeScriptsMenu: () => void;
  readonly openServiceHistory: () => void;
  readonly openAllHistory: () => void;
  readonly closeHistory: () => void;
  readonly closeScriptOutput: () => void;
  // Scripts menu navigation
  readonly scriptsMenuUp: () => void;
  readonly scriptsMenuDown: () => void;
  readonly scriptsMenuSelect: () => void;
  readonly scriptsMenuInput: (char: string) => void;
  readonly scriptsMenuBackspace: () => void;
  readonly scriptsMenuSelectByKey: (key: string) => void;
  // Script history navigation
  readonly historyUp: () => void;
  readonly historyDown: () => void;
  readonly historyScrollUp: () => void;
  readonly historyScrollDown: () => void;
  readonly historyScrollToTop: () => void;
  readonly historyScrollToBottom: () => void;
  // Visual mode actions
  readonly enterVisualMode: () => void;
  readonly exitVisualMode: () => void;
  readonly visualCursorUp: () => void;
  readonly visualCursorDown: () => void;
  readonly copyVisualSelection: () => void;
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

function handleFullscreenScrollInput(input: string, key: KeyState, handlers: KeyHandlers): boolean {
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

function handleFullscreenModeInput(input: string, key: KeyState, handlers: KeyHandlers): void {
  if (key.escape) {
    handlers.setMode('normal');
    return;
  }
  if (handleFullscreenScrollInput(input, key, handlers)) {
    return;
  }
  if (input === 'y') {
    handlers.copyVisibleLogs();
    return;
  }
  if (input === 'Y') {
    handlers.copyAllLogs();
    return;
  }
  if (input === 'v') {
    handlers.enterVisualMode();
  }
}

function handleVisualModeInput(input: string, key: KeyState, handlers: KeyHandlers): void {
  if (key.escape) {
    handlers.exitVisualMode();
    return;
  }
  if (key.upArrow || input === 'k') {
    handlers.visualCursorUp();
    return;
  }
  if (key.downArrow || input === 'j') {
    handlers.visualCursorDown();
    return;
  }
  if (input === 'y') {
    handlers.copyVisualSelection();
    return;
  }
  if (input === 'Y') {
    handlers.copyAllLogs();
  }
}

function handleScriptOutputModeInput(key: KeyState, handlers: KeyHandlers): void {
  if (key.escape) {
    handlers.closeScriptOutput();
  }
}

function handleScriptHistoryModeInput(input: string, key: KeyState, handlers: KeyHandlers): void {
  if (key.escape) {
    handlers.closeHistory();
    return;
  }
  // Up/down arrows navigate the execution list
  if (key.upArrow || input === 'k') {
    handlers.historyUp();
    return;
  }
  if (key.downArrow || input === 'j') {
    handlers.historyDown();
    return;
  }
  // Left/right arrows scroll the output pane
  if (key.leftArrow) {
    handlers.historyScrollUp();
    return;
  }
  if (key.rightArrow) {
    handlers.historyScrollDown();
    return;
  }
  if (input === 'g') {
    handlers.historyScrollToTop();
    return;
  }
  if (input === 'G') {
    handlers.historyScrollToBottom();
  }
}

function handleScriptsModeInput(
  input: string,
  key: KeyState,
  handlers: KeyHandlers,
  isCollectingParams: boolean,
): void {
  if (key.escape) {
    handlers.closeScriptsMenu();
    return;
  }
  if (key.upArrow) {
    handlers.scriptsMenuUp();
    return;
  }
  if (key.downArrow) {
    handlers.scriptsMenuDown();
    return;
  }
  if (key.return) {
    handlers.scriptsMenuSelect();
    return;
  }
  if (isCollectingParams) {
    if (key.backspace || key.delete) {
      handlers.scriptsMenuBackspace();
      return;
    }
    if (isTypableInput(input, key)) {
      handlers.scriptsMenuInput(input);
    }
    return;
  }
  // Not collecting params - check for hotkey
  if (isTypableInput(input, key)) {
    handlers.scriptsMenuSelectByKey(input);
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
  // r to open scripts menu
  if (input === 'r') {
    handlers.openScriptsMenu();
    return true;
  }
  // h to open service script history
  if (input === 'h') {
    handlers.openServiceHistory();
    return true;
  }
  // y to copy visible logs
  if (input === 'y') {
    handlers.copyVisibleLogs();
    return true;
  }
  // Y to copy all logs
  if (input === 'Y') {
    handlers.copyAllLogs();
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
  // H for all services script history
  if (input === 'H') {
    handlers.openAllHistory();
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
  scriptsMenuState: ScriptsMenuState | null;
  scriptOutputState: ScriptOutputState | null;
  scriptHistoryState: ScriptHistoryState | null;
  scriptHistory: readonly ScriptExecution[];
  notification: string | null;
  visualModeState: VisualModeState | null;
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
  const scriptsMenuState = useStore(store, (s) => s.scriptsMenuState);
  const scriptOutputState = useStore(store, (s) => s.scriptOutputState);
  const scriptHistoryState = useStore(store, (s) => s.scriptHistoryState);
  const scriptHistory = useStore(store, (s) => s.scriptHistory);
  const notification = useStore(store, (s) => s.notification);
  const visualModeState = useStore(store, (s) => s.visualModeState);

  return {
    config,
    services,
    focusedSpaceIndex,
    mode,
    commandInput,
    searchState,
    scriptsMenuState,
    scriptOutputState,
    scriptHistoryState,
    scriptHistory,
    notification,
    visualModeState,
  };
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
  if (state.mode === 'visual') {
    handleVisualModeInput(input, key, handlers);
    return;
  }
  if (state.mode === 'scriptOutput') {
    handleScriptOutputModeInput(key, handlers);
    return;
  }
  if (state.mode === 'scriptHistory') {
    handleScriptHistoryModeInput(input, key, handlers);
    return;
  }
  if (state.mode === 'scripts') {
    const isCollectingParams =
      state.scriptsMenuState !== null && state.scriptsMenuState.currentParamIndex >= 0;
    handleScriptsModeInput(input, key, handlers, isCollectingParams);
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

interface ScriptsContext {
  readonly store: AppStoreApi;
  readonly config: Config;
  readonly focusedSpaceIndex: number | null;
  readonly runScript: (
    serviceId: string,
    scriptIndex: number,
    params: Record<string, string>,
  ) => void;
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

function calculateVisibleLines(ctx: ScrollContext): number {
  const { stdout } = process;
  const termHeight = stdout.rows;
  const state = ctx.store.getState();
  const isFullscreen = state.mode === 'fullscreen';

  if (isFullscreen) {
    // Fullscreen: terminal height - 6 (header, footer, borders)
    return Math.max(1, termHeight - 6);
  }

  // Normal mode: calculate based on panel layout
  const serviceCount = ctx.config.services.length;
  const columns = calculateColumns(ctx.config.global.columns, serviceCount);
  const rows = Math.ceil(serviceCount / columns);
  const availableHeight = termHeight - 6; // header + footer
  const panelHeight = Math.floor(availableHeight / rows);
  const contentHeight = panelHeight - 4; // panel border + header
  return Math.max(1, contentHeight);
}

function createCopyHandlers(
  ctx: ScrollContext,
): Pick<KeyHandlers, 'copyVisibleLogs' | 'copyAllLogs'> {
  const doCopy = (allLogs: boolean): void => {
    const focused = getFocusedServiceFromContext(ctx);
    if (focused === null) {
      return;
    }
    const logs = focused.runtime.logs;
    let linesToCopy: typeof logs;
    if (allLogs) {
      linesToCopy = logs;
    } else {
      const visibleLines = calculateVisibleLines(ctx);
      // Clamp offset like LogView does (scrollOffset can be MAX_SAFE_INTEGER for auto-scroll)
      const maxOffset = Math.max(0, logs.length - visibleLines);
      const offset = Math.min(focused.runtime.scrollOffset, maxOffset);
      linesToCopy = logs.slice(offset, offset + visibleLines);
    }
    const text = linesToCopy.map((line) => line.content).join('\n');
    const success = copyToClipboard(text);
    const message = success
      ? `Copied ${String(linesToCopy.length)} lines`
      : 'Failed to copy to clipboard';
    ctx.store.getState().setNotification(message);
    setTimeout(() => {
      ctx.store.getState().setNotification(null);
    }, 2000);
  };

  return {
    copyVisibleLogs: (): void => {
      doCopy(false);
    },
    copyAllLogs: (): void => {
      doCopy(true);
    },
  };
}

type VisualModeHandlerKeys =
  | 'enterVisualMode'
  | 'exitVisualMode'
  | 'visualCursorUp'
  | 'visualCursorDown'
  | 'copyVisualSelection';

interface FocusedLogs {
  readonly logs: readonly { content: string }[];
  readonly logCount: number;
}

function getFocusedLogs(ctx: ScrollContext): FocusedLogs | null {
  const focused = getFocusedServiceFromContext(ctx);
  if (focused === null) return null;
  return { logs: focused.runtime.logs, logCount: focused.runtime.logs.length };
}

function performVisualCopy(ctx: ScrollContext): void {
  const state = ctx.store.getState();
  const data = getFocusedLogs(ctx);
  if (state.visualModeState === null || data === null) return;
  const { cursorLine, selectionStart } = state.visualModeState;
  const startLine = Math.min(cursorLine, selectionStart);
  const endLine = Math.max(cursorLine, selectionStart);
  const selectedLogs = data.logs.slice(startLine, endLine + 1);
  const text = selectedLogs.map((line) => line.content).join('\n');
  const success = copyToClipboard(text);
  const message = success ? `Copied ${String(selectedLogs.length)} lines` : 'Failed to copy';
  state.setNotification(message);
  state.exitVisualMode();
  setTimeout(() => {
    ctx.store.getState().setNotification(null);
  }, 2000);
}

function scrollToCursor(ctx: ScrollContext, cursorLine: number): void {
  const focused = getFocusedServiceFromContext(ctx);
  if (focused === null) return;
  const visibleLines = calculateVisibleLines(ctx);
  const currentOffset = Math.min(focused.runtime.scrollOffset, focused.runtime.logs.length - 1);
  // Scroll up if cursor is above visible area
  if (cursorLine < currentOffset) {
    ctx.store.getState().setScrollOffset(focused.serviceId, cursorLine);
  }
  // Scroll down if cursor is below visible area
  if (cursorLine >= currentOffset + visibleLines) {
    ctx.store.getState().setScrollOffset(focused.serviceId, cursorLine - visibleLines + 1);
  }
}

function createVisualModeHandlers(ctx: ScrollContext): Pick<KeyHandlers, VisualModeHandlerKeys> {
  return {
    enterVisualMode: (): void => {
      const data = getFocusedLogs(ctx);
      if (data === null || data.logCount === 0) return;
      const startLine = Math.max(0, data.logCount - 1);
      ctx.store.getState().enterVisualMode(startLine);
      scrollToCursor(ctx, startLine);
    },
    exitVisualMode: (): void => {
      ctx.store.getState().exitVisualMode();
    },
    visualCursorUp: (): void => {
      const state = ctx.store.getState();
      if (state.visualModeState === null) return;
      const newLine = Math.max(0, state.visualModeState.cursorLine - 1);
      state.moveVisualCursor(newLine);
      scrollToCursor(ctx, newLine);
    },
    visualCursorDown: (): void => {
      const state = ctx.store.getState();
      const data = getFocusedLogs(ctx);
      if (state.visualModeState === null || data === null) return;
      const newLine = Math.min(data.logCount - 1, state.visualModeState.cursorLine + 1);
      state.moveVisualCursor(newLine);
      scrollToCursor(ctx, newLine);
    },
    copyVisualSelection: (): void => {
      performVisualCopy(ctx);
    },
  };
}

type ScriptsHandlerKeys =
  | 'openScriptsMenu'
  | 'closeScriptsMenu'
  | 'openServiceHistory'
  | 'openAllHistory'
  | 'closeHistory'
  | 'closeScriptOutput'
  | 'scriptsMenuUp'
  | 'scriptsMenuDown'
  | 'scriptsMenuSelect'
  | 'scriptsMenuInput'
  | 'scriptsMenuBackspace'
  | 'scriptsMenuSelectByKey'
  | 'historyUp'
  | 'historyDown'
  | 'historyScrollUp'
  | 'historyScrollDown'
  | 'historyScrollToTop'
  | 'historyScrollToBottom';

interface ScriptsInfo {
  scripts: Config['services'][0]['scripts'];
  serviceId: string;
}

function getScriptsForCurrentMenu(ctx: ScriptsContext): ScriptsInfo | null {
  const state = ctx.store.getState();
  if (state.scriptsMenuState === null) return null;
  const service = ctx.config.services.find((s) => s.id === state.scriptsMenuState?.serviceId);
  if (service === undefined) return null;
  return { scripts: service.scripts, serviceId: service.id };
}

function handleScriptSelect(ctx: ScriptsContext): void {
  const state = ctx.store.getState();
  if (state.scriptsMenuState === null) return;
  const info = getScriptsForCurrentMenu(ctx);
  if (info === null) return;
  const script = info.scripts[state.scriptsMenuState.selectedIndex];
  if (script === undefined) return;
  // If script has params and we haven't started collecting, start collecting
  if (script.params.length > 0 && state.scriptsMenuState.currentParamIndex < 0) {
    ctx.store.setState({ scriptsMenuState: { ...state.scriptsMenuState, currentParamIndex: 0 } });
    return;
  }
  // If collecting params, advance or run
  if (state.scriptsMenuState.currentParamIndex >= 0) {
    state.advanceScriptsMenuParam();
    const newState = ctx.store.getState();
    if (
      newState.scriptsMenuState !== null &&
      newState.scriptsMenuState.currentParamIndex >= script.params.length
    ) {
      // All params collected, run the script (openScriptOutput clears menu state)
      ctx.runScript(
        info.serviceId,
        state.scriptsMenuState.selectedIndex,
        newState.scriptsMenuState.paramValues,
      );
    }
    return;
  }
  // No params, run immediately (openScriptOutput clears menu state)
  ctx.runScript(info.serviceId, state.scriptsMenuState.selectedIndex, {});
}

function handleScriptKeySelect(ctx: ScriptsContext, key: string): void {
  const state = ctx.store.getState();
  if (state.scriptsMenuState === null) return;
  const info = getScriptsForCurrentMenu(ctx);
  if (info === null) return;
  const scriptIndex = info.scripts.findIndex((s) => s.key === key);
  if (scriptIndex >= 0) {
    const script = info.scripts[scriptIndex];
    if (script !== undefined && script.params.length > 0) {
      // Has params, start collecting
      ctx.store.setState({
        scriptsMenuState: {
          ...state.scriptsMenuState,
          selectedIndex: scriptIndex,
          currentParamIndex: 0,
        },
      });
    } else {
      // No params, run immediately (openScriptOutput clears menu state)
      ctx.runScript(info.serviceId, scriptIndex, {});
    }
  }
}

type ScriptsMenuKeys =
  | 'scriptsMenuUp'
  | 'scriptsMenuDown'
  | 'scriptsMenuSelect'
  | 'scriptsMenuInput'
  | 'scriptsMenuBackspace'
  | 'scriptsMenuSelectByKey';

function createScriptsMenuHandlers(ctx: ScriptsContext): Pick<KeyHandlers, ScriptsMenuKeys> {
  return {
    scriptsMenuUp: (): void => {
      const state = ctx.store.getState();
      if (state.scriptsMenuState === null) return;
      const info = getScriptsForCurrentMenu(ctx);
      if (info === null || info.scripts.length === 0) return;
      const newIndex =
        (state.scriptsMenuState.selectedIndex - 1 + info.scripts.length) % info.scripts.length;
      state.setScriptsMenuSelection(newIndex);
    },
    scriptsMenuDown: (): void => {
      const state = ctx.store.getState();
      if (state.scriptsMenuState === null) return;
      const info = getScriptsForCurrentMenu(ctx);
      if (info === null || info.scripts.length === 0) return;
      const newIndex = (state.scriptsMenuState.selectedIndex + 1) % info.scripts.length;
      state.setScriptsMenuSelection(newIndex);
    },
    scriptsMenuSelect: (): void => {
      handleScriptSelect(ctx);
    },
    scriptsMenuInput: (char: string): void => {
      const state = ctx.store.getState();
      if (state.scriptsMenuState === null) return;
      state.setScriptsMenuInput(state.scriptsMenuState.inputValue + char);
    },
    scriptsMenuBackspace: (): void => {
      const state = ctx.store.getState();
      if (state.scriptsMenuState === null) return;
      state.setScriptsMenuInput(state.scriptsMenuState.inputValue.slice(0, -1));
    },
    scriptsMenuSelectByKey: (key: string): void => {
      handleScriptKeySelect(ctx, key);
    },
  };
}

function getHistoryExecutionCount(ctx: ScriptsContext): number {
  const state = ctx.store.getState();
  if (state.scriptHistoryState === null) return 0;
  if (state.scriptHistoryState.serviceFilter !== null) {
    return state.scriptHistory.filter(
      (e) => e.serviceId === state.scriptHistoryState?.serviceFilter,
    ).length;
  }
  return state.scriptHistory.length;
}

type HistoryHandlerKeys =
  | 'historyUp'
  | 'historyDown'
  | 'historyScrollUp'
  | 'historyScrollDown'
  | 'historyScrollToTop'
  | 'historyScrollToBottom';

function createHistoryHandlers(ctx: ScriptsContext): Pick<KeyHandlers, HistoryHandlerKeys> {
  return {
    historyUp: (): void => {
      const state = ctx.store.getState();
      if (state.scriptHistoryState === null) return;
      const count = getHistoryExecutionCount(ctx);
      if (count === 0) return;
      const newIndex = (state.scriptHistoryState.selectedIndex - 1 + count) % count;
      state.setScriptHistorySelection(newIndex);
      state.setScriptHistoryScroll(0); // Reset scroll when changing selection
    },
    historyDown: (): void => {
      const state = ctx.store.getState();
      if (state.scriptHistoryState === null) return;
      const count = getHistoryExecutionCount(ctx);
      if (count === 0) return;
      const newIndex = (state.scriptHistoryState.selectedIndex + 1) % count;
      state.setScriptHistorySelection(newIndex);
      state.setScriptHistoryScroll(0); // Reset scroll when changing selection
    },
    historyScrollUp: (): void => {
      const state = ctx.store.getState();
      if (state.scriptHistoryState === null) return;
      state.setScriptHistoryScroll(Math.max(0, state.scriptHistoryState.scrollOffset - 5));
    },
    historyScrollDown: (): void => {
      const state = ctx.store.getState();
      if (state.scriptHistoryState === null) return;
      state.setScriptHistoryScroll(state.scriptHistoryState.scrollOffset + 5);
    },
    historyScrollToTop: (): void => {
      ctx.store.getState().setScriptHistoryScroll(0);
    },
    historyScrollToBottom: (): void => {
      ctx.store.getState().setScriptHistoryScroll(9999);
    },
  };
}

function createScriptsHandlers(ctx: ScriptsContext): Pick<KeyHandlers, ScriptsHandlerKeys> {
  const getFocusedServiceId = (): string | null => {
    if (ctx.focusedSpaceIndex === null) return null;
    const service = ctx.config.services[ctx.focusedSpaceIndex];
    return service?.id ?? null;
  };

  const menuHandlers = createScriptsMenuHandlers(ctx);
  const historyHandlers = createHistoryHandlers(ctx);

  return {
    openScriptsMenu: (): void => {
      const serviceId = getFocusedServiceId();
      if (serviceId !== null) ctx.store.getState().openScriptsMenu(serviceId);
    },
    closeScriptsMenu: (): void => {
      ctx.store.getState().closeScriptsMenu();
    },
    openServiceHistory: (): void => {
      const serviceId = getFocusedServiceId();
      if (serviceId !== null) ctx.store.getState().openScriptHistory(serviceId);
    },
    openAllHistory: (): void => {
      ctx.store.getState().openScriptHistory(null);
    },
    closeHistory: (): void => {
      ctx.store.getState().closeScriptHistory();
    },
    closeScriptOutput: (): void => {
      ctx.store.getState().closeScriptOutput();
    },
    ...menuHandlers,
    ...historyHandlers,
  };
}

function useKeyHandlers(
  actions: AppActions,
  quit: () => void,
  commands: UseCommandsResult,
  search: UseSearchResult,
  scrollCtx: ScrollContext,
  serviceCtx: ServiceActionContext,
  scriptsCtx: ScriptsContext,
): KeyHandlers {
  return useMemo(() => {
    const scrollHandlers = createScrollHandlers(scrollCtx);
    const copyHandlers = createCopyHandlers(scrollCtx);
    const visualModeHandlers = createVisualModeHandlers(scrollCtx);
    const serviceHandlers = createServiceActionHandlers(serviceCtx);
    const scriptsHandlers = createScriptsHandlers(scriptsCtx);
    return {
      ...actions,
      quit,
      executeCommand: commands.executeCommand,
      updateSearchTerm: search.updateSearchTerm,
      nextMatch: search.nextMatch,
      prevMatch: search.prevMatch,
      ...scrollHandlers,
      ...copyHandlers,
      ...visualModeHandlers,
      ...serviceHandlers,
      ...scriptsHandlers,
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
    scriptsCtx,
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

function useScriptsContext(
  store: AppStoreApi,
  state: AppState,
  runScript: (serviceId: string, scriptIndex: number, params: Record<string, string>) => void,
): ScriptsContext {
  return useMemo(
    () => ({ store, config: state.config, focusedSpaceIndex: state.focusedSpaceIndex, runScript }),
    [store, state.config, state.focusedSpaceIndex, runScript],
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
  const isVisualMode = state.mode === 'visual';
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
        visualModeState={state.visualModeState}
        isVisualMode={isVisualMode}
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
        notification={state.notification}
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
  store: AppStoreApi,
): MouseHandlersResult {
  return {
    onScrollUp: (): void => {
      handlersRef.current.scrollUp();
    },
    onScrollDown: (): void => {
      handlersRef.current.scrollDown();
    },
    onClick: (col: number, row: number): void => {
      // Don't change focus in fullscreen mode
      const currentMode = store.getState().mode;
      if (currentMode === 'fullscreen') {
        return;
      }
      const panelIndex = getPanelIndexFromClick(col, row, config);
      if (panelIndex !== null) {
        handlersRef.current.setFocusedSpace(panelIndex);
      }
    },
  };
}

function useMouseSupport(
  state: AppState,
  handlersRef: React.RefObject<KeyHandlers>,
  store: AppStoreApi,
): void {
  const mouseEnabled = state.mode !== 'help' && state.mode !== 'command';
  const mouseConfig = useMemo(
    () => ({
      serviceCount: state.config.services.length,
      columns: state.config.global.columns,
    }),
    [state.config.services.length, state.config.global.columns],
  );
  const mouseHandlers = useMemo(
    () => createMouseHandlers(handlersRef, mouseConfig, store),
    [handlersRef, mouseConfig, store],
  );
  useMouse(mouseHandlers, mouseEnabled);
}

function renderScriptOverlays(state: AppState, store: AppStoreApi): React.ReactElement | null {
  if (state.mode === 'scripts' && state.scriptsMenuState !== null) {
    const serviceConfig = state.config.services.find(
      (s) => s.id === state.scriptsMenuState?.serviceId,
    );
    if (serviceConfig !== undefined) {
      return <ScriptsOverlay serviceConfig={serviceConfig} menuState={state.scriptsMenuState} />;
    }
  }

  if (state.mode === 'scriptOutput' && state.scriptOutputState !== null) {
    const execution = store.getState().getScriptExecution(state.scriptOutputState.executionId);
    if (execution !== undefined) {
      return <ScriptOutputOverlay execution={execution} />;
    }
  }

  if (state.mode === 'scriptHistory' && state.scriptHistoryState !== null) {
    const executions =
      state.scriptHistoryState.serviceFilter !== null
        ? state.scriptHistory.filter((e) => e.serviceId === state.scriptHistoryState?.serviceFilter)
        : state.scriptHistory;
    return <ScriptHistoryOverlay historyState={state.scriptHistoryState} executions={executions} />;
  }

  return null;
}

interface AppContentProps {
  readonly store: AppStoreApi;
  readonly config: Config;
}

function substituteParams(
  command: string,
  params: Record<string, string>,
  scriptParams: Config['services'][0]['scripts'][0]['params'],
): string {
  let result = command;
  for (const param of scriptParams) {
    const value = params[`param_${String(scriptParams.indexOf(param))}`] ?? '';
    result = result.replace(new RegExp(`\\{${param.id}\\}`, 'g'), value);
  }
  return result;
}

function createAutoCloseHandler(store: AppStoreApi, executionId: string): () => void {
  return (): void => {
    setTimeout(() => {
      const currentState = store.getState();
      if (
        currentState.mode === 'scriptOutput' &&
        currentState.scriptOutputState?.executionId === executionId
      ) {
        currentState.closeScriptOutput();
      }
    }, 3000);
  };
}

function setupScriptProcess(
  store: AppStoreApi,
  executionId: string,
  command: string,
  service: Config['services'][0],
): void {
  const child = spawn(command, {
    cwd: service.dir,
    shell: true,
    env: { ...process.env, ...service.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const handleData = (data: Buffer): void => {
    const lines = data
      .toString()
      .split('\n')
      .filter((l) => l.length > 0);
    for (const line of lines) {
      store.getState().updateScriptExecution(executionId, {
        output: [...(store.getState().getScriptExecution(executionId)?.output ?? []), line],
      });
    }
  };

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  const autoClose = createAutoCloseHandler(store, executionId);
  child.on('exit', (code) => {
    store.getState().updateScriptExecution(executionId, { endedAt: new Date(), exitCode: code });
    autoClose();
  });
  child.on('error', () => {
    store.getState().updateScriptExecution(executionId, { endedAt: new Date(), exitCode: null });
    autoClose();
  });
}

function executeScript(
  config: Config,
  store: AppStoreApi,
  serviceId: string,
  scriptIndex: number,
  params: Record<string, string>,
): void {
  const service = config.services.find((s) => s.id === serviceId);
  if (service === undefined) return;
  const script = service.scripts[scriptIndex];
  if (script === undefined) return;

  const command = substituteParams(script.command, params, script.params);
  const executionId = `exec_${String(Date.now())}_${Math.random().toString(36).slice(2, 9)}`;

  store.getState().addScriptExecution({
    id: executionId,
    serviceId,
    serviceName: service.name,
    scriptId: script.id,
    scriptName: script.name,
    command,
    startedAt: new Date(),
    endedAt: null,
    exitCode: null,
    output: [],
  });
  store.getState().openScriptOutput(executionId);
  setupScriptProcess(store, executionId, command, service);
}

function renderModeOverlay(
  state: AppState,
  store: AppStoreApi,
  serviceDisplays: ServiceDisplay[],
): React.ReactElement | null {
  if (state.mode === 'help') {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header projectName={state.config.global.name} />
        <HelpOverlay />
      </Box>
    );
  }
  if (state.mode === 'fullscreen' || state.mode === 'visual') {
    return FullscreenView({ state, serviceDisplays });
  }
  const scriptOverlay = renderScriptOverlays(state, store);
  if (scriptOverlay !== null) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Header projectName={state.config.global.name} />
        {scriptOverlay}
      </Box>
    );
  }
  return null;
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

  const runScript = useCallback(
    (serviceId: string, scriptIndex: number, params: Record<string, string>): void => {
      executeScript(config, store, serviceId, scriptIndex, params);
    },
    [config, store],
  );

  const scrollCtx = useScrollContext(store, state);
  const serviceCtx = useServiceContext(state, serviceManager);
  const scriptsCtx = useScriptsContext(store, state, runScript);
  const handlers = useKeyHandlers(
    actions,
    quit,
    commands,
    search,
    scrollCtx,
    serviceCtx,
    scriptsCtx,
  );
  const serviceDisplays = useMemo(
    () => buildServiceDisplays(state.config, state.services),
    [state.config, state.services],
  );

  const stateRef = useRef(state);
  const handlersRef = useRef(handlers);
  stateRef.current = state;
  handlersRef.current = handlers;

  useInput((input, key) => {
    dispatchInput(input, key, stateRef.current, handlersRef.current);
  });

  useMouseSupport(state, handlersRef, store);

  const overlay = renderModeOverlay(state, store, serviceDisplays);
  if (overlay !== null) {
    return overlay;
  }

  return (
    <MainView state={state} serviceDisplays={serviceDisplays} serviceManager={serviceManager} />
  );
}

export function App({ config }: AppProps): React.ReactElement {
  const store = useMemo(() => createAppStore(config), [config]);

  return <AppContent store={store} config={config} />;
}
