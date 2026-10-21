/**
 * Voltrex Vault - Packaging System
 * Supports Windows setup installer, Linux tar.gz + AppImage, and Browser Extension.
 *
 * Folder structure:
 * releases/
 *   windows/<version>/
 *   linux/<version>/
 *   extension/<version>/
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const builder = require('electron-builder');
const Platform = builder.Platform;

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.resolve(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const defaultVersion = pkg.version || '1.0.0';

// Ensure standard releases root and platform folders exist
const releasesDir = path.resolve(rootDir, 'releases');
const winReleasesDir = path.resolve(releasesDir, 'windows');
const linuxReleasesDir = path.resolve(releasesDir, 'linux');
const extReleasesDir = path.resolve(releasesDir, 'extension');

function ensureDirectories() {
  for (const dir of [releasesDir, winReleasesDir, linuxReleasesDir, extReleasesDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Prompts user for version number if not provided via CLI.
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function resolveVersion(cliVersion) {
  if (cliVersion && typeof cliVersion === 'string' && cliVersion.trim().length > 0) {
    const cleaned = cliVersion.trim().replace(/^v/, '');
    console.log(`Using version provided via CLI: ${cleaned}`);
    return cleaned;
  }

  // If interactive terminal, prompt the user
  if (process.stdin.isTTY) {
    console.log('\n========================================');
    console.log('   Voltrex Vault Packaging System');
    console.log('========================================\n');
    const answer = await askQuestion(
      `Enter version number to package (default: ${defaultVersion}): `
    );

    if (answer && answer.length > 0) {
      const cleaned = answer.replace(/^v/, '');
      console.log(`-> Packaging version: ${cleaned}\n`);
      return cleaned;
    }
  }

  console.log(`Using default version: ${defaultVersion}\n`);
  return defaultVersion;
}

/**
 * Parses CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let platform = null;
  let version = null;
  let skipBuild = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--platform' || arg === '-p') {
      platform = args[++i];
    } else if (arg.startsWith('--platform=')) {
      platform = arg.split('=')[1];
    } else if (arg === '--version' || arg === '-v') {
      version = args[++i];
    } else if (arg.startsWith('--version=')) {
      version = arg.split('=')[1];
    } else if (arg === '--no-build' || arg === '--skip-build') {
      skipBuild = true;
    }
  }

  return { platform, version, skipBuild };
}

/**
 * Builds the frontend and electron main/preload code
 */
function runBuild(includeExtension = true) {
  console.log('--- 1. Building Application Source Code ---');

  console.log('Building Vite renderer bundle...');
  execSync('npm run build:vite', { cwd: rootDir, stdio: 'inherit' });

  console.log('Building Electron main and preload processes...');
  execSync('npm run build:electron', { cwd: rootDir, stdio: 'inherit' });

  if (includeExtension) {
    console.log('Building Browser Extension...');
    execSync('npm run build:extension', { cwd: rootDir, stdio: 'inherit' });
  }

  console.log('Source compilation finished successfully.\n');
}

/**
 * Packages Windows Setup Installer
 */
async function packageWindows(version) {
  const targetDir = path.resolve(winReleasesDir, version);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`\n========================================`);
  console.log(` Packaging Windows Setup (v${version})`);
  console.log(` Target output: ${targetDir}`);
  console.log(`========================================\n`);

  try {
    await builder.build({
      targets: Platform.WINDOWS.createTarget(['nsis'], builder.Arch.x64),
      config: {
        appId: 'com.voltrex.vault',
        productName: 'Voltrex Vault',
        copyright: 'Copyright © 2026 Voltrex Digital | Mohomed Ziard',
        extraMetadata: {
          version,
        },
        npmRebuild: false,
        nodeGypRebuild: false,
        directories: {
          output: targetDir,
          buildResources: 'public',
        },
        files: [
          'dist/electron/**/*',
          'dist/renderer/**/*',
          'node_modules/sql.js/**/*',
          'node_modules/hash-wasm/**/*',
          'package.json',
        ],
        asarUnpack: [
          'node_modules/sql.js/**/*',
          'node_modules/hash-wasm/**/*',
        ],
        win: {
          forceCodeSigning: false,
          target: [
            {
              target: 'nsis',
              arch: ['x64'],
            },
          ],
          artifactName: 'Voltrex-Vault-Setup-${version}.${ext}',
        },
        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: 'Voltrex Vault',
          uninstallDisplayName: 'Voltrex Vault',
        },
      },
    });

    console.log(`\n[SUCCESS] Windows Setup packaged successfully into:`);
    console.log(`   ${targetDir}\n`);
  } catch (error) {
    console.error(`\n[ERROR] Windows packaging failed:`, error.message);
    throw error;
  }
}

/**
 * Packages Linux setup (tar.gz and AppImage)
 */
