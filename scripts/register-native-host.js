/**
 * Voltrex Vault - Native Messaging Host Registration Script
 * Generates and installs com.voltrex.vault.json manifest in Chromium browser directories
 * including native packages and Flatpak sandboxes (SteamOS / Linux).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

const home = os.homedir();
let installedCount = 0;

console.log('--- Registering Voltrex Vault Native Messaging Host ---');
console.log(`Launcher: ${launcherPath}`);

if (process.platform === 'linux') {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');

  // 1. Native / Non-flatpak browser directories
  const nativeDirs = [
    path.join(configHome, 'google-chrome/NativeMessagingHosts'),
    path.join(configHome, 'google-chrome-beta/NativeMessagingHosts'),
    path.join(configHome, 'google-chrome-unstable/NativeMessagingHosts'),
    path.join(configHome, 'chromium/NativeMessagingHosts'),
    path.join(configHome, 'BraveSoftware/Brave-Browser/NativeMessagingHosts'),
    path.join(configHome, 'microsoft-edge/NativeMessagingHosts'),
    path.join(configHome, 'microsoft-edge-dev/NativeMessagingHosts'),
    path.join(configHome, 'vivaldi/NativeMessagingHosts'),
  ];

  const standardManifest = {
    name: 'com.voltrex.vault',
    description: 'Voltrex Vault Native Messaging Host',
    path: launcherPath,
    type: 'stdio',
    allowed_origins: allowedOrigins,
  };

  for (const dir of nativeDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const manifestPath = path.join(dir, 'com.voltrex.vault.json');
      fs.writeFileSync(manifestPath, JSON.stringify(standardManifest, null, 2), 'utf8');
      console.log(`Installed (Native): ${manifestPath}`);
      installedCount++;
    } catch (err) {
      console.warn(`Could not install to ${dir}: ${err.message}`);
    }
  }

  // 2. Flatpak browser directories (SteamOS / Linux sandboxes)
  const flatpakApps = [
    { id: 'com.microsoft.Edge', configSubdir: 'microsoft-edge' },
    { id: 'com.google.Chrome', configSubdir: 'google-chrome' },
    { id: 'com.brave.Browser', configSubdir: 'BraveSoftware/Brave-Browser' },
    { id: 'org.chromium.Chromium', configSubdir: 'chromium' },
  ];

  for (const app of flatpakApps) {
    const flatpakBase = path.join(home, '.var/app', app.id);
    if (fs.existsSync(flatpakBase)) {
      try {
        const flatpakHostDir = path.join(flatpakBase, 'config', app.configSubdir, 'NativeMessagingHosts');
        if (!fs.existsSync(flatpakHostDir)) {
          fs.mkdirSync(flatpakHostDir, { recursive: true });
        }

        // Inside Flatpak, Edge/Chrome must run via flatpak-spawn --host to access node and local socket
        const bridgeScriptPath = path.join(flatpakHostDir, 'voltrex-flatpak-bridge.sh');
        const bridgeScriptContent = `#!/usr/bin/env bash\nexec flatpak-spawn --host "${launcherPath}" "$@"\n`;
        fs.writeFileSync(bridgeScriptPath, bridgeScriptContent, { mode: 0o755 });

        const flatpakManifest = {
          name: 'com.voltrex.vault',
          description: 'Voltrex Vault Native Messaging Host (Flatpak Bridge)',
          path: bridgeScriptPath,
          type: 'stdio',
          allowed_origins: allowedOrigins,
        };

        const flatpakManifestPath = path.join(flatpakHostDir, 'com.voltrex.vault.json');
        fs.writeFileSync(flatpakManifestPath, JSON.stringify(flatpakManifest, null, 2), 'utf8');
        console.log(`Installed (Flatpak ${app.id}): ${flatpakManifestPath}`);
        installedCount++;

        // Grant Flatpak permission to use flatpak-spawn
        try {
          execSync(`flatpak override --user --talk-name=org.freedesktop.Flatpak ${app.id}`, { stdio: 'ignore' });
          console.log(`Configured Flatpak permissions for ${app.id}`);
        } catch {
          console.warn(`Notice: Could not automatically set flatpak override for ${app.id}. You may run: flatpak override --user --talk-name=org.freedesktop.Flatpak ${app.id}`);
        }
      } catch (err) {
        console.warn(`Could not install Flatpak host for ${app.id}: ${err.message}`);
      }
    }
  }
} else if (process.platform === 'darwin') {
  const appSupport = path.join(home, 'Library/Application Support');
  const macDirs = [
    path.join(appSupport, 'Google/Chrome/NativeMessagingHosts'),
    path.join(appSupport, 'Chromium/NativeMessagingHosts'),
    path.join(appSupport, 'BraveSoftware/Brave-Browser/NativeMessagingHosts'),
    path.join(appSupport, 'Microsoft Edge/NativeMessagingHosts'),
  ];

  const macManifest = {
    name: 'com.voltrex.vault',
    description: 'Voltrex Vault Native Messaging Host',
    path: launcherPath,
    type: 'stdio',
    allowed_origins: allowedOrigins,
  };

  for (const dir of macDirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const manifestPath = path.join(dir, 'com.voltrex.vault.json');
      fs.writeFileSync(manifestPath, JSON.stringify(macManifest, null, 2), 'utf8');
      console.log(`Installed: ${manifestPath}`);
      installedCount++;
    } catch (err) {
      console.warn(`Could not install to ${dir}: ${err.message}`);
    }
  }
} else if (process.platform === 'win32') {
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData/Local');
  const winDir = path.join(localAppData, 'voltrex-vault');
  if (!fs.existsSync(winDir)) {
    fs.mkdirSync(winDir, { recursive: true });
  }
  const winManifestPath = path.join(winDir, 'com.voltrex.vault.json');
  const winManifest = {
    name: 'com.voltrex.vault',
    description: 'Voltrex Vault Native Messaging Host',
    path: path.resolve(rootDir, 'dist/electron/native-host/index.js'),
    type: 'stdio',
    allowed_origins: allowedOrigins,
  };
  fs.writeFileSync(winManifestPath, JSON.stringify(winManifest, null, 2), 'utf8');
  console.log(`Windows manifest written to ${winManifestPath}`);
  console.log('To complete Windows registration, set registry key:');
  console.log(`reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.voltrex.vault" /ve /t REG_SZ /d "${winManifestPath}" /f`);
  process.exit(0);
}

console.log(`\nSuccessfully registered native messaging host across ${installedCount} browser locations.`);
if (customExtId) {
  console.log(`Registered for extension ID: ${customExtId}`);
}
