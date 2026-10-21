/**
 * Voltrex Vault - Update Service
 * Checks and downloads desktop updates directly from GitHub Releases API.
 */

import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { UpdateCheckResult, ReleaseAsset, DownloadProgress } from '../../shared/types';

export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').trim();
  const clean2 = v2.replace(/^v/, '').trim();

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export class UpdateService {
  private repoOwner: string;
  private repoName: string;
  private platform: NodeJS.Platform;

  constructor(repoOwner = 'ziard47', repoName = 'voltrex-vault', platform: NodeJS.Platform = process.platform) {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.platform = platform;
  }

  public getCurrentVersion(): string {
    return app?.getVersion ? app.getVersion() : '1.0.0';
  }

  public getReleasePageUrl(): string {
    return `https://github.com/${this.repoOwner}/${this.repoName}/releases`;
  }

  /**
   * Checks GitHub Releases API for the latest release.
   */
  public async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion();
    const apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Voltrex-Vault-Desktop',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (response.status === 404) {
        return {
          currentVersion,
          latestVersion: currentVersion,
          isUpdateAvailable: false,
          hasReleases: false,
          releaseName: 'No Releases Found',
          releaseNotes: `No published releases were found on GitHub for ${this.repoOwner}/${this.repoName}. You are running version ${currentVersion}.`,
          publishedAt: '',
          releaseUrl: this.getReleasePageUrl(),
          assets: [],
        };
      }

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const tagName = String(data.tag_name || '').trim();
      const latestVersion = tagName.replace(/^v/, '');

      const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;

      const assets: ReleaseAsset[] = Array.isArray(data.assets)
        ? data.assets.map((asset: any) => ({
            name: String(asset.name || ''),
            sizeBytes: Number(asset.size || 0),
            downloadUrl: String(asset.browser_download_url || ''),
            contentType: String(asset.content_type || ''),
          }))
        : [];

      // Determine recommended asset for current platform
      const recommendedAsset = this.selectRecommendedAsset(assets);

      return {
        currentVersion,
        latestVersion,
        isUpdateAvailable,
        hasReleases: true,
        releaseName: data.name || tagName,
        releaseNotes: data.body || 'No release notes provided.',
        publishedAt: data.published_at || '',
        releaseUrl: data.html_url || this.getReleasePageUrl(),
        assets,
        recommendedAsset,
      };
    } catch (error: any) {
      console.error('[UpdateService] Check error:', error.message);
      throw new Error(`Failed to check for updates: ${error.message}`);
    }
  }

  /**
   * Selects the most appropriate installer or archive for the user's OS platform.
   */
  public selectRecommendedAsset(assets: ReleaseAsset[], platformOverride?: NodeJS.Platform): ReleaseAsset | undefined {
    if (!assets || assets.length === 0) return undefined;

    const platform = platformOverride || this.platform;
    if (platform === 'win32') {
      return (
        assets.find(a => a.name.endsWith('.exe')) ||
        assets.find(a => a.name.endsWith('.msi')) ||
        assets.find(a => a.name.endsWith('.zip')) ||
        assets[0]
      );
    } else if (platform === 'darwin') {
      return (
        assets.find(a => a.name.endsWith('.dmg')) ||
        assets.find(a => a.name.endsWith('.zip')) ||
        assets[0]
      );
    } else {
      return (
        assets.find(a => a.name.endsWith('.AppImage')) ||
        assets.find(a => a.name.endsWith('.deb')) ||
        assets.find(a => a.name.endsWith('.tar.gz')) ||
        assets[0]
      );
    }
  }

  /**
   * Downloads an asset to the user's Downloads folder while reporting streaming progress.
   */
  public async downloadAsset(
    downloadUrl: string,
    assetName: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    if (!downloadUrl) {
      throw new Error('Download URL is required.');
    }

    const downloadsDir = app?.getPath ? app.getPath('downloads') : process.cwd();
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Sanitize filename
    const safeFileName = path.basename(assetName) || `voltrex-vault-update-${Date.now()}`;
    const destinationPath = path.join(downloadsDir, safeFileName);
    const tempPath = `${destinationPath}.downloading`;

    onProgress?.({
      status: 'downloading',
      percent: 0,
      transferredBytes: 0,
      totalBytes: 0,
    });

    try {
      const response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Voltrex-Vault-Desktop',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download update file: ${response.status} ${response.statusText}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      if (!response.body) {
        throw new Error('Download response body is empty.');
      }

      let transferredBytes = 0;
      const fileStream = fs.createWriteStream(tempPath);

      // Track progress through stream reader
      const nodeReadable = Readable.fromWeb(response.body as any);
      nodeReadable.on('data', (chunk: Buffer) => {
        transferredBytes += chunk.length;
        const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;
        onProgress?.({
          status: 'downloading',
          percent,
          transferredBytes,
          totalBytes,
        });
      });

      await pipeline(nodeReadable, fileStream);

      // Rename temp file to final filename
      if (fs.existsSync(destinationPath)) {
        try {
          fs.unlinkSync(destinationPath);
        } catch {}
      }
      fs.renameSync(tempPath, destinationPath);

      onProgress?.({
        status: 'completed',
        percent: 100,
        transferredBytes,
        totalBytes: transferredBytes,
        savedFilePath: destinationPath,
      });

      return destinationPath;
    } catch (err: any) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
      onProgress?.({
        status: 'error',
        percent: 0,
        transferredBytes: 0,
        totalBytes: 0,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Safely opens the release in the external browser.
   */
  public async openReleaseUrl(url?: string): Promise<boolean> {
    const targetUrl = url || this.getReleasePageUrl();
    await shell.openExternal(targetUrl);
    return true;
  }

  /**
   * Reveals the downloaded installer or file in the OS file manager.
   */
  public showItemInFolder(filePath: string): boolean {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  }

  /**
   * Executes or opens the downloaded file with system default handler.
   */
  public async openDownloadedFile(filePath: string): Promise<boolean> {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return true;
    }
    return false;
  }
}
