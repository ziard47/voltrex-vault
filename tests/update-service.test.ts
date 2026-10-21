import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareVersions, UpdateService } from '../src/main/services/update-service';

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => 'C:\\Users\\Mock\\Downloads'),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}));

describe('UpdateService - Version Comparison', () => {
  it('correctly compares version numbers', () => {
    // Greater versions
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('v1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.0.0.1', '1.0.0')).toBe(1);

    // Lesser versions
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(compareVersions('0.9.5', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', 'v1.0.1')).toBe(-1);

    // Equal versions
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v2.4.1', 'v2.4.1')).toBe(0);
  });
});

describe('UpdateService - GitHub Releases API', () => {
  let updateService: UpdateService;

  beforeEach(() => {
    vi.restoreAllMocks();
    updateService = new UpdateService('ziard47', 'voltrex-vault');
  });

  it('handles 404 gracefully when no releases are published yet', async () => {
    // Mock global fetch returning 404
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await updateService.checkForUpdates();
    expect(result.isUpdateAvailable).toBe(false);
    expect(result.hasReleases).toBe(false);
    expect(result.currentVersion).toBe('1.0.0');
    expect(result.latestVersion).toBe('1.0.0');
    expect(result.assets).toHaveLength(0);
  });

  it('detects update available when a higher version is published', async () => {
    const mockReleaseData = {
      tag_name: 'v1.1.0',
      name: 'Voltrex Vault v1.1.0 Release',
      body: 'Features and security improvements.',
      published_at: '2026-10-21T00:00:00Z',
      html_url: 'https://github.com/ziard47/voltrex-vault/releases/tag/v1.1.0',
      assets: [
        {
          name: 'voltrex-vault-setup-1.1.0.exe',
          size: 52428800,
          browser_download_url: 'https://github.com/ziard47/voltrex-vault/releases/download/v1.1.0/voltrex-vault-setup-1.1.0.exe',
          content_type: 'application/octet-stream',
        },
        {
          name: 'voltrex-vault-1.1.0.dmg',
          size: 55000000,
          browser_download_url: 'https://github.com/ziard47/voltrex-vault/releases/download/v1.1.0/voltrex-vault-1.1.0.dmg',
          content_type: 'application/octet-stream',
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue(mockReleaseData),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await updateService.checkForUpdates();
    expect(result.isUpdateAvailable).toBe(true);
    expect(result.hasReleases).toBe(true);
    expect(result.currentVersion).toBe('1.0.0');
    expect(result.latestVersion).toBe('1.1.0');
    expect(result.releaseName).toBe('Voltrex Vault v1.1.0 Release');
    expect(result.assets).toHaveLength(2);
    // On Windows, recommended asset should be the .exe
    expect(result.recommendedAsset?.name).toBe('voltrex-vault-setup-1.1.0.exe');
  });

  it('detects no update available when current version equals or exceeds latest', async () => {
    const mockReleaseData = {
      tag_name: 'v1.0.0',
      name: 'Voltrex Vault Initial Release',
      body: 'Initial release',
      published_at: '2026-10-20T00:00:00Z',
      html_url: 'https://github.com/ziard47/voltrex-vault/releases/tag/v1.0.0',
      assets: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue(mockReleaseData),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await updateService.checkForUpdates();
    expect(result.isUpdateAvailable).toBe(false);
    expect(result.hasReleases).toBe(true);
    expect(result.currentVersion).toBe('1.0.0');
    expect(result.latestVersion).toBe('1.0.0');
  });

  it('throws an error if GitHub API returns non-404 error code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(updateService.checkForUpdates()).rejects.toThrow('GitHub API returned status 500');
  });
});
