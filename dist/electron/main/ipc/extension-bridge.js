"use strict";
/**
 * Voltrex Vault - Desktop Extension IPC Bridge
 * Exposes a strictly authenticated, local-only domain socket server for the Native Messaging Host.
 * Implements command allowlisting, origin matching verification, and credential access control.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionBridgeServer = void 0;
exports.getBridgeSocketPath = getBridgeSocketPath;
const node_net_1 = __importDefault(require("node:net"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const generator_1 = require("../crypto/generator");
const extension_types_1 = require("../../shared/extension-types");
const origin_1 = require("../../shared/origin");
const validation_1 = require("../../shared/validation");
function getBridgeSocketPath(userDataPath) {
    if (process.platform === 'win32') {
        return '\\\\.\\pipe\\voltrex-vault-bridge';
    }
    return node_path_1.default.join(userDataPath, 'voltrex_bridge.sock');
}
class ExtensionBridgeServer {
    server = null;
    socketPath;
    vaultService;
    constructor(vaultService, userDataPath) {
        this.vaultService = vaultService;
        this.socketPath = getBridgeSocketPath(userDataPath);
    }
    getSocketPath() {
        return this.socketPath;
    }
    async start() {
        // If a stale socket file exists on Unix, unlink it
        if (process.platform !== 'win32' && node_fs_1.default.existsSync(this.socketPath)) {
            try {
                node_fs_1.default.unlinkSync(this.socketPath);
            }
            catch (err) {
                console.warn('[ExtensionBridge] Could not remove stale socket:', err);
            }
        }
        return new Promise((resolve, reject) => {
            this.server = node_net_1.default.createServer(socket => {
                this.handleConnection(socket);
            });
            this.server.on('error', err => {
                console.error('[ExtensionBridge] Server error:', err.message);
                reject(err);
            });
            this.server.listen(this.socketPath, () => {
                // Enforce 0600 file permissions on Unix domain socket
                if (process.platform !== 'win32') {
                    try {
                        node_fs_1.default.chmodSync(this.socketPath, 0o600);
                    }
                    catch (e) {
                        console.warn('[ExtensionBridge] Failed to set 0600 on socket file:', e);
                    }
                }
                resolve();
            });
        });
    }
    handleConnection(socket) {
        let buffer = '';
        socket.on('data', async (chunk) => {
            buffer += chunk.toString('utf8');
            // Process newline-delimited JSON messages from the native host
            let delimiterIndex;
            while ((delimiterIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, delimiterIndex).trim();
                buffer = buffer.slice(delimiterIndex + 1);
                if (!line)
                    continue;
                try {
                    const request = JSON.parse(line);
                    const response = await this.processRequest(request);
                    socket.write(JSON.stringify(response) + '\n');
                }
                catch (err) {
                    const errorResponse = {
                        id: 'unknown',
                        success: false,
                        error: err.message || 'Malformed request received by bridge.',
                    };
                    socket.write(JSON.stringify(errorResponse) + '\n');
                }
            }
        });
        socket.on('error', () => {
            // Client disconnected or error occurred
        });
    }
    async processRequest(request) {
        if (!request || typeof request !== 'object' || !request.id || !request.action) {
            return {
                id: request?.id || 'invalid',
                success: false,
                error: 'Malformed request: missing id or action.',
            };
        }
        if (!extension_types_1.ALLOWED_NATIVE_ACTIONS.has(request.action)) {
            return {
                id: request.id,
                success: false,
                error: `Action '${request.action}' is rejected: not in allowlist.`,
            };
        }
        try {
            switch (request.action) {
                case 'status': {
                    const status = this.vaultService.getStatus();
                    const meta = this.vaultService.getRepository().getMetadata();
                    const data = {
                        isAppRunning: true,
                        isUnlocked: status.isUnlocked,
                        vaultId: meta?.vaultId,
                        itemCount: status.itemCount,
                    };
                    return { id: request.id, success: true, data };
                }
                case 'search-logins': {
                    const status = this.vaultService.getStatus();
                    if (!status.isUnlocked) {
                        return { id: request.id, success: false, error: 'Vault is locked.' };
                    }
                    const { origin } = (request.payload || {});
                    const canonicalOrigin = (0, origin_1.getCanonicalOrigin)(origin);
                    if (!canonicalOrigin) {
                        return { id: request.id, success: false, error: 'Invalid or missing origin.' };
                    }
                    const entries = this.vaultService.listEntries(false);
                    const matched = [];
                    for (const entry of entries) {
                        if (entry.type !== 'login')
                            continue;
                        const login = entry.payload;
                        if (!login.url)
                            continue;
                        if ((0, origin_1.doOriginsMatch)(login.url, canonicalOrigin)) {
                            matched.push({
                                id: entry.id,
                                title: entry.title,
                                username: login.username,
                                url: login.url,
                            });
                        }
                    }
                    return { id: request.id, success: true, data: matched };
                }
                case 'get-login': {
                    const status = this.vaultService.getStatus();
                    if (!status.isUnlocked) {
                        return { id: request.id, success: false, error: 'Vault is locked.' };
                    }
                    const { id, origin } = (request.payload || {});
                    const canonicalOrigin = (0, origin_1.getCanonicalOrigin)(origin);
                    if (!canonicalOrigin) {
                        return { id: request.id, success: false, error: 'Invalid origin.' };
                    }
                    if (!(0, origin_1.isAllowedAutofillOrigin)(canonicalOrigin)) {
                        return {
                            id: request.id,
                            success: false,
                            error: 'Insecure HTTP origin rejected for credential retrieval.',
                        };
                    }
                    const entry = this.vaultService.getEntry(id);
                    if (!entry || entry.type !== 'login') {
                        return { id: request.id, success: false, error: 'Login entry not found.' };
                    }
                    const login = entry.payload;
                    if (!login.url || !(0, origin_1.doOriginsMatch)(login.url, canonicalOrigin)) {
                        return {
                            id: request.id,
                            success: false,
                            error: `Authorization denied: entry url does not match requesting origin (${canonicalOrigin}).`,
                        };
                    }
                    const credentials = {
                        id: entry.id,
                        username: login.username,
                        password: login.password,
                        url: login.url,
                    };
                    return { id: request.id, success: true, data: credentials };
                }
                case 'generate-password': {
                    const result = (0, generator_1.generateSecurePassword)(request.payload);
                    return { id: request.id, success: true, data: result };
                }
                case 'save-login': {
                    const status = this.vaultService.getStatus();
                    if (!status.isUnlocked) {
                        return { id: request.id, success: false, error: 'Vault is locked.' };
                    }
                    const payload = (request.payload || {});
                    const canonicalOrigin = (0, origin_1.getCanonicalOrigin)(payload.origin);
                    if (!canonicalOrigin) {
                        return { id: request.id, success: false, error: 'Invalid login origin.' };
                    }
                    const username = (0, validation_1.validateString)(payload.username, 'username', 1, 200);
                    const password = (0, validation_1.validateString)(payload.password, 'password', 1, 500);
                    const title = payload.title?.trim() || new URL(canonicalOrigin).hostname;
                    const url = payload.url || canonicalOrigin;
                    // Check for existing login on this origin with same username to update
                    const allEntries = this.vaultService.listEntries(false);
                    const existing = allEntries.find(e => e.type === 'login' &&
                        e.payload.username.toLowerCase() === username.toLowerCase() &&
                        (0, origin_1.doOriginsMatch)(e.payload.url || '', canonicalOrigin));
                    const saved = this.vaultService.saveEntry({
                        id: existing?.id,
                        type: 'login',
                        title,
                        isFavorite: existing?.isFavorite || false,
                        payload: {
                            type: 'login',
                            title,
                            username,
                            password,
                            url,
                            notes: existing?.payload.notes,
                            tags: existing?.payload.tags,
                        },
                    });
                    return { id: request.id, success: true, data: { id: saved.id, title: saved.title } };
                }
                case 'lock-vault': {
                    this.vaultService.lockVault();
                    return { id: request.id, success: true, data: { isUnlocked: false } };
                }
                default:
                    return { id: request.id, success: false, error: 'Unhandled action.' };
            }
        }
        catch (err) {
            return { id: request.id, success: false, error: err.message || 'Operation failed.' };
        }
    }
    close() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        if (process.platform !== 'win32' && node_fs_1.default.existsSync(this.socketPath)) {
            try {
                node_fs_1.default.unlinkSync(this.socketPath);
            }
            catch {
                // ignore
            }
        }
    }
}
exports.ExtensionBridgeServer = ExtensionBridgeServer;
