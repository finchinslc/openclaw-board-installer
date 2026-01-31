# OpenClaw Board Installer

[![npm downloads](https://img.shields.io/npm/dm/openclaw-board-installer.svg)](https://www.npmjs.com/package/openclaw-board-installer)

A terminal UI installer for [OpenClaw Board](https://github.com/finchinslc/openclaw-board) — a kanban board for human-AI collaboration.

## Quick Start

```bash
npx openclaw-board-installer
```

This will:
1. Check prerequisites (Node.js, PostgreSQL)
2. Install PostgreSQL via Homebrew if needed (macOS)
3. Clone and configure the board
4. Install the `ocb` CLI globally
5. Set up auto-start on boot (optional)

## Managing the Board

After installation, use these commands:

```bash
npx openclaw-board-installer status   # Check if running
npx openclaw-board-installer start    # Start the board
npx openclaw-board-installer stop     # Stop the board
npx openclaw-board-installer restart  # Restart
npx openclaw-board-installer logs     # View recent logs
npx openclaw-board-installer open     # Open in browser
npx openclaw-board-installer update   # Pull latest & restart
```

## What Gets Installed

| Component | Location |
|-----------|----------|
| App | `~/openclaw-board` |
| CLI | `ocb` (globally linked) |
| Database | PostgreSQL (local) |
| Config | `~/openclaw-board/.env` |
| Logs | `~/openclaw-board/logs/` |
| Auto-start | `~/Library/LaunchAgents/com.openclaw.board.plist` |

## CLI

The installer sets up the `ocb` command globally:

```bash
ocb list              # List all tasks
ocb todo              # Show TODOs
ocb show OCB-42       # Task details
ocb create "Task"     # Create task
ocb start 42          # Start working
ocb done 42           # Mark complete
ocb pick              # Grab next TODO
ocb active            # Show current task
```

See [CLI documentation](https://github.com/finchinslc/openclaw-board/tree/main/cli) for all commands.

## Updating

```bash
npx openclaw-board-installer update
```

Or run the installer again — it detects existing installations and offers an update option.

## Uninstalling

```bash
# Stop the service
npx openclaw-board-installer stop

# Remove auto-start (macOS)
launchctl unload ~/Library/LaunchAgents/com.openclaw.board.plist
rm ~/Library/LaunchAgents/com.openclaw.board.plist

# Remove the app
rm -rf ~/openclaw-board

# Optionally remove the database
dropdb openclaw_board
```

## Requirements

- **Node.js** 18+
- **PostgreSQL** (installer can set this up on macOS)
- **macOS** or **Linux** (Windows not yet supported)

## License

MIT
