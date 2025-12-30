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
│   └── app-store.ts   # App state, services, UI state
├── components/        # React/ink components
│   ├── layout.tsx     # Responsive grid layout
│   ├── space.tsx      # Service panel
│   ├── header.tsx     # Project header
│   ├── footer.tsx     # Status bar
│   ├── log-view.tsx   # Log display with highlighting
│   └── button.tsx     # Clickable button
├── hooks/             # React hooks
│   ├── use-commands.ts      # Command parsing/execution
│   ├── use-search.ts        # Search functionality
│   ├── use-service-manager.ts # Service lifecycle
│   └── use-process.ts       # Process spawning
├── services/          # Non-React services
│   └── process-manager.ts   # Child process management
└── utils/             # Utilities
    └── file-logger.ts # Log file persistence

tests/                 # Test files mirror src/ structure
example/
└── dpr.yaml          # Example configuration
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
- Services stored as `Record<string, ServiceRuntime>`
- UI state: mode, focusedSpaceIndex, commandInput, searchState

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
- Three modes: normal, command, search
- Input dispatched based on current mode
- Vim-style navigation (j/k/g/G) for scrolling

## Service States

```
STOPPED → WAITING → STARTING → READY
                 ↘           ↗
                  → CRASHED
                       ↓
READY → STOPPING → STOPPED
```

## Config Schema

```yaml
name: string          # Project name
columns: auto | 1-6   # Panel columns
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
- Component tests use ink-testing-library
- 60+ tests covering config, store, dependencies, utils

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
1. Add handler in `handleNormalModeInput` (src/app.tsx)
2. If complex, extract to helper function to stay under complexity limit
3. Update README keyboard shortcuts table
