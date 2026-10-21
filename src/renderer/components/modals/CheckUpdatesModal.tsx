import React, { useState } from 'react';
import { useVault } from '../../context/VaultContext';
import {
  X,
  Sparkles,
  RefreshCw,
  Play,
  FolderOpen,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  ArrowDownCircle,
  PackageCheck,
} from 'lucide-react';
import logoUrl from '../../assets/logo.jpg';

export const CheckUpdatesModal: React.FC = () => {
  const {
    isCheckUpdatesOpen,
    closeCheckUpdates,
    updateInfo,
    isCheckingUpdates,
    downloadProgress,
    checkForUpdates,
    downloadUpdate,
    openReleasePage,
    openDownloadedFile,
    showDownloadedInFolder,
  } = useVault();

  const [isInstalling, setIsInstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isCheckUpdatesOpen) return null;

  const handleCheckAgain = async () => {
    setErrorMessage(null);
    try {
      await checkForUpdates();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to check for updates.');
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateInfo) return;
    setErrorMessage(null);

    // If an asset is already downloaded and ready, run it directly
    if (downloadProgress?.status === 'completed' && downloadProgress.savedFilePath) {
      try {
        await openDownloadedFile(downloadProgress.savedFilePath);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to launch update installer.');
      }
      return;
    }

    if (!updateInfo.recommendedAsset) {
      // Fallback: open release page if no direct binary asset is recognized for this OS
      if (updateInfo.releaseUrl) {
        await openReleasePage(updateInfo.releaseUrl);
      }
      return;
    }

    try {
      setIsInstalling(true);
      const savedPath = await downloadUpdate(updateInfo.recommendedAsset);
      if (savedPath) {
        // Automatically launch the installer for a seamless download & install experience
        await openDownloadedFile(savedPath);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to download and install update.');
    } finally {
      setIsInstalling(false);
    }
  };

  const isDownloading = downloadProgress?.status === 'downloading';
  const isDownloaded = downloadProgress?.status === 'completed' && Boolean(downloadProgress.savedFilePath);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget && !isDownloading) {
          closeCheckUpdates();
        }
      }}
    >
      <div className="bg-[#0a0b08] border border-vault-border rounded-lg max-w-lg w-full shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-vault-border flex items-center justify-between bg-black/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-vault-lime/10 border border-vault-lime/30 flex items-center justify-center text-vault-lime">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-vault-textPrimary">Check for Updates</h3>
              <p className="text-[11px] text-vault-textMuted">Voltrex Vault Desktop Application</p>
            </div>
          </div>
          <button
            onClick={closeCheckUpdates}
            disabled={isDownloading}
            className="text-vault-textMuted hover:text-vault-textPrimary p-1 rounded hover:bg-vault-surface transition-colors disabled:opacity-40"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Current App Info Bar */}
          <div className="p-3 bg-black/70 border border-vault-border rounded-md flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-md overflow-hidden border border-vault-border flex-shrink-0">
                <img src={logoUrl} alt="Voltrex Vault" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-vault-textPrimary">Voltrex Vault</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-vault-border text-vault-lime">
                    v{updateInfo?.currentVersion || '1.0.0'}
                  </span>
                </div>
                <p className="text-[10px] text-vault-textMuted">
                  Channel: GitHub Releases (ziard47/voltrex-vault)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckAgain}
              disabled={isCheckingUpdates || isDownloading}
              className="py-1.5 px-3 bg-vault-surface hover:bg-vault-border border border-vault-border text-vault-textPrimary text-xs rounded font-medium transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin text-vault-lime' : 'text-vault-olive'}`}
              />
              <span>{isCheckingUpdates ? 'Checking...' : 'Check Again'}</span>
            </button>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded flex items-start space-x-2.5 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Update check failed</p>
                <p className="text-[11px] text-red-200/80 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Status Display Area */}
          {isCheckingUpdates ? (
            <div className="py-8 text-center space-y-3 bg-black/30 border border-vault-border/60 rounded-md">
              <RefreshCw className="w-8 h-8 text-vault-lime animate-spin mx-auto" />
              <p className="text-xs text-vault-textSecondary font-medium">
                Checking GitHub for the latest releases...
              </p>
              <p className="text-[10px] text-vault-textMuted">Contacting api.github.com/repos/ziard47/voltrex-vault</p>
            </div>
          ) : updateInfo?.isUpdateAvailable ? (
            /* Update Available Card */
            <div className="p-4 bg-vault-lime/5 border border-vault-lime/30 rounded-lg space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-vault-lime animate-pulse" />
                  <span className="text-xs font-bold text-vault-lime uppercase tracking-wider">
                    New Version Available: v{updateInfo.latestVersion}
                  </span>
                </div>
                {updateInfo.publishedAt && (
                  <span className="text-[10px] text-vault-textMuted font-mono">
                    {new Date(updateInfo.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-vault-textPrimary">
                  {updateInfo.releaseName || `Release v${updateInfo.latestVersion}`}
                </h4>
                <p className="text-[11px] text-vault-textSecondary mt-0.5">
                  An update has been published with new features and improvements.
                </p>
              </div>

              {/* Release Notes */}
              {updateInfo.releaseNotes && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-vault-textMuted">
                    Release Notes
                  </span>
                  <div className="max-h-28 overflow-y-auto p-2.5 bg-black/80 rounded border border-vault-border text-[11px] text-vault-textSecondary font-mono whitespace-pre-wrap leading-relaxed">
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}

              {/* Recommended Asset Detail */}
              {updateInfo.recommendedAsset ? (
                <div className="p-2.5 bg-black/60 rounded border border-vault-border flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    <PackageCheck className="w-4 h-4 text-vault-lime flex-shrink-0" />
                    <span className="font-mono text-vault-textPrimary truncate text-[11px]">
                      {updateInfo.recommendedAsset.name}
                    </span>
                  </div>
                  {updateInfo.recommendedAsset.sizeBytes > 0 && (
                    <span className="text-[10px] text-vault-textMuted font-mono ml-2 flex-shrink-0">
                      {(updateInfo.recommendedAsset.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </div>
              ) : null}

              {/* Realtime Progress Bar */}
              {isDownloading && downloadProgress && (
                <div className="p-3 bg-black border border-vault-border rounded space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-vault-lime font-medium flex items-center space-x-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Downloading update package...</span>
                    </span>
                    <span className="font-mono text-vault-textPrimary font-bold">
                      {downloadProgress.percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-vault-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-vault-lime transition-all duration-200"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-vault-textMuted font-mono">
                    <span>
                      {(downloadProgress.transferredBytes / (1024 * 1024)).toFixed(1)} MB /{' '}
                      {downloadProgress.totalBytes > 0
                        ? `${(downloadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                        : 'calculating...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Completed notification banner */}
              {isDownloaded && (
                <div className="p-3 bg-vault-lime/15 border border-vault-lime/40 rounded space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs text-vault-lime font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    <span>Installer successfully downloaded and ready!</span>
                  </div>
                  {downloadProgress?.savedFilePath && (
                    <p className="text-[10px] text-vault-textMuted font-mono truncate">
                      File: {downloadProgress.savedFilePath}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                {!isDownloaded ? (
                  <button
                    type="button"
                    onClick={handleDownloadAndInstall}
                    disabled={isDownloading || isInstalling}
                    className="w-full py-2.5 px-4 bg-vault-lime hover:bg-vault-limeHover text-black font-semibold text-xs rounded transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 shadow-md"
                  >
                    {isDownloading || isInstalling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Downloading Update...</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownCircle className="w-4 h-4" />
                        <span>Download & Install Update</span>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        downloadProgress?.savedFilePath && openDownloadedFile(downloadProgress.savedFilePath)
                      }
                      className="w-full sm:flex-1 py-2 px-3 bg-vault-lime hover:bg-vault-limeHover text-black font-semibold text-xs rounded transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run Installer Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadProgress?.savedFilePath && showDownloadedInFolder(downloadProgress.savedFilePath)
                      }
                      className="w-full sm:w-auto py-2 px-3 bg-vault-border hover:bg-vault-olive text-vault-textPrimary text-xs rounded transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Show in Folder</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : updateInfo?.hasReleases ? (
            /* Up to Date Card */
            <div className="p-6 bg-[#0c0e09] border border-vault-border rounded-lg text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-vault-lime/10 border border-vault-lime/30 flex items-center justify-center text-vault-lime mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-vault-textPrimary">Voltrex Vault is up to date</h4>
                <p className="text-xs text-vault-textSecondary">
                  You are currently running the latest version (v{updateInfo.currentVersion}).
                </p>
              </div>
              <p className="text-[10px] text-vault-textMuted">
                No new updates are available on GitHub Releases at this time.
              </p>
            </div>
          ) : (
            /* No Releases Card */
            <div className="p-5 bg-[#0c0e09] border border-vault-border rounded-lg text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-vault-surface border border-vault-border flex items-center justify-center text-vault-olive mx-auto">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-vault-textPrimary">
                  Running Version v{updateInfo?.currentVersion || '1.0.0'}
                </h4>
                <p className="text-[11px] text-vault-textSecondary mt-1">
                  No published release packages have been uploaded to GitHub yet.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-black/40 border-t border-vault-border flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => openReleasePage(updateInfo?.releaseUrl)}
            className="text-vault-textSecondary hover:text-vault-lime text-[11px] flex items-center space-x-1 transition-colors"
          >
            <span>View Releases on GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={closeCheckUpdates}
            disabled={isDownloading}
            className="py-1 px-4 bg-vault-surface hover:bg-vault-border text-vault-textSecondary hover:text-vault-textPrimary text-xs rounded transition-colors disabled:opacity-40"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
