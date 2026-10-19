/**
 * Voltrex Vault - Native Messaging Host Registration Script
 * Generates and installs com.voltrex.vault.json manifest in Chromium browser directories.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const launcherPath = path.resolve(rootDir, 'scripts/run-native-host.sh');

// Parse optional --extension-id argument
const args = process.argv.slice(2);
const idArgIndex = args.indexOf('--extension-id');
const customExtId = idArgIndex !== -1 && args[idArgIndex + 1] ? args[idArgIndex + 1] : null;

// Allow custom ID or default pattern
const allowedOrigins = [
  'chrome-extension://*/',
];

if (customExtId) {
  allowedOrigins.unshift(`chrome-extension://${customExtId}/`);
}

const manifest = {
  name: 'com.voltrex.vault',
  description: 'Voltrex Vault Native Messaging Host',
  path: launcherPath,
  type: 'stdio',
  allowed_origins: allowedOrigins,
};

const home = os.homedir();
const targetDirs = [];

if (process.platform === 'linux') {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  targetDirs.push(
    path.join(configHome, 'google-chrome/NativeMessagingHosts'),
    path.join(configHome, 'chromium/NativeMessagingHosts'),
    path.join(configHome, 'BraveSoftware/Brave-Browser/NativeMessagingHosts'),
    path.join(configHome, 'microsoft-edge/NativeMessagingHosts'),
    path.join(configHome, 'vivaldi/NativeMessagingHosts')
  );
} else if (process.platform === 'darwin') {
  const appSupport = path.join(home, 'Library/Application Support');
  targetDirs.push(
    path.join(appSupport, 'Google/Chrome/NativeMessagingHosts'),
    path.join(appSupport, 'Chromium/NativeMessagingHosts'),
    path.join(appSupport, 'BraveSoftware/Brave-Browser/NativeMessagingHosts'),
    path.join(appSupport, 'Microsoft Edge/NativeMessagingHosts')
  );
} else if (process.platform === 'win32') {
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local');
  const winDir = path.join(localAppData, 'voltrex-vault');
  if (!fs.existsSync(winDir)) {
    fs.mkdirSync(winDir, { recursive: true });
  }
  const winManifestPath = path.join(winDir, 'com.voltrex.vault.json');
  manifest.path = path.resolve(rootDir, 'dist/electron/native-host/index.js');
  fs.writeFileSync(winManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Windows manifest written to ${winManifestPath}`);
  console.log('To complete Windows registration, set registry key:');
  console.log(`reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.voltrex.vault" /ve /t REG_SZ /d "${winManifestPath}" /f`);
  process.exit(0);
}

console.log('--- Registering Voltrex Vault Native Messaging Host ---');
console.log(`Launcher: ${launcherPath}`);

let installedCount = 0;
for (const dir of targetDirs) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const manifestPath = path.join(dir, 'com.voltrex.vault.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`Installed: ${manifestPath}`);
    installedCount++;
  } catch (err) {
    console.warn(`Could not install to ${dir}: ${err.message}`);
  }
}

console.log(`\nSuccessfully registered native messaging host in ${installedCount} browser directories.`);
if (!customExtId) {
  console.log('Tip: Once your extension is loaded unpacked in chrome://extensions, you can register its exact ID with:');
  console.log('  npm run register:host -- --extension-id <YOUR_EXTENSION_ID>');
}
