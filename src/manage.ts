import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import pc from 'picocolors'

const INSTALL_DIR = join(homedir(), 'openclaw-board')
const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', 'com.openclaw.board.plist')
const SERVICE_NAME = 'com.openclaw.board'

function getPort(): number {
  try {
    const envPath = join(INSTALL_DIR, '.env')
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/PORT=(\d+)/)
    return match ? parseInt(match[1], 10) : 3000
  } catch {
    return 3000
  }
}

function isInstalled(): boolean {
  return existsSync(INSTALL_DIR) && existsSync(join(INSTALL_DIR, '.env'))
}

function hasLaunchAgent(): boolean {
  return existsSync(PLIST_PATH)
}

function isRunning(): boolean {
  try {
    const port = getPort()
    execSync(`curl -s --connect-timeout 2 http://localhost:${port}/api/tasks > /dev/null`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getLaunchdStatus(): 'running' | 'stopped' | 'not-loaded' {
  if (!hasLaunchAgent()) return 'not-loaded'
  try {
    const output = execSync(`launchctl list | grep ${SERVICE_NAME}`, { encoding: 'utf-8' })
    return output.includes(SERVICE_NAME) ? 'running' : 'stopped'
  } catch {
    return 'stopped'
  }
}

function printHelp(): void {
  console.log(`
${pc.cyan(pc.bold('OpenClaw Board'))} — Task management for humans and AI

${pc.bold('Usage:')}
  openclaw-board [command]

${pc.bold('Commands:')}
  ${pc.cyan('install')}    Run the installer (default if no command)
  ${pc.cyan('start')}      Start the board
  ${pc.cyan('stop')}       Stop the board
  ${pc.cyan('restart')}    Restart the board
  ${pc.cyan('status')}     Show current status
  ${pc.cyan('logs')}       Show recent logs (macOS only)
  ${pc.cyan('open')}       Open the board in your browser
  ${pc.cyan('update')}     Pull latest and restart

${pc.bold('Examples:')}
  npx openclaw-board-installer          # Install
  npx openclaw-board-installer status   # Check status
  npx openclaw-board-installer start    # Start if stopped
`)
}

export async function runManage(command: string): Promise<void> {
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (!isInstalled() && command !== 'help') {
    console.log(pc.red('OpenClaw Board is not installed.'))
    console.log(`Run ${pc.cyan('npx openclaw-board-installer')} to install.`)
    process.exit(1)
  }

  const port = getPort()
  const url = `http://localhost:${port}`

  switch (command) {
    case 'status': {
      console.log(pc.bold('\nOpenClaw Board Status\n'))
      console.log(`  Directory:    ${pc.cyan(INSTALL_DIR)}`)
      console.log(`  Port:         ${pc.cyan(String(port))}`)
      console.log(`  URL:          ${pc.cyan(url)}`)
      
      const running = isRunning()
      console.log(`  Status:       ${running ? pc.green('● Running') : pc.red('○ Stopped')}`)
      
      if (process.platform === 'darwin') {
        const launchdStatus = getLaunchdStatus()
        const statusText = launchdStatus === 'running' ? pc.green('Loaded') 
          : launchdStatus === 'stopped' ? pc.yellow('Loaded (stopped)')
          : pc.dim('Not configured')
        console.log(`  Auto-start:   ${statusText}`)
      }
      console.log('')
      break
    }

    case 'start': {
      if (isRunning()) {
        console.log(pc.yellow('Board is already running.'))
        console.log(`Open: ${pc.cyan(url)}`)
        return
      }

      console.log('Starting OpenClaw Board...')
      
      if (hasLaunchAgent() && process.platform === 'darwin') {
        execSync(`launchctl start ${SERVICE_NAME}`)
      } else {
        // Start directly in background
        const child = spawn('npm', ['start'], {
          cwd: INSTALL_DIR,
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
      }

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      if (isRunning()) {
        console.log(pc.green('✓ Board started'))
        console.log(`Open: ${pc.cyan(url)}`)
      } else {
        console.log(pc.yellow('Board may still be starting...'))
        console.log(`Check status: ${pc.cyan('npx openclaw-board-installer status')}`)
      }
      break
    }

    case 'stop': {
      if (!isRunning()) {
        console.log(pc.yellow('Board is not running.'))
        return
      }

      console.log('Stopping OpenClaw Board...')
      
      if (hasLaunchAgent() && process.platform === 'darwin') {
        execSync(`launchctl stop ${SERVICE_NAME}`)
      } else {
        // Kill the process
        try {
          execSync(`pkill -f "openclaw-board.*server"`, { stdio: 'ignore' })
        } catch {
          // May not find process
        }
      }

      console.log(pc.green('✓ Board stopped'))
      break
    }

    case 'restart': {
      console.log('Restarting OpenClaw Board...')
      
      if (hasLaunchAgent() && process.platform === 'darwin') {
        execSync(`launchctl kickstart -k gui/$(id -u)/${SERVICE_NAME}`, { stdio: 'inherit' })
      } else {
        // Stop then start
        try {
          execSync(`pkill -f "openclaw-board.*server"`, { stdio: 'ignore' })
        } catch {}
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const child = spawn('npm', ['start'], {
          cwd: INSTALL_DIR,
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
      }

      await new Promise(resolve => setTimeout(resolve, 3000))
      
      if (isRunning()) {
        console.log(pc.green('✓ Board restarted'))
        console.log(`Open: ${pc.cyan(url)}`)
      } else {
        console.log(pc.yellow('Board may still be starting...'))
      }
      break
    }

    case 'logs': {
      if (process.platform !== 'darwin') {
        console.log(pc.yellow('Log viewing is only supported on macOS.'))
        console.log(`Check logs manually in: ${pc.cyan(join(INSTALL_DIR, 'logs'))}`)
        return
      }

      const logFile = join(INSTALL_DIR, 'logs', 'stdout.log')
      if (!existsSync(logFile)) {
        console.log(pc.yellow('No logs found yet.'))
        return
      }

      console.log(pc.bold('Recent logs:\n'))
      execSync(`tail -50 "${logFile}"`, { stdio: 'inherit' })
      break
    }

    case 'open': {
      if (!isRunning()) {
        console.log(pc.yellow('Board is not running. Starting...'))
        await runManage('start')
      }
      
      console.log(`Opening ${pc.cyan(url)}...`)
      if (process.platform === 'darwin') {
        execSync(`open "${url}"`)
      } else if (process.platform === 'linux') {
        execSync(`xdg-open "${url}"`)
      } else {
        console.log(`Open in browser: ${pc.cyan(url)}`)
      }
      break
    }

    case 'update': {
      console.log('Updating OpenClaw Board...')
      
      execSync('git pull origin main', { cwd: INSTALL_DIR, stdio: 'inherit' })
      execSync('npm install', { cwd: INSTALL_DIR, stdio: 'inherit' })
      execSync('npx prisma generate', { cwd: INSTALL_DIR, stdio: 'inherit' })
      execSync('npx prisma db push', { cwd: INSTALL_DIR, stdio: 'inherit' })
      
      console.log(pc.green('✓ Updated'))
      
      if (isRunning()) {
        console.log('Restarting...')
        await runManage('restart')
      }
      break
    }

    default:
      console.log(pc.red(`Unknown command: ${command}`))
      printHelp()
      process.exit(1)
  }
}
