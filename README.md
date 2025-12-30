# dpr (Dev Process Runner)

[![npm version](https://img.shields.io/npm/v/@tx2z/dev-process-runner)](https://www.npmjs.com/package/@tx2z/dev-process-runner)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Stop juggling terminal tabs.** dpr is a terminal UI that lets you manage all your development services in one place — start, stop, monitor logs, and handle dependencies with ease.

![dpr demo](https://raw.githubusercontent.com/tx2z/dpr/main/docs/demo.gif)

## Features

- **Multi-service management** — Run and monitor multiple services in a single terminal
- **Smart dependencies** — Services wait for their dependencies to be ready before starting
- **Real-time logs** — View logs with search, scroll, and fullscreen mode
- **Vim-style navigation** — Keyboard-first design with mouse support
- **Flexible configuration** — YAML config with auto-start, colors, and custom commands
- **Log persistence** — Optionally save logs to files for debugging

## Installation

### Homebrew (macOS/Linux)

```bash
brew install tx2z/tap/dev-process-runner
```

### npm (requires Node.js 20+)

```bash
npm install -g @tx2z/dev-process-runner
```

### Direct Download

Download the latest binary for your platform from [GitHub Releases](https://github.com/tx2z/dpr/releases):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `dpr-macos-arm64` |
| macOS (Intel) | `dpr-macos-x64` |
| Linux (x64) | `dpr-linux-x64` |
| Linux (ARM64) | `dpr-linux-arm64` |
| Windows (x64) | `dpr-win-x64.exe` |

After downloading, make it executable and move to your PATH:

```bash
chmod +x dpr-macos-arm64
sudo mv dpr-macos-arm64 /usr/local/bin/dpr
```

> **Note:** Windows support is experimental. Process management and terminal rendering may have issues on Windows.

## Usage

```bash
# Run with default config (./dpr.yaml)
dpr

# Run with custom config
dpr --config path/to/config.yaml

# Validate config without running
dpr --validate

# Show help
dpr --help
```

## Configuration

Create a `dpr.yaml` file in your project root:

```yaml
name: "My Project"
columns: auto  # or 1, 2, 3
logs: true     # enable log persistence
logsDir: ~/.dpr/logs

services:
  - id: api
    name: "API Server"
    dir: ./api
    start: npm run dev
    stop: npm run stop  # optional graceful stop command
    autostart: true
    color: green
    readyPattern: "listening on port"
    dependsOn: []

  - id: web
    name: "Web Frontend"
    dir: ./web
    start: npm run dev
    autostart: true
    color: blue
    dependsOn:
      - api
```

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | null | Project name displayed in header |
| `columns` | number \| "auto" | "auto" | Number of columns for service panels |
| `logs` | boolean | false | Enable log persistence for all services |
| `logsDir` | string | "~/.dpr/logs" | Directory for log files |

### Service Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | string | (required) | Unique service identifier |
| `name` | string | id | Display name for the service |
| `dir` | string | "." | Working directory |
| `start` | string | (required) | Start command |
| `stop` | string | null | Graceful stop command |
| `autostart` | boolean | false | Start automatically on launch |
| `color` | string | (auto) | Panel border color |
| `logs` | boolean | global.logs | Enable log persistence |
| `env` | object | {} | Environment variables |
| `dependsOn` | string[] | [] | Service dependencies |
| `readyPattern` | string | null | Regex pattern to detect ready state |
| `readyDelay` | number | 500 | Delay after first output before ready |
| `runOnce` | boolean | false | For commands that start background services and exit (e.g., `supabase start`, `docker-compose up -d`) |

### Colors

Available colors: `green`, `blue`, `yellow`, `magenta`, `cyan`, `red`

## Keyboard Shortcuts

### Normal Mode

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit application |
| `/` | Enter command mode |
| `?` | Show help |
| `f` | Enter search mode |
| `1-9` | Focus service panel by number |
| `Tab` / `Shift+Tab` | Cycle through panels |

### Focused Panel (View Mode)

When a panel is focused (highlighted border):

| Key | Action |
|-----|--------|
| `Enter` | Enter action mode |
| `Escape` | Unfocus panel |
| `j` / `Down Arrow` | Scroll logs down |
| `k` / `Up Arrow` | Scroll logs up |
| `g` | Scroll to top |
| `G` | Scroll to bottom |

### Action Mode

When in action mode (green double border):

| Key | Action |
|-----|--------|
| `s` | Start service |
| `x` | Stop service (graceful) |
| `K` | Kill service (force) |
| `Escape` | Exit action mode |

> **Note:** Action mode requires explicit activation with `Enter` to prevent accidental service stops.

### Command Mode

| Key | Action |
|-----|--------|
| `Enter` | Execute command |
| `Escape` | Cancel command |
| `Backspace` | Delete character |

### Search Mode

| Key | Action |
|-----|--------|
| `Tab` / `Down Arrow` | Next match |
| `Shift+Tab` / `Up Arrow` | Previous match |
| `Enter` | Confirm search |
| `Escape` | Cancel search |

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `/start <service>` | `/s` | Start a service |
| `/stop <service>` | `/x` | Stop a service gracefully |
| `/kill <service>` | `/k` | Force kill a service |
| `/restart <service>` | `/r` | Restart a service |
| `/start-all` | `/sa` | Start all services |
| `/stop-all` | `/xa` | Stop all services |
| `/clear <service>` | `/c` | Clear service logs |
| `/focus <service>` | `/f` | Focus service panel |
| `/quit` | `/q` | Stop all and exit |
| `/help` | `/h`, `/?` | Show help |

Services can be referenced by number (1-6), ID, or name.

## Service States

| State | Description |
|-------|-------------|
| STOPPED | Service is not running |
| WAITING | Waiting for dependencies to become ready |
| STARTING | Service process has started |
| READY | Service is ready (matched readyPattern or delay elapsed) |
| STOPPING | Service is being stopped |
| CRASHED | Service exited unexpectedly |

## Dependencies

Services can depend on other services using `dependsOn`. A service will wait until all its dependencies are in the READY state before starting.

Circular dependencies are detected and will cause validation to fail.

## Log Persistence

When `logs: true` is set (globally or per-service), logs are written to files in the configured `logsDir`. Each service gets its own log file named `<service-id>.log`.

Log format:
```
[2024-01-15T10:30:00.000Z] Server started on port 3000
[2024-01-15T10:30:01.000Z] [ERR] Warning: deprecated API used
```

## Development

```bash
# Clone and install
git clone https://github.com/tx2z/dpr.git
cd dpr
npm install

# Run in development mode
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test

# Build
npm run build

# Run built version
node dist/index.js
```

## Disclaimer

This project was created using [Claude Code](https://claude.com/code) and AI tools. I am not a TypeScript expert, and most of the code was generated by AI. Bugs, errors, and unexpected behavior are likely. Contributions, bug reports, and PRs are welcome! If you are sensitive to AI-generated code, please use with caution.

## License

MIT
