import { useEffect } from 'react';

import type { AppStoreApi, SearchMatch } from '../store/index.js';

export interface UseSearchResult {
  readonly updateSearchTerm: (term: string) => void;
  readonly nextMatch: () => void;
  readonly prevMatch: () => void;
  readonly clearSearch: () => void;
}

function findMatchesInLine(
  content: string,
  term: string,
  serviceId: string,
  lineIndex: number,
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let startIndex = 0;
  let foundIndex = lowerContent.indexOf(lowerTerm, startIndex);

  while (foundIndex !== -1) {
    matches.push({
      serviceId,
      lineIndex,
      startCol: foundIndex,
      endCol: foundIndex + term.length,
    });
    startIndex = foundIndex + 1;
    foundIndex = lowerContent.indexOf(lowerTerm, startIndex);
  }

  return matches;
}

function findMatches(
  term: string,
  store: AppStoreApi,
  serviceFilter: string | null,
): readonly SearchMatch[] {
  if (term.length === 0) {
    return [];
  }

  const matches: SearchMatch[] = [];
  const state = store.getState();

  for (const [serviceId, runtime] of Object.entries(state.services)) {
    if (serviceFilter !== null && serviceId !== serviceFilter) {
      continue;
    }

    runtime.logs.forEach((log, lineIndex) => {
      const lineMatches = findMatchesInLine(log.content, term, serviceId, lineIndex);
      matches.push(...lineMatches);
    });
  }

  return matches;
}

function parseSearchInput(input: string): { term: string; serviceFilter: string | null } {
  const filterMatch = /^(\d+)\s+(.*)$/.exec(input);
  if (filterMatch !== null) {
    return {
      term: filterMatch[2] ?? '',
      serviceFilter: filterMatch[1] ?? null,
    };
  }
  return { term: input, serviceFilter: null };
}

function scrollToMatch(store: AppStoreApi, match: SearchMatch | undefined): void {
  if (match === undefined) {
    return;
  }

  const state = store.getState();
  const runtime = state.services[match.serviceId];
  if (runtime === undefined) {
    return;
  }

  const visibleHeight = 10;
  const targetLine = match.lineIndex;
  const currentOffset = runtime.scrollOffset;

  if (targetLine < currentOffset || targetLine >= currentOffset + visibleHeight) {
    const newOffset = Math.max(0, targetLine - Math.floor(visibleHeight / 2));
    store.getState().setScrollOffset(match.serviceId, newOffset);
  }
}

function navigateMatch(store: AppStoreApi, direction: 1 | -1): void {
  const current = store.getState().searchState;
  if (current === null || current.matches.length === 0) {
    return;
  }
  const newIndex =
    (current.currentMatchIndex + direction + current.matches.length) % current.matches.length;
  store.getState().setSearchState({ ...current, currentMatchIndex: newIndex });
  scrollToMatch(store, current.matches[newIndex]);
}

function createSearchCallbacks(store: AppStoreApi): UseSearchResult {
  return {
    updateSearchTerm: (input: string): void => {
      const { term, serviceFilter } = parseSearchInput(input);
      const matches = findMatches(term, store, serviceFilter);
      store.getState().setSearchState({ term, serviceFilter, matches, currentMatchIndex: 0 });
    },
    nextMatch: (): void => {
      navigateMatch(store, 1);
    },
    prevMatch: (): void => {
      navigateMatch(store, -1);
    },
    clearSearch: (): void => {
      store.getState().setSearchState(null);
    },
  };
}

function useSyncSearchMatches(store: AppStoreApi): void {
  const searchState = store.getState().searchState;

  useEffect(() => {
    if (searchState === null) {
      return;
    }
    const matches = findMatches(searchState.term, store, searchState.serviceFilter);
    const currentIndex = Math.min(searchState.currentMatchIndex, Math.max(0, matches.length - 1));
    const needsUpdate =
      matches.length !== searchState.matches.length ||
      currentIndex !== searchState.currentMatchIndex;
    if (needsUpdate) {
      store.getState().setSearchState({ ...searchState, matches, currentMatchIndex: currentIndex });
    }
  }, [searchState, store]);
}

export function useSearch(store: AppStoreApi): UseSearchResult {
  useSyncSearchMatches(store);
  return createSearchCallbacks(store);
}
