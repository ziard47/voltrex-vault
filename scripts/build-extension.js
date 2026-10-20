/**
 * Voltrex Vault - Extension Build Script
 * Compiles popup UI with Vite and bundles background and content scripts with esbuild.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const distExtDir = path.resolve(rootDir, 'dist/extension');

console.log('--- Building Voltrex Vault Browser Extension ---');

// 1. Ensure clean target directory
if (fs.existsSync(distExtDir)) {
  fs.rmSync(distExtDir, { recursive: true, force: true });
}
fs.mkdirSync(distExtDir, { recursive: true });

// 2. Build popup with Vite
console.log('1. Compiling Popup UI with Vite...');
execSync('npx vite build --config vite.extension.config.ts', {
  cwd: rootDir,
  stdio: 'inherit',
});

// Ensure popup.html is created from generated index.html
const generatedHtml = path.join(distExtDir, 'index.html');
const targetHtml = path.join(distExtDir, 'popup.html');
if (fs.existsSync(generatedHtml)) {
  fs.copyFileSync(generatedHtml, targetHtml);
}

// 3. Bundle background service worker
console.log('2. Bundling background service worker...');
esbuild.buildSync({
  entryPoints: [path.resolve(rootDir, 'src/extension/background/index.ts')],
  outfile: path.resolve(distExtDir, 'background.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  minify: false,
  sourcemap: false,
});

// 4. Bundle content script (IIFE format for standalone isolated execution)
console.log('3. Bundling content script (IIFE format)...');
esbuild.buildSync({
  entryPoints: [path.resolve(rootDir, 'src/extension/content/index.ts')],
  outfile: path.resolve(distExtDir, 'content.js'),
  bundle: true,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  minify: false,
  sourcemap: false,
});

// 5. Copy manifest.json
console.log('4. Copying manifest.json...');
fs.copyFileSync(
  path.resolve(rootDir, 'src/extension/manifest.json'),
  path.resolve(distExtDir, 'manifest.json')
);

console.log('Browser extension built successfully in dist/extension/');
