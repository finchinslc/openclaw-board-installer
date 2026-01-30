import * as p from '@clack/prompts';
import pc from 'picocolors';
import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const REPO_URL = 'https://github.com/finchinslc/openclaw-board.git';
const DEFAULT_PORT = 3000;
const DEFAULT_INSTALL_DIR = join(homedir(), 'openclaw-board');
function commandExists(cmd) {
    try {
        execSync(`command -v ${cmd}`, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function runCommand(cmd, cwd) {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
}
function runCommandLive(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { cwd, stdio: 'inherit' });
        proc.on('close', (code) => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`Command failed with code ${code}`));
        });
        proc.on('error', reject);
    });
}
async function checkPrerequisites() {
    const missing = [];
    // Check npm
    if (!commandExists('npm')) {
        missing.push('npm (Node.js)');
    }
    // Check OpenClaw
    if (!commandExists('openclaw')) {
        missing.push('openclaw');
    }
    // Check Homebrew (macOS only)
    if (process.platform === 'darwin' && !commandExists('brew')) {
        missing.push('homebrew');
    }
    return { ok: missing.length === 0, missing };
}
async function checkPostgres() {
    return commandExists('psql');
}
async function installPostgres(spinner) {
    if (process.platform !== 'darwin') {
        throw new Error('Automatic PostgreSQL installation is only supported on macOS. Please install PostgreSQL manually.');
    }
    spinner.message('Installing PostgreSQL via Homebrew...');
    await runCommandLive('brew', ['install', 'postgresql@17']);
    spinner.message('Starting PostgreSQL service...');
    await runCommandLive('brew', ['services', 'start', 'postgresql@17']);
    // Wait for Postgres to start
    await new Promise(resolve => setTimeout(resolve, 3000));
}
async function setupDatabase(spinner) {
    const dbName = 'openclaw_board';
    const user = process.env.USER || 'openclaw';
    spinner.message('Creating database...');
    try {
        // Check if database exists
        runCommand(`psql -lqt | cut -d \\| -f 1 | grep -qw ${dbName}`);
    }
    catch {
        // Database doesn't exist, create it
        try {
            runCommand(`createdb ${dbName}`);
        }
        catch {
            // Try with postgres superuser if regular user fails
            runCommand(`psql postgres -c "CREATE DATABASE ${dbName};"`);
        }
    }
    return `postgresql://${user}@localhost:5432/${dbName}?schema=public`;
}
async function cloneAndSetup(config, spinner) {
    const { installDir, port } = config;
    if (existsSync(installDir)) {
        spinner.message('Directory exists, pulling latest...');
        await runCommandLive('git', ['pull', 'origin', 'main'], installDir);
    }
    else {
        spinner.message('Cloning OpenClaw Board...');
        await runCommandLive('git', ['clone', REPO_URL, installDir]);
    }
    spinner.message('Installing dependencies...');
    await runCommandLive('npm', ['install'], installDir);
    // Get database URL
    const dbUrl = await setupDatabase(spinner);
    // Write .env file
    spinner.message('Configuring environment...');
    const envContent = `DATABASE_URL="${dbUrl}"\nPORT=${port}\n`;
    writeFileSync(join(installDir, '.env'), envContent);
    // Run Prisma setup
    spinner.message('Setting up database schema...');
    await runCommandLive('npx', ['prisma', 'generate'], installDir);
    await runCommandLive('npx', ['prisma', 'db', 'push'], installDir);
}
async function setupLaunchAgent(config, spinner) {
    if (process.platform !== 'darwin') {
        p.log.warn('Auto-start is only supported on macOS');
        return;
    }
    const { installDir, port } = config;
    const launchAgentsDir = join(homedir(), 'Library', 'LaunchAgents');
    const plistPath = join(launchAgentsDir, 'com.openclaw.board.plist');
    mkdirSync(launchAgentsDir, { recursive: true });
    const npmPath = runCommand('which npm');
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.board</string>
    <key>ProgramArguments</key>
    <array>
        <string>${npmPath}</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${installDir}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>PORT</key>
        <string>${port}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${installDir}/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${installDir}/logs/stderr.log</string>
</dict>
</plist>`;
    mkdirSync(join(installDir, 'logs'), { recursive: true });
    writeFileSync(plistPath, plistContent);
    spinner.message('Loading launch agent...');
    try {
        runCommand(`launchctl unload ${plistPath}`);
    }
    catch {
        // Ignore if not loaded
    }
    runCommand(`launchctl load ${plistPath}`);
}
export async function runInstaller() {
    console.clear();
    p.intro(pc.cyan(pc.bold('OpenClaw Board Installer')));
    // Check prerequisites
    const prereqSpinner = p.spinner();
    prereqSpinner.start('Checking prerequisites...');
    const { ok, missing } = await checkPrerequisites();
    if (!ok) {
        prereqSpinner.stop('Prerequisites check failed');
        for (const dep of missing) {
            if (dep === 'openclaw') {
                p.log.error(pc.red('OpenClaw is not installed.'));
                p.log.info(`Install it first: ${pc.cyan('npm install -g openclaw')}`);
                p.log.info(`Or visit: ${pc.cyan('https://docs.openclaw.ai/getting-started')}`);
            }
            else if (dep === 'npm (Node.js)') {
                p.log.error(pc.red('npm/Node.js is not installed.'));
                p.log.info(`Install Node.js: ${pc.cyan('https://nodejs.org')}`);
            }
            else if (dep === 'homebrew') {
                p.log.error(pc.red('Homebrew is not installed (required for PostgreSQL).'));
                p.log.info(`Install Homebrew: ${pc.cyan('https://brew.sh')}`);
            }
        }
        p.outro(pc.red('Please install missing dependencies and try again.'));
        process.exit(1);
    }
    prereqSpinner.stop('Prerequisites OK');
    // Check for PostgreSQL
    const hasPostgres = await checkPostgres();
    if (!hasPostgres) {
        const installPg = await p.confirm({
            message: 'PostgreSQL is not installed. Install it via Homebrew?',
            initialValue: true,
        });
        if (p.isCancel(installPg) || !installPg) {
            p.log.info('Please install PostgreSQL manually and try again.');
            p.outro(pc.yellow('Installation cancelled.'));
            process.exit(0);
        }
        const pgSpinner = p.spinner();
        pgSpinner.start('Installing PostgreSQL...');
        try {
            await installPostgres(pgSpinner);
            pgSpinner.stop('PostgreSQL installed');
        }
        catch (err) {
            pgSpinner.stop('PostgreSQL installation failed');
            throw err;
        }
    }
    // Configuration prompts
    const installDir = await p.text({
        message: 'Installation directory',
        initialValue: DEFAULT_INSTALL_DIR,
        validate: (value) => {
            if (!value)
                return 'Directory is required';
            return undefined;
        },
    });
    if (p.isCancel(installDir)) {
        p.outro(pc.yellow('Installation cancelled.'));
        process.exit(0);
    }
    const portInput = await p.text({
        message: 'Port number',
        initialValue: String(DEFAULT_PORT),
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 65535) {
                return 'Please enter a valid port (1-65535)';
            }
            return undefined;
        },
    });
    if (p.isCancel(portInput)) {
        p.outro(pc.yellow('Installation cancelled.'));
        process.exit(0);
    }
    const autoStart = await p.confirm({
        message: 'Start automatically on boot?',
        initialValue: true,
    });
    if (p.isCancel(autoStart)) {
        p.outro(pc.yellow('Installation cancelled.'));
        process.exit(0);
    }
    const config = {
        installDir: installDir,
        port: parseInt(portInput, 10),
        autoStart: autoStart,
    };
    // Confirm
    p.log.info('');
    p.log.info(pc.bold('Configuration:'));
    p.log.info(`  Directory: ${pc.cyan(config.installDir)}`);
    p.log.info(`  Port: ${pc.cyan(String(config.port))}`);
    p.log.info(`  Auto-start: ${pc.cyan(config.autoStart ? 'Yes' : 'No')}`);
    p.log.info('');
    const proceed = await p.confirm({
        message: 'Proceed with installation?',
        initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
        p.outro(pc.yellow('Installation cancelled.'));
        process.exit(0);
    }
    // Run installation
    const installSpinner = p.spinner();
    installSpinner.start('Installing OpenClaw Board...');
    try {
        await cloneAndSetup(config, installSpinner);
        installSpinner.stop('OpenClaw Board installed');
        if (config.autoStart) {
            const launchSpinner = p.spinner();
            launchSpinner.start('Setting up auto-start...');
            await setupLaunchAgent(config, launchSpinner);
            launchSpinner.stop('Auto-start configured');
        }
        p.log.success(pc.green('Installation complete!'));
        p.log.info('');
        p.log.info(pc.bold('Next steps:'));
        p.log.info(`  ${pc.cyan(`cd ${config.installDir}`)}`);
        p.log.info(`  ${pc.cyan('npm run dev')}  ${pc.dim('# Development mode')}`);
        p.log.info(`  ${pc.cyan('npm start')}    ${pc.dim('# Production mode')}`);
        p.log.info('');
        p.log.info(`Open in browser: ${pc.cyan(`http://localhost:${config.port}`)}`);
        p.outro(pc.green('Happy tasking! 🎯'));
    }
    catch (err) {
        installSpinner.stop('Installation failed');
        throw err;
    }
}
