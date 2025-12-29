# dpr — Dev Process Runner

A lightweight TUI tool to manage multiple development services simultaneously.

## Overview

`dpr` is a Node.js CLI application that allows developers to start, monitor, and control multiple services from a single terminal interface. It displays 2-6 configurable command outputs in a grid layout, with mouse and keyboard support.

## Tech Stack

- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (strict mode)
- **TUI Framework:** `ink` (React for CLI) + `ink-ui` components
- **Process Management:** Native `child_process.spawn`
- **Config Parsing:** `yaml` (js-yaml)

## Configuration

### File Location

The tool looks for configuration in this order:
1. `./dpr.yaml` (current directory)
2. `./dpr.config.yaml`
3. `~/.config/dpr/config.yaml`

Can be overridden with `--config` flag.

### Config Format (YAML)

```yaml
# dpr.yaml
name: "Pilgrimz Dev" # Optional - shown in header

# Global settings
columns: auto        # Optional - grid columns: 1, 2, 3, ... or "auto" (default: "auto")
logs: false          # Optional - enable log persistence for all services (default: false)
logsDir: ./logs      # Optional - directory for log files (default: ~/.dpr/logs)

services:
  - id: supabase
    name: "Supabase Local"
    dir: ./supabase # Optional - working directory (relative to config file or absolute)
    start: "npx supabase start"
    stop: "npx supabase stop" # Optional - if not provided, uses SIGINT (Ctrl+C)
    autostart: true
    color: "green" # Optional - accent color for this space (green, blue, yellow, magenta, cyan, red)
    logs: true # Optional - override global logs setting for this service
    env: # Optional - environment variables for this service
      SUPABASE_DEBUG: "true"

  - id: api
    name: "Express API"
    dir: ./pilgrimz-express
    start: "docker-compose up"
    stop: "docker-compose down"
    autostart: true
    color: "blue"
    dependsOn: [supabase] # Optional - wait for these services before starting
    readyPattern: "Listening on port" # Optional - regex pattern to detect "ready" state
    readyDelay: 1000 # Optional - extra ms to wait after readyPattern match (default: 500)
    env:
      NODE_ENV: development
      DATABASE_URL: "postgresql://localhost:54322/postgres"

  - id: expo
    name: "Expo Mobile"
    dir: ./pilgrimz-expo
    start: "npm run start"
    autostart: false # Manual start
    color: "magenta"
    dependsOn: [api]
    env:
      EXPO_PUBLIC_API_URL: "http://localhost:3000"

  - id: creator
    name: "Creator Backoffice"
    dir: ./pilgrimz-creator
    start: "npm run dev"
    autostart: false
    color: "cyan"
    dependsOn: [api]
```

### Config Validation

- Minimum 2 services, maximum 6
- Each service must have: `id` (unique), `start` command
- `name` defaults to `id` if not provided
- `autostart` defaults to `false`
- `color` defaults to auto-assigned from palette
- `columns` must be a positive integer or `"auto"` (default: `"auto"`)
- `logs` defaults to global `logs` setting (which defaults to `false`)
- `dependsOn` must reference valid service IDs (no circular dependencies)
- `readyDelay` defaults to `500` ms
- `env` keys must be valid environment variable names

### Global Configuration Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | - | Project name shown in header |
| `columns` | number \| "auto" | `"auto"` | Grid columns (1-6 or "auto") |
| `logs` | boolean | `false` | Enable log persistence globally |
| `logsDir` | string | `~/.dpr/logs` | Directory for log files |

### Service Configuration Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | **required** | Unique identifier for the service |
| `name` | string | `id` | Display name shown in UI |
| `dir` | string | config file dir | Working directory for the command |
| `start` | string | **required** | Command to start the service |
| `stop` | string | - | Command to stop gracefully (otherwise SIGINT) |
| `autostart` | boolean | `false` | Start automatically when dpr launches |
| `color` | string | auto | Accent color: green, blue, yellow, magenta, cyan, red |
| `env` | object | `{}` | Environment variables (merged with system env) |
| `logs` | boolean | global setting | Persist logs to file |
| `dependsOn` | string[] | `[]` | Service IDs that must be ready first |
| `readyPattern` | string | - | Regex pattern indicating service is ready |
| `readyDelay` | number | `500` | Extra ms to wait after ready detection |

