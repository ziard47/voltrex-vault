"use strict";
/**
 * Voltrex Vault - Google Drive & OAuth 2.0 PKCE Service
 * Implements installed-app OAuth 2.0 flow with PKCE, safeStorage encryption,
 * and zero-knowledge Drive API file operations using the narrow drive.file scope.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveService = exports.DEFAULT_GOOGLE_CLIENT_ID = void 0;
const electron_1 = require("electron");
const node_http_1 = __importDefault(require("node:http"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const container_1 = require("../backup/container");
// Default Client ID for Voltrex Vault desktop app (or user can configure their own GCP Client ID)
exports.DEFAULT_GOOGLE_CLIENT_ID = process.env.VOLTREX_GOOGLE_CLIENT_ID ||
    '684994821639-desktopvoltrexvault.apps.googleusercontent.com';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file', // Narrowest scope: files created by Voltrex Vault only
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
].join(' ');
class GoogleDriveService {
    tokenStoragePath;
    clientId;
    accessToken = null;
    tokenExpiresAt = 0;
    refreshToken = null;
    account = null;
    constructor(userDataPath, initialClientId) {
        this.tokenStoragePath = node_path_1.default.join(userDataPath, 'gdrive_tokens.enc');
        this.clientId = initialClientId?.trim() || exports.DEFAULT_GOOGLE_CLIENT_ID;
        this.loadStoredTokens();
    }
    getClientId() {
        return this.clientId;
    }
    setClientId(clientId) {
        this.clientId = clientId.trim() || exports.DEFAULT_GOOGLE_CLIENT_ID;
    }
    isConnected() {
        return this.refreshToken !== null;
    }
    getAccount() {
        return this.account;
    }
    /**
     * Loads and decrypts tokens from OS-protected safeStorage.
     */
    loadStoredTokens() {
        if (!node_fs_1.default.existsSync(this.tokenStoragePath))
            return;
        try {
            const encryptedBuffer = node_fs_1.default.readFileSync(this.tokenStoragePath);
            let decryptedStr;
            if (electron_1.safeStorage.isEncryptionAvailable()) {
                decryptedStr = electron_1.safeStorage.decryptString(encryptedBuffer);
            }
            else {
                // Fallback decryption if safeStorage is unavailable in headless/CI test environments
                decryptedStr = encryptedBuffer.toString('utf8');
            }
            const tokens = JSON.parse(decryptedStr);
            if (tokens.refreshToken) {
                this.refreshToken = tokens.refreshToken;
                this.account = tokens.account || null;
                if (tokens.clientId) {
                    this.clientId = tokens.clientId;
                }
            }
        }
        catch (err) {
            console.error('[GoogleDriveService] Failed to load stored tokens:', err.message);
        }
    }
    /**
     * Persists tokens securely with safeStorage and restrictive file permissions.
     */
    persistTokens() {
        try {
            if (!this.refreshToken) {
                if (node_fs_1.default.existsSync(this.tokenStoragePath)) {
                    node_fs_1.default.unlinkSync(this.tokenStoragePath);
                }
                return;
            }
            const payload = {
                refreshToken: this.refreshToken,
                clientId: this.clientId,
                account: this.account || undefined,
            };
            const jsonStr = JSON.stringify(payload);
            let bufferToWrite;
            if (electron_1.safeStorage.isEncryptionAvailable()) {
                bufferToWrite = electron_1.safeStorage.encryptString(jsonStr);
            }
            else {
                bufferToWrite = Buffer.from(jsonStr, 'utf8');
            }
            node_fs_1.default.writeFileSync(this.tokenStoragePath, bufferToWrite, { mode: 0o600 });
        }
        catch (err) {
            console.error('[GoogleDriveService] Failed to persist tokens:', err.message);
        }
    }
    /**
     * Initiates the OAuth 2.0 PKCE flow on a loopback HTTP server.
     */
    async connect() {
        const codeVerifier = node_crypto_1.default.randomBytes(32).toString('base64url');
        const codeChallenge = node_crypto_1.default.createHash('sha256').update(codeVerifier).digest('base64url');
        const state = node_crypto_1.default.randomBytes(16).toString('hex');
        return new Promise((resolve, reject) => {
            const server = node_http_1.default.createServer();
            const timeoutTimer = setTimeout(() => {
                try {
                    server.close();
                }
                catch { /* ignore */ }
                reject(new Error('Google authorization timed out after 3 minutes.'));
            }, 180000);
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (!address || typeof address === 'string') {
                    clearTimeout(timeoutTimer);
                    reject(new Error('Failed to bind local loopback server.'));
                    return;
                }
                const port = address.port;
                const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
                server.on('request', async (req, res) => {
                    try {
                        if (!req.url || !req.url.startsWith('/oauth2callback')) {
                            res.writeHead(404);
                            res.end('Not found');
                            return;
                        }
                        const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
                        const error = parsedUrl.searchParams.get('error');
                        const code = parsedUrl.searchParams.get('code');
                        const incomingState = parsedUrl.searchParams.get('state');
                        if (error) {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end('<html><body style="font-family:sans-serif;background:#000;color:#fff;text-align:center;padding:50px;"><h2>Authorization Cancelled</h2><p>You can close this tab.</p></body></html>');
                            clearTimeout(timeoutTimer);
                            server.close();
                            reject(new Error(`Google authorization error: ${error}`));
                            return;
                        }
                        if (incomingState !== state) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end('State verification mismatch.');
                            clearTimeout(timeoutTimer);
                            server.close();
                            reject(new Error('State verification failed. CSRF security check triggered.'));
                            return;
                        }
                        if (!code) {
                            res.writeHead(400);
                            res.end('Missing code parameter.');
                            clearTimeout(timeoutTimer);
                            server.close();
                            reject(new Error('Authorization code missing.'));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
              <!DOCTYPE html>
              <html>
                <body style="background:#000;color:#f4f6f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                  <div style="background:#0c0d0a;border:1px solid #3E432E;padding:32px;border-radius:6px;text-align:center;max-width:400px;">
                    <h3 style="color:#A7D129;margin-top:0;">Voltrex Vault Connected</h3>
                    <p style="font-size:14px;color:#a2a894;">Google Drive authorization successful. You may close this tab and return to the desktop application.</p>
                  </div>
                </body>
              </html>
            `);
                        clearTimeout(timeoutTimer);
                        server.close();
                        // Exchange Authorization Code for Tokens
                        const tokens = await this.exchangeCodeForTokens(code, codeVerifier, redirectUri);
                        this.accessToken = tokens.access_token;
                        this.tokenExpiresAt = Date.now() + (tokens.expires_in - 60) * 1000;
                        if (tokens.refresh_token) {
                            this.refreshToken = tokens.refresh_token;
                        }
                        // Fetch user profile
                        const account = await this.fetchAccountProfile(tokens.access_token);
                        this.account = account;
                        this.persistTokens();
                        resolve(account);
                    }
                    catch (exchangeErr) {
                        clearTimeout(timeoutTimer);
                        try {
                            server.close();
                        }
                        catch { /* ignore */ }
                        reject(exchangeErr);
                    }
                });
                // Launch authorization URL in user's default browser
                const authParams = new URLSearchParams({
                    client_id: this.clientId,
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    scope: SCOPES,
                    code_challenge: codeChallenge,
                    code_challenge_method: 'S256',
                    state,
                    access_type: 'offline',
                    prompt: 'consent',
                });
                const authUrl = `${GOOGLE_AUTH_URL}?${authParams.toString()}`;
                electron_1.shell.openExternal(authUrl).catch(() => { });
            });
        });
    }
    async exchangeCodeForTokens(code, codeVerifier, redirectUri) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
        });
        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Token exchange failed (${response.status}): ${errText}`);
        }
        return (await response.json());
    }
    async fetchAccountProfile(accessToken) {
        const response = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            return { email: 'Connected Google Account', name: 'Google User' };
        }
        const data = await response.json();
        return {
            email: data.email || 'Unknown Email',
            name: data.name || 'Google User',
            picture: data.picture,
        };
    }
    /**
     * Returns a valid access token, refreshing automatically via refresh_token if expired.
     */
    async getValidAccessToken() {
        if (!this.refreshToken) {
            throw new Error('Google Drive is not connected. Please connect your account first.');
        }
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }
        // Refresh access token
        const params = new URLSearchParams({
            client_id: this.clientId,
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token',
        });
        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        if (!response.ok) {
            if (response.status === 400 || response.status === 401) {
                // Token was revoked or expired
                this.refreshToken = null;
                this.account = null;
                this.persistTokens();
                throw new Error('Google Drive authorization has been revoked or expired. Please reconnect.');
            }
            throw new Error(`Failed to refresh Google token (${response.status})`);
        }
        const data = (await response.json());
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
        return this.accessToken;
    }
    /**
     * Lists existing backup files created by Voltrex Vault.
     */
    async listBackups() {
        const accessToken = await this.getValidAccessToken();
        const query = "name contains 'voltrex_vault_backup_' and trashed = false";
        const url = `${GOOGLE_DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime,appProperties)&orderBy=createdTime desc&pageSize=50`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to query Google Drive files (${response.status}): ${err}`);
        }
        const data = await response.json();
        if (!data.files)
            return [];
        return data.files.map(f => ({
            fileId: f.id,
            name: f.name,
            sizeBytes: Number(f.size || 0),
            createdAt: new Date(f.createdTime).getTime(),
            vaultId: f.appProperties?.voltrexVaultId,
            backupId: f.appProperties?.backupId,
        }));
    }
    /**
     * Uploads an encrypted backup container to Google Drive using multipart upload.
     */
    async uploadBackup(container) {
        const accessToken = await this.getValidAccessToken();
        const fileName = `voltrex_vault_backup_${container.vaultId.slice(0, 8)}_${container.createdAt}.json.enc`;
        const boundary = `-------VoltrexBoundary${Date.now()}`;
        const metadata = {
            name: fileName,
            mimeType: 'application/octet-stream',
            appProperties: {
                voltrexVaultId: container.vaultId,
                backupId: container.backupId,
                itemCount: String(container.itemCount),
                createdAt: String(container.createdAt),
            },
        };
        const containerJson = JSON.stringify(container, null, 2);
        const multipartBody = `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n` +
            `${containerJson}\r\n` +
            `--${boundary}--`;
        const response = await fetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Google Drive backup upload failed (${response.status}): ${err}`);
        }
        const resData = await response.json();
        return {
            fileId: resData.id,
            name: resData.name,
        };
    }
    /**
     * Downloads an encrypted backup container from Google Drive.
     */
    async downloadBackup(fileId) {
        const accessToken = await this.getValidAccessToken();
        const url = `${GOOGLE_DRIVE_FILES_URL}/${fileId}?alt=media`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Failed to download backup from Google Drive (${response.status}): ${err}`);
        }
        const rawJson = await response.json();
        return (0, container_1.validateBackupContainerSchema)(rawJson);
    }
    /**
     * Prunes oldest backups beyond the retention limit.
     * NEVER deletes the last remaining known-good backup.
     */
    async pruneOldBackups(retentionCount) {
        if (retentionCount <= 0)
            return 0;
        const backups = await this.listBackups();
        if (backups.length <= retentionCount) {
            return 0;
        }
        // Sort by createdAt descending
        const sorted = [...backups].sort((a, b) => b.createdAt - a.createdAt);
        // Keep top retentionCount, delete remaining
        const toDelete = sorted.slice(retentionCount);
        const accessToken = await this.getValidAccessToken();
        let deletedCount = 0;
        for (const file of toDelete) {
            try {
                const delRes = await fetch(`${GOOGLE_DRIVE_FILES_URL}/${file.fileId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (delRes.ok) {
                    deletedCount++;
                }
            }
            catch {
                // Continue attempting remaining files
            }
        }
        return deletedCount;
    }
    /**
     * Disconnects Google account, revokes token, and clears secure storage.
     */
    async disconnect() {
        if (this.refreshToken) {
            try {
                await fetch(`${GOOGLE_REVOKE_URL}?token=${this.refreshToken}`, { method: 'POST' });
            }
            catch {
                // Ignored
            }
        }
        this.accessToken = null;
        this.refreshToken = null;
        this.account = null;
        this.tokenExpiresAt = 0;
        this.persistTokens();
    }
}
exports.GoogleDriveService = GoogleDriveService;
