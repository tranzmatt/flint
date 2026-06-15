import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const AGENT_DIR = path.join(ROOT_DIR, 'agent');
const ELECTRON_DIR = path.join(ROOT_DIR, 'electron');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BUILD_BIN_DIR = path.join(ELECTRON_DIR, 'bin');

console.log('--- Flint App Builder ---');
console.log(`OS: ${os.platform()} (${os.arch()})`);

// 1. Build React App
console.log('\n[1/3] Building React Frontend...');
execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

// 2. Build Python Agent
console.log('\n[2/3] Compiling Python Agent with PyInstaller...');
if (!fs.existsSync(BUILD_BIN_DIR)) {
  fs.mkdirSync(BUILD_BIN_DIR, { recursive: true });
}

const pyinstallerCmd = os.platform() === 'win32' 
  ? 'python -m PyInstaller' 
  : 'pyinstaller';

const executableName = os.platform() === 'win32' ? 'agent.exe' : 'agent';

try {
  // Use --onefile to create a single executable
  // Use --noconsole on Windows to avoid showing cmd window in background (optional, but good for services)
  const windowedFlag = os.platform() === 'win32' ? '--noconsole ' : '';
  const cmd = `${pyinstallerCmd} --onefile ${windowedFlag}--distpath "${BUILD_BIN_DIR}" --workpath "${path.join(AGENT_DIR, 'build')}" --specpath "${AGENT_DIR}" agent.py`;
  
  execSync(cmd, { cwd: AGENT_DIR, stdio: 'inherit' });
  console.log(`\nSuccessfully compiled agent to ${path.join(BUILD_BIN_DIR, executableName)}`);
} catch (error) {
  console.error('Failed to compile Python agent. Do you have pyinstaller installed? (`pip install pyinstaller`)');
  process.exit(1);
}

// 3. Package Electron App
console.log('\n[3/3] Packaging Electron App...');
try {
  execSync('npx electron-builder --publish never', { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log('\nDone! App installers are in the /dist_electron (or configured out) directory.');
} catch (error) {
  console.error('Failed to package electron app.', error);
  process.exit(1);
}