## TUI Layout

### Grid Columns

The `columns` setting controls how services are arranged:

| Value | Behavior |
|-------|----------|
| `1` | Single column, all services stacked vertically |
| `2` | Two columns (default for terminals < 120 chars) |
| `3` | Three columns (default for terminals ≥ 120 chars) |
| `4`, `5`, `6` | More columns (up to number of services) |
| `"auto"` | Adapts based on terminal width (default) |

**Auto behavior:**
- Terminal width < 80: 1 column
- Terminal width 80-119: 2 columns  
- Terminal width ≥ 120: 3 columns

### Grid Layout Examples

**2 columns (default for narrow terminals):**
```
2 services:     3 services:     4 services:     5 services:     6 services:
┌─────┬─────┐   ┌─────┬─────┐   ┌─────┬─────┐   ┌─────┬─────┐   ┌─────┬─────┐
│  1  │  2  │   │  1  │  2  │   │  1  │  2  │   │  1  │  2  │   │  1  │  2  │
│     │     │   ├─────┴─────┤   ├─────┼─────┤   ├─────┼─────┤   ├─────┼─────┤
└─────┴─────┘   │     3     │   │  3  │  4  │   │  3  │  4  │   │  3  │  4  │
                └───────────┘   └─────┴─────┘   ├─────┴─────┤   ├─────┼─────┤
                                                │     5     │   │  5  │  6  │
                                                └───────────┘   └─────┴─────┘
```

**3 columns (default for wide terminals):**
```
3 services:     4 services:     5 services:     6 services:
┌───┬───┬───┐   ┌───┬───┬───┐   ┌───┬───┬───┐   ┌───┬───┬───┐
│ 1 │ 2 │ 3 │   │ 1 │ 2 │ 3 │   │ 1 │ 2 │ 3 │   │ 1 │ 2 │ 3 │
│   │   │   │   ├───┴───┴───┤   ├───┼───┴───┤   ├───┼───┼───┤
└───┴───┴───┘   │     4     │   │ 4 │   5   │   │ 4 │ 5 │ 6 │
                └───────────┘   └───┴───────┘   └───┴───┴───┘
```

**1 column (vertical stack):**
```
┌───────────┐
│     1     │
├───────────┤
│     2     │
├───────────┤
│     3     │
├───────────┤
│    ...    │
└───────────┘
```

### Layout Rules

1. Services fill left-to-right, top-to-bottom
2. Last row spaces span remaining columns if uneven (e.g., 5 services in 3 columns → service 5 spans 2 columns)
3. Columns setting is capped at number of services (e.g., `columns: 3` with 2 services → 2 columns)
4. Minimum 1 column, no maximum (but practical limit is ~6)

### Space Component (Single Service Panel)

Each space displays one service and has multiple states:

#### State: Stopped
```
┌─ 1: Supabase Local ─────────────────────────┐
│                                             │
│                                             │
│              Supabase Local                 │
│                                             │
│              [ ▶ Start ]                    │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

#### State: Waiting (for dependencies)
```
┌─ 2: Express API ──────────────── ⏳ Waiting ─┐
│                                              │
│                                              │
│              Waiting for: supabase           │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

#### State: Running
```
┌─ 1: Supabase Local ──────── [■ Stop] [✕ Kill]┐
│ Starting Supabase...                         │
│ Supabase started successfully                │
│ API URL: http://localhost:54321              │
│ DB URL: postgresql://localhost:54322         │
│ Studio URL: http://localhost:54323           │
│ > Ready in 3.2s                              │
│                                              │
│ █                                            │ <- cursor/latest line indicator
└──────────────────────────────────────────────┘
```

