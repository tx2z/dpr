# CLAUDE.md - Project Context for Claude

## Project Overview

**dpr** (Dev Process Runner) is a terminal-based UI application for managing multiple development services simultaneously. Built with ink (React for CLI), TypeScript, and Zustand.

## Tech Stack

- **Runtime**: Node.js v20+
- **Language**: TypeScript (strict mode)
- **UI Framework**: ink 6.6.0 (React 19 for terminal)
- **State Management**: Zustand 5.0.9
- **Config Parsing**: js-yaml + Zod validation
- **Testing**: Vitest with ink-testing-library
- **Linting**: ESLint 9 flat config (strict rules)

## Project Structure

```
src/
├── index.tsx          # CLI entry point
├── app.tsx            # Main App component with input handling
├── config/            # Config loading, validation, dependencies
│   ├── types.ts       # TypeScript types
│   ├── schema.ts      # Zod schemas
│   ├── loader.ts      # YAML config loader
│   └── dependencies.ts # Dependency graph & topological sort
├── store/             # Zustand state management
│   └── app-store.ts   # App state, services, view/sidebar/selection state
├── components/        # React/ink components
│   ├── layout.tsx     # Responsive grid layout (grid view)
│   ├── space.tsx      # Service panel (grid cell)
│   ├── sidebar.tsx    # Service list for the sidebar view
│   ├── main-area.tsx  # Stacks up to 4 WindowPanes (sidebar view)
│   ├── window-pane.tsx # Single log window in the main area
│   ├── stream-view.tsx # Single service via <Static> (native scrollback copy)
│   ├── fullscreen-overlay.tsx # Single-service zoom with vim cursor
│   ├── header.tsx     # Project header
│   ├── footer.tsx     # Status bar / contextual key hints
│   ├── log-view.tsx   # Log display with search + selection highlighting
│   └── button.tsx     # Clickable button
├── hooks/             # React hooks
│   ├── use-commands.ts      # Command parsing/execution
│   ├── use-search.ts        # Search functionality
│   ├── use-service-manager.ts # Service lifecycle
│   ├── use-process.ts       # Process spawning
│   └── use-mouse.ts         # Mouse tracking (drag select + wheel, mode 1002)
├── services/          # Non-React services
│   └── process-manager.ts   # Child process management
└── utils/             # Utilities
    ├── file-logger.ts       # Log file persistence
    ├── focus-navigation.ts  # Focus cycling + clampListScroll
    ├── status.ts            # Service status label/glyph helpers
    └── window-hit-test.ts   # Map mouse (col,row) -> window log line

tests/                 # Test files mirror src/ structure
example/
├── dpr.yaml           # Example configuration
├── dpr-grid-4.yaml    # 4 services (grid view)
└── dpr-sidebar-8.yaml # 8 services (sidebar view)
```

## Key Commands

```bash
npm run build      # Compile TypeScript
npm run typecheck  # Type checking only
npm run lint       # ESLint
npm test           # Run Vitest tests
npm run dev        # Development mode with tsx
```

## Code Conventions

1. **No eslint-ignore**: All code must pass ESLint without disabling rules
2. **Strict TypeScript**: All strict options enabled, no `any` types
3. **Functional style**: Prefer pure functions, minimal side effects
4. **ink core only**: Use Box, Text, useInput, useApp - no ink-ui components
5. **Complexity limit**: Functions must have complexity ≤ 10
6. **Line limit**: Functions must be ≤ 50 lines

## Architecture Notes

### State Management
- Single Zustand store (`createAppStore`) holds all app state
- Services stored as `Record<string, ServiceRuntime>` (`{ state, logs, scrollOffset, fullscreenCursor, appendSeq }`)
- UI state: mode, focusedSpaceIndex, commandInput, searchState
- `viewMode: 'grid' | 'sidebar'` + `sidebarState` (`selectedIndex`, `openWindowIds` (max 4), `focusedWindowIndex`)
- `selection: { serviceId, anchorLine, headLine } | null` for in-app mouse drag selection
- `appendSeq` is a monotonic per-service line counter so the stream view detects new lines even after the 1000-line buffer trims
- `scrollOffset === Number.MAX_SAFE_INTEGER` is the "follow the tail" sentinel; `appendLog` only auto-scrolls when already following

