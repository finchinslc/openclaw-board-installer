# OpenClaw Board Installer

A terminal UI installer for [OpenClaw Board](https://github.com/finchinslc/openclaw-board).

## Prerequisites

- **Node.js** (v18+) with npm
- **OpenClaw** installed (`npm install -g openclaw`)
- **Homebrew** (macOS, for PostgreSQL installation)

## Quick Install

```bash
npx openclaw-board-installer
```

Or install globally:

```bash
npm install -g openclaw-board-installer
openclaw-board
```

## What it does

1. **Checks prerequisites** — Node.js, OpenClaw, Homebrew
2. **Installs PostgreSQL** via Homebrew (if not present)
3. **Creates database** for OpenClaw Board
4. **Clones and configures** the board
5. **Sets up auto-start** via launchd (optional)

## Configuration

The installer prompts for:

- **Installation directory** (default: `~/openclaw-board`)
- **Port** (default: 3000)
- **Auto-start on boot** (macOS only)

## Manual Setup

If you prefer manual installation:

```bash
# Install PostgreSQL
brew install postgresql@17
brew services start postgresql@17

# Clone the repo
git clone https://github.com/finchinslc/openclaw-board.git
cd openclaw-board

# Install dependencies
npm install

# Configure
echo 'DATABASE_URL="postgresql://$(whoami)@localhost:5432/openclaw_board?schema=public"' > .env

# Setup database
createdb openclaw_board
npx prisma generate
npx prisma db push

# Run
npm run dev
```

## License

MIT