#### State: Crashed
```
┌─ 2: Express API ─────────── 💥 CRASHED (exit 1)┐
│ Starting server...                             │
│ Error: ECONNREFUSED connecting to database     │
│ at Connection.connect (/app/node_modules/...)  │
│                                                │
│ ─────────────────────────────────────────────  │
│ Process exited with code 1                     │
│                                                │
│              [ ▶ Restart ]                     │
└────────────────────────────────────────────────┘
```

The crashed state features:
- Red border around the space
- Exit code displayed in header: `💥 CRASHED (exit <code>)`
- Last error output preserved in log view
- "Restart" button instead of "Start"

### Header Bar

```
┌─ Pilgrimz Dev ──────────────────── [▶ Start All] [■ Stop All] [Q Quit] ─┐
```

### Footer / Status Bar

```
└─ Press / for commands • ? to search • Tab to navigate ──────────────────┘
```

## Interaction

### Mouse Support

- **Click on space:** Focus that space (highlighted border)
- **Click [▶ Start]:** Start the service
- **Click [■ Stop]:** Stop the service gracefully
- **Click [✕ Kill]:** Force kill the service (SIGKILL)
- **Click global buttons:** Start All, Stop All, Quit
- **Scroll within space:** Scroll through logs (when focused)

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Navigate between spaces and buttons |
| `1-6` | Focus space by number |
| `Enter` / `Space` | Activate focused button |
| `↑` / `↓` | Scroll logs in focused space |
| `Home` / `End` | Jump to start/end of logs |
| `/` | Open command palette |
| `?` | Open search mode |
| `q` / `Ctrl+C` | Quit (stops all services first) |

### Command Palette

Pressing `/` opens a command input at the bottom:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ / _                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Available Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `/start <n>` | `/s <n>`, `/<n>s` | Start service in space n |
| `/stop <n>` | `/x <n>`, `/<n>x` | Stop service in space n |
| `/kill <n>` | `/k <n>`, `/<n>k` | Force kill service in space n |
| `/restart <n>` | `/r <n>`, `/<n>r` | Restart service in space n |
| `/start-all` | `/sa` | Start all services (respects dependencies) |
| `/stop-all` | `/xa` | Stop all services |
| `/quit` | `/q` | Stop all and exit |
| `/focus <n>` | `/f <n>`, `/<n>` | Focus space n |
| `/clear <n>` | `/c <n>`, `/<n>c` | Clear logs in space n |
| `/help` | `/h` | Show help overlay |

Command palette supports:
- **Autocomplete:** Shows suggestions as you type
- **Enter:** Execute command
- **Escape:** Close palette without executing
- **Up/Down:** Navigate suggestions

### Search Mode

Pressing `?` opens search input at the bottom:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ? error_                                                  [3 matches]   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Search Syntax

| Input | Description |
|-------|-------------|
| `?<term>` | Search for `<term>` in all spaces |
| `?<n> <term>` | Search for `<term>` only in space n |

Examples:
- `?error` — Find "error" in all spaces
- `?2 listening` — Find "listening" only in space 2
- `?connection refused` — Find phrase in all spaces

#### Search Behavior

1. **Live search:** Results update as you type (debounced 150ms)
2. **Highlighting:** 
   - All matches get `bgYellow` background
   - Current match gets `bgCyan` background
3. **Navigation:**
   - `↑` / `↓` or `n` / `N` — Jump to next/previous match
   - Auto-scrolls the relevant space to show the match
   - Match counter shows: `[3/12 matches]` (current/total)
4. **Exit search:**
   - `Enter` — Exit search, keep view at current match
   - `Escape` — Exit search, return to previous view, clear highlights

#### Search State

```typescript
interface SearchState {
  term: string;
  spaceFilter: number | null; // null = all spaces
  matches: Array<{
    spaceIndex: number;
    lineIndex: number;
    startCol: number;
    endCol: number;
  }>;
  currentMatchIndex: number;
}
```

## Process Management

### Starting a Service