### Views (grid vs sidebar)
- **Grid** (`MainView` + `Layout`): the default for ≤6 services; column grid of `Space` panels
- **Sidebar** (`SidebarView` + `Sidebar` + `MainArea`): service list on the left, up to 4 full-width stacked `WindowPane`s on the right
- `resolveViewMode(serviceCount, current)`: forces sidebar when serviceCount > `SIDEBAR_AUTO_THRESHOLD` (6); otherwise uses `viewMode`. `t` toggles when not forced. Used by both render and input dispatch so they agree.
- Layouts leave one row of headroom (never fill the terminal exactly) — a full-height ink frame triggers full-screen repaint flicker.

### Log selection & copy
- **Grid**: no mouse capture, so the terminal's native selection works; copy with the terminal (e.g. Cmd+C)
- **Sidebar**: `use-mouse` captures drag (SGR mode 1002); `window-hit-test` maps coords to a log line; dragging selects lines, release copies via OSC 52 (`utils/clipboard.ts`)
- **Stream view** (`v`): renders one service's logs through ink `<Static>` into native scrollback for stable, character-precise selection
- `y` / `Y` copy visible / full buffer via OSC 52 with no mouse

### Process Management
- `ProcessManager` uses EventEmitter pattern for status/log events
- Ready detection via regex `readyPattern` or timeout delay
- Graceful shutdown: SIGINT → wait → SIGTERM → wait → SIGKILL

### Dependency Resolution
- Services can declare `dependsOn` other services
- Circular dependencies detected via DFS
- Start order determined by topological sort
- Services wait in WAITING state until dependencies are READY

### Input Handling
- Modes (`AppMode`): normal, command, search, help, fullscreen, stream, scripts, scriptOutput, scriptHistory
- `dispatchInput` routes per mode (`dispatchEditModes` / `dispatchViewModes`); in `normal` it branches grid vs sidebar via `resolveViewMode`
- Vim-style navigation (j/k/g/G) for scrolling; sidebar uses j/k for list selection and `[` `]` for window scroll
- View-aware target resolvers: `resolveActionServiceId` (service actions → selected/focused) and `resolveScrollServiceId` (scroll/copy → focused window)

## Service States

```
STOPPED → WAITING → STARTING → READY
                 ↘           ↗
                  → CRASHED
                       ↓
READY → STOPPING → STOPPED
```

## Config Schema

# Up to MAX_SERVICES (20) services. With >6 the sidebar view is forced and
# `columns` is ignored. `columns` is capped at MAX_COLUMNS (6).
```yaml
name: string          # Project name
columns: auto | 1-6   # Panel columns (grid view only)
logs: boolean         # Enable file logging
logsDir: string       # Log directory path

services:
  - id: string        # Unique identifier (required)
    name: string      # Display name
    start: string     # Start command (required)
    stop: string      # Graceful stop command
    dir: string       # Working directory
    autostart: boolean
    color: green|blue|yellow|magenta|cyan|red
    dependsOn: string[]
    readyPattern: string  # Regex for ready detection
    readyDelay: number    # ms to wait before ready
    env: Record<string, string>
    logs: boolean     # Per-service log override
    runOnce: boolean  # For commands that start bg services and exit (e.g. supabase start)
```

## Testing

- Tests in `tests/` directory, mirroring `src/` structure
- Use `describe`/`it` from Vitest
- Component tests use ink-testing-library; `tests/app.smoke.test.tsx` renders the App in both views
- Pure geometry/logic helpers are unit-tested directly (`window-hit-test`, `computeWindowRows`, `clampListScroll`, sidebar store actions)
- 150+ tests covering config, store, dependencies, utils, components

## Common Tasks

### Adding a new command
1. Add command creator function in `src/hooks/use-commands.ts`
2. Add to `createAllCommands` array
3. Add tests in `tests/hooks/use-commands.test.ts`

### Adding a new service state
1. Update `ServiceStatus` type in `src/config/types.ts`
2. Update ProcessManager state transitions
3. Update Space component to handle new state
4. Update tests

### Adding keyboard shortcut
1. Add a handler to `KeyHandlers` and the relevant factory in `src/app.tsx`
2. Wire the key in `handleNormalModeInput` (grid) and/or `handleSidebarNormalInput` (sidebar)
3. If complex, extract to a helper to stay under the complexity limit
4. Update the footer hints (`src/components/footer.tsx`), help overlay, and README

### Adding a new view/overlay mode
1. Add the mode to `AppMode` (src/store/app-store.ts)
2. Handle its input in `dispatchEditModes`/`dispatchViewModes` (src/app.tsx)
3. Render it in `renderModeOverlay` / `renderAppBody`
