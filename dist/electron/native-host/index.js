#!/usr/bin/env node
"use strict";
/**
 * Voltrex Vault - Chrome Native Messaging Host Entry Point
 * Mediates between Chrome's stdio Native Messaging interface and the Desktop Domain Socket.
 * Enforces protocol limits, request IDs, timeouts, and structured error responses.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDefaultBridgeSocket = resolveDefaultBridgeSocket;
exports.forwardToBridge = forwardToBridge;
const node_net_1 = __importDefault(require("node:net"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
const node_fs_1 = __importDefault(require("node:fs"));
const protocol_1 = require("./protocol");
function resolveDefaultBridgeSocket() {
    if (process.env.VOLTREX_SOCKET_PATH) {
        return process.env.VOLTREX_SOCKET_PATH;
    }
    if (process.platform === 'win32') {
        return '\\\\.\\pipe\\voltrex-vault-bridge';
    }
    // On Linux/macOS, determine standard Electron userData location
    const home = node_os_1.default.homedir();
    let baseDir;
    if (process.platform === 'darwin') {
        baseDir = node_path_1.default.join(home, 'Library', 'Application Support', 'voltrex-vault');
    }
    else {
        // Linux standard XDG config home
        const xdgConfig = process.env.XDG_CONFIG_HOME || node_path_1.default.join(home, '.config');
        baseDir = node_path_1.default.join(xdgConfig, 'voltrex-vault');
        const primaryPath = node_path_1.default.join(baseDir, 'voltrex_bridge.sock');
        if (node_fs_1.default.existsSync(primaryPath)) {
            return primaryPath;
        }
        // Dev fallback if Electron was launched without custom app.name
        const devPath = node_path_1.default.join(xdgConfig, 'Electron', 'voltrex_bridge.sock');
        if (node_fs_1.default.existsSync(devPath)) {
            return devPath;
        }
    }
    return node_path_1.default.join(baseDir, 'voltrex_bridge.sock');
}
/**
 * Sends a request to the desktop bridge domain socket with timeout.
 */
async function forwardToBridge(request, socketPath = resolveDefaultBridgeSocket(), timeoutMs = 5000) {
    // If socket file doesn't exist on Unix, desktop app is not running
    if (process.platform !== 'win32' && !node_fs_1.default.existsSync(socketPath)) {
        return {
            id: request.id,
            success: true,
            data: { isAppRunning: false, isUnlocked: false },
        };
    }
    return new Promise(resolve => {
        let client = null;
        let timer = null;
        let responseData = '';
        const cleanup = () => {
            if (timer)
                clearTimeout(timer);
            if (client) {
                client.destroy();
                client = null;
            }
        };
        timer = setTimeout(() => {
            cleanup();
            resolve({
                id: request.id,
                success: false,
                error: 'Desktop bridge request timed out after 5000ms.',
            });
        }, timeoutMs);
        client = node_net_1.default.createConnection(socketPath, () => {
            client?.write(JSON.stringify(request) + '\n');
        });
        client.on('data', chunk => {
            responseData += chunk.toString('utf8');
            const newlineIndex = responseData.indexOf('\n');
            if (newlineIndex !== -1) {
                const line = responseData.slice(0, newlineIndex).trim();
                cleanup();
                try {
                    const parsed = JSON.parse(line);
                    resolve(parsed);
                }
                catch {
                    resolve({
                        id: request.id,
                        success: false,
                        error: 'Failed to parse response from desktop bridge.',
                    });
                }
            }
        });
        client.on('error', err => {
            cleanup();
            // Connection refused means desktop app is closed
            resolve({
                id: request.id,
                success: true,
                data: { isAppRunning: false, isUnlocked: false },
            });
        });
    });
}
/**
 * Main event loop processing stdin messages sequentially.
 */
async function main() {
    // Process requests as they arrive on stdin
    while (true) {
        try {
            const request = await (0, protocol_1.readNativeMessage)(process.stdin);
            if (!request) {
                // EOF reached; extension disconnected
                break;
            }
            const response = await forwardToBridge(request);
            const encoded = (0, protocol_1.encodeNativeMessage)(response);
            process.stdout.write(encoded);
        }
        catch (err) {
            const errorResponse = {
                id: 'unknown',
                success: false,
                error: err.message || 'Fatal error processing native message.',
            };
            try {
                const encoded = (0, protocol_1.encodeNativeMessage)(errorResponse);
                process.stdout.write(encoded);
            }
            catch {
                // Exit if stdout write fails
                break;
            }
        }
    }
}
// Only execute loop if run directly as CLI/host
if (require.main === module) {
    main().catch(() => process.exit(1));
}