1. Check if dependencies are satisfied (all `dependsOn` services are in READY state)
2. If dependencies not ready, set state to WAITING
3. Spawn child process with `start` command
4. Set working directory to `dir` (if specified)
5. Merge `env` config with system environment variables
6. Stream `stdout` and `stderr` to the space's log buffer
7. If `logs` enabled, also write to log file
8. Update space state to STARTING
9. Watch for ready condition:
   - If `readyPattern` defined: wait for matching output + `readyDelay`
   - Otherwise: wait for first output + `readyDelay`
10. Update state to READY (allows dependent services to start)

### Stopping a Service

1. If `stop` command is defined:
   - Execute `stop` command
   - Wait up to 10 seconds for original process to exit
   - If still running, send SIGTERM
2. If no `stop` command:
   - Send SIGINT to process
   - Wait 5 seconds
   - Send SIGTERM if still running
   - Wait 3 seconds
   - Send SIGKILL if still running

### Killing a Service

1. Send SIGKILL immediately
2. Update state to STOPPED

### Log Buffer

- Each service maintains a circular buffer of last 1000 lines
- Lines are timestamped internally (optional display)
- Buffer persists across start/stop cycles (cleared only with `/clear`)

### Log Persistence

When `logs: true` (global or per-service):

- Log file location: `<logsDir>/<service-id>.log`
- Default logsDir: `~/.dpr/logs/`
- Format: `[ISO-TIMESTAMP] <line>`
- Files are appended, not overwritten
- Rotation: not implemented in v1 (user can clear manually)

Example log output:
```
[2025-01-15T10:30:45.123Z] Starting Supabase...
[2025-01-15T10:30:46.456Z] Supabase started successfully
[2025-01-15T10:30:46.789Z] API URL: http://localhost:54321
```

## Service States

```
                              ┌──────────────────────────────────┐
                              │                                  │
                              ▼                                  │
┌─────────┐  start   ┌─────────────┐  deps ready  ┌──────────┐   │
│ STOPPED │ ───────► │   WAITING   │ ───────────► │ STARTING │   │
└─────────┘          └─────────────┘              └────┬─────┘   │
     ▲                      │                          │         │
     │                      │ deps failed              │ ready   │
     │                      │ (crash/stop)             ▼         │
     │                      │                    ┌─────────┐     │
     │                      └──────────────────► │  READY  │     │
     │                                           └────┬────┘     │
     │                                                │          │
     │    ┌──────────┐      stop/exit                │          │
     │◄───│ STOPPING │◄──────────────────────────────┘          │
     │    └──────────┘                                           │
     │                                                           │
     │    ┌──────────┐      crash (exit != 0)                   │
     └────│ CRASHED  │◄──────────────────────────────────────────┘
          └──────────┘
```

States:
- **STOPPED:** Not running, shows start button
- **WAITING:** Waiting for dependencies to be ready
- **STARTING:** Process spawned, waiting for ready condition
- **READY:** Process running and ready (dependencies can proceed)
- **STOPPING:** Graceful shutdown in progress
- **CRASHED:** Process exited with non-zero code

## Dependencies

### Dependency Resolution

When starting services with dependencies:

1. Build dependency graph from `dependsOn` configuration
2. Detect circular dependencies → error and refuse to start
3. Topologically sort services
4. Start services in order, waiting for each to reach READY state

### Ready Detection

A service is considered READY when:

1. **If `readyPattern` is defined:**
   - Output matches the regex pattern
   - Then wait additional `readyDelay` ms (default 500)
   
2. **If no `readyPattern`:**
   - First stdout/stderr output received
   - Then wait `readyDelay` ms (default 500)

### Dependency Failure