async function packageLinux(version) {
  const targetDir = path.resolve(linuxReleasesDir, version);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`\n========================================`);
  console.log(` Packaging Linux Distributables (v${version})`);
  console.log(` Target output: ${targetDir}`);
  console.log(`========================================\n`);

  // Common linux config
  const linuxConfig = {
    appId: 'com.voltrex.vault',
    productName: 'Voltrex Vault',
    copyright: 'Copyright © 2026 Voltrex Digital | Mohomed Ziard',
    extraMetadata: {
      version,
    },
    npmRebuild: false,
    nodeGypRebuild: false,
    directories: {
      output: targetDir,
      buildResources: 'public',
    },
    files: [
      'dist/electron/**/*',
      'dist/renderer/**/*',
      'node_modules/sql.js/**/*',
      'node_modules/hash-wasm/**/*',
      'package.json',
    ],
    asarUnpack: [
      'node_modules/sql.js/**/*',
      'node_modules/hash-wasm/**/*',
    ],
    linux: {
      category: 'Utility',
      artifactName: 'voltrex-vault-${version}-${arch}.${ext}',
    },
  };

  // 1. Build Linux tar.gz
  console.log('-> 1/2 Building Linux tar.gz setup archive...');
  try {
    await builder.build({
      targets: Platform.LINUX.createTarget(['tar.gz'], builder.Arch.x64),
      config: linuxConfig,
    });
    console.log(`[SUCCESS] Linux tar.gz created in ${targetDir}\n`);
  } catch (err) {
    console.error('[ERROR] Failed to build Linux tar.gz:', err.message);
    throw err;
  }

  // 2. Build Linux AppImage
  console.log('-> 2/2 Building Linux AppImage...');
  try {
    await builder.build({
      targets: Platform.LINUX.createTarget(['AppImage'], builder.Arch.x64),
      config: linuxConfig,
    });
    console.log(`[SUCCESS] Linux AppImage created in ${targetDir}\n`);
  } catch (err) {
    if (process.platform === 'win32') {
      console.warn(`\n[NOTICE] Linux AppImage creation on Windows requires Docker or a Linux environment.`);
      console.warn(`         tar.gz is available in ${targetDir}.`);
      console.warn(`         When building in CI/CD or Linux, AppImage will generate automatically.\n`);
    } else {
      console.error('[ERROR] Failed to build Linux AppImage:', err.message);
      throw err;
    }
  }

  console.log(`\n[SUCCESS] Linux packaging finished in:`);
  console.log(`   ${targetDir}\n`);
}

/**
 * Packages Browser Extension
 */
function packageExtension(version) {
  const targetDir = path.resolve(extReleasesDir, version);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`\n========================================`);
  console.log(` Packaging Browser Extension (v${version})`);
  console.log(` Target output: ${targetDir}`);
  console.log(`========================================\n`);

  const distExtDir = path.resolve(rootDir, 'dist/extension');
  if (!fs.existsSync(distExtDir)) {
    console.log('Building browser extension first...');
    execSync('npm run build:extension', { cwd: rootDir, stdio: 'inherit' });
  }

  // 1. Copy extension files into unpacked release directory
  const unpackedDir = path.join(targetDir, `voltrex-vault-extension-${version}`);
  if (fs.existsSync(unpackedDir)) {
    fs.rmSync(unpackedDir, { recursive: true, force: true });
  }
  fs.mkdirSync(unpackedDir, { recursive: true });

  fs.cpSync(distExtDir, unpackedDir, { recursive: true });

  // Update version in manifest.json inside the packaged directory
  const manifestPath = path.join(unpackedDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifest.version = version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  // 2. Create zip archive using tar (built-in on Windows 10/11 and Linux) or PowerShell
  const zipName = `voltrex-vault-extension-${version}.zip`;
  const zipPath = path.join(targetDir, zipName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  try {
    // bsdtar creates standard zip archives using -a -c -f
    execSync(`tar -a -c -f "${zipPath}" -C "${unpackedDir}" .`, { stdio: 'pipe' });
    console.log(`[SUCCESS] Extension zip created: ${zipName}`);
  } catch {
    // Fallback on Windows PowerShell Compress-Archive
    try {
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${unpackedDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'pipe' }
      );
      console.log(`[SUCCESS] Extension zip created via PowerShell: ${zipName}`);
    } catch (e) {
      console.warn(`[WARNING] Could not create zip archive: ${e.message}. Unpacked folder is available.`);
    }
  }

  console.log(`\n[SUCCESS] Extension packaged into:`);
  console.log(`   ${targetDir}\n`);
}

/**
 * Main Orchestrator
 */
async function main() {
  ensureDirectories();
  const { platform: cliPlatform, version: cliVersion, skipBuild } = parseArgs();

  // 1. Ask or resolve version
  const version = await resolveVersion(cliVersion);

  // 2. Resolve platform
  let platform = cliPlatform;
  if (!platform && process.stdin.isTTY) {
    console.log('Select target to package:');
    console.log('  1) Windows (Setup installer)');
    console.log('  2) Linux (tar.gz and AppImage)');
    console.log('  3) Browser Extension (.zip and unpacked)');
    console.log('  4) All (Windows, Linux, Extension)');
    const choice = await askQuestion('Choice [default: 4]: ');
    if (choice === '1' || choice.toLowerCase() === 'win' || choice.toLowerCase() === 'windows') {
      platform = 'win';
    } else if (choice === '2' || choice.toLowerCase() === 'linux') {
      platform = 'linux';
    } else if (choice === '3' || choice.toLowerCase() === 'extension' || choice.toLowerCase() === 'ext') {
      platform = 'extension';
    } else {
      platform = 'all';
    }
  } else if (!platform) {
    platform = 'all';
  }

  platform = platform.toLowerCase();

  // 3. Run source build unless skipped
  if (!skipBuild) {
    runBuild(platform === 'all' || platform === 'extension');
  }

  // 4. Execute selected packaging
  if (platform === 'win' || platform === 'windows') {
    await packageWindows(version);
  } else if (platform === 'linux') {
    await packageLinux(version);
  } else if (platform === 'extension' || platform === 'ext') {
    packageExtension(version);
  } else if (platform === 'all') {
    await packageWindows(version);
    await packageLinux(version);
    packageExtension(version);
  } else {
    console.error(`[ERROR] Unknown platform: ${platform}. Use 'win', 'linux', 'extension', or 'all'.`);
    process.exit(1);
  }

  console.log('========================================');
  console.log('🎉 Packaging Complete!');
  console.log(`Artifacts are stored in: ${releasesDir}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