If a dependency crashes or is stopped:
- Dependent services in WAITING state return to STOPPED
- Running dependent services continue (they're already started)
- User is notified via log message in affected spaces

## Error Handling

### Process Crashes

When a process exits with non-zero code:
- State changes to CRASHED
- Space header shows: `💥 CRASHED (exit <code>)`
- Border color changes to red
- Log buffer preserved for debugging
- "Restart" button shown instead of "Start"
- If other services depend on this, they're notified

### Config Errors

- Invalid YAML: Show error message and exit
- Missing required fields: Show specific validation error
- Invalid service count: Show error with valid range
- Circular dependencies: List the cycle and exit
- Invalid `dependsOn` reference: Show which ID is invalid

### Permission Errors

- If `dir` doesn't exist or isn't accessible: Show error in space
- If command not found: Show error in space
- If log directory not writable: Warn and disable logging for that service

## CLI Usage

```bash
# Run with default config (./dpr.yaml)
dpr

# Run with specific config
dpr --config /path/to/config.yaml
dpr -c ./my-project.yaml

# Validate config without starting
dpr --validate
dpr -v

# Show help
dpr --help
dpr -h

# Show version
dpr --version
```

## File Structure

```
dpr/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx           # Entry point, CLI argument parsing
│   ├── app.tsx             # Main App component
│   ├── config/
│   │   ├── loader.ts       # Config file discovery and loading
│   │   ├── validator.ts    # Schema validation
│   │   ├── dependencies.ts # Dependency graph & topological sort
│   │   └── types.ts        # TypeScript interfaces
│   ├── components/
│   │   ├── Layout.tsx      # Grid layout manager
│   │   ├── Space.tsx       # Individual service panel
│   │   ├── Header.tsx      # Top bar with global controls
│   │   ├── Footer.tsx      # Status bar
│   │   ├── CommandPalette.tsx
│   │   ├── SearchBar.tsx   # Search input component
│   │   ├── Button.tsx      # Reusable button component
│   │   └── LogView.tsx     # Scrollable log display with highlighting
│   ├── hooks/
│   │   ├── useProcess.ts   # Process spawn/kill logic
│   │   ├── useKeyboard.ts  # Keyboard event handling
│   │   ├── useCommands.ts  # Command palette logic
│   │   └── useSearch.ts    # Search state and logic
│   └── utils/
│       ├── process.ts      # Process management utilities
│       ├── logger.ts       # Internal logging
│       └── file-logger.ts  # Log persistence to file
├── example/
│   └── dpr.yaml            # Example configuration
└── README.md
```

## Example Pilgrimz Configuration

```yaml
# /Users/47221295h/dev/pilgrimz/dpr.yaml
name: "Pilgrimz Dev Environment"

columns: 2      # 2 columns layout (or use "auto")
logs: true
logsDir: ./logs

services:
  - id: supabase
    name: "🗄️ Supabase"
    dir: ./supabase
    start: "npx supabase start"
    stop: "npx supabase stop"
    autostart: true
    color: "green"
    readyPattern: "API URL:"
    env:
      SUPABASE_DEBUG: "false"

  - id: api
    name: "⚡ Express API"
    dir: ./pilgrimz-express
    start: "docker-compose up"
    stop: "docker-compose down"
    autostart: true
    color: "blue"
    dependsOn: [supabase]
    readyPattern: "Listening on port"
    env:
      NODE_ENV: development
      DATABASE_URL: "postgresql://localhost:54322/postgres"

  - id: expo
    name: "📱 Expo App"
    dir: ./pilgrimz-expo
    start: "npm start"
    autostart: false
    color: "magenta"
    dependsOn: [api]
    env:
      EXPO_PUBLIC_API_URL: "http://localhost:3000"

  - id: creator
    name: "🎨 Creator Studio"
    dir: ./pilgrimz-creator
    start: "npm run dev"
    autostart: false
    color: "cyan"
    dependsOn: [api]
    env:
      NEXT_PUBLIC_API_URL: "http://localhost:3000"
```

## Future Enhancements (Out of Scope for v1)

- [ ] Health checks / readiness probes (HTTP endpoint polling)
- [ ] Multiple layouts (horizontal, vertical, single-focus zoom)
- [ ] Service groups (start/stop groups together)
- [ ] Log rotation and max file size
- [ ] Export logs to different formats (JSON, etc.)
- [ ] Custom themes / color schemes
- [ ] Plugin system for custom commands
