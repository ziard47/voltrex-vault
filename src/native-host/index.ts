#!/usr/bin/env node
/**
 * Voltrex Vault - Chrome Native Messaging Host Entry Point
 * Mediates between Chrome's stdio Native Messaging interface and the Desktop Domain Socket.
 * Enforces protocol limits, request IDs, timeouts, and structured error responses.
 */

import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { readNativeMessage, encodeNativeMessage } from './protocol';
import { NativeRequest, NativeResponse } from '../shared/extension-types';

export function resolveDefaultBridgeSocket(): string {
  if (process.env.VOLTREX_SOCKET_PATH) {
    return process.env.VOLTREX_SOCKET_PATH;
  }

  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\voltrex-vault-bridge';
  }

  // On Linux/macOS, determine standard Electron userData location
  const home = os.homedir();
  let baseDir: string;
  if (process.platform === 'darwin') {
    baseDir = path.join(home, 'Library', 'Application Support', 'voltrex-vault');
  } else {
    // Linux standard XDG config home
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    baseDir = path.join(xdgConfig, 'voltrex-vault');
  }

  return path.join(baseDir, 'voltrex_bridge.sock');
}

/**
 * Sends a request to the desktop bridge domain socket with timeout.
 */
export async function forwardToBridge(
  request: NativeRequest,
  socketPath = resolveDefaultBridgeSocket(),
  timeoutMs = 5000
): Promise<NativeResponse> {
  // If socket file doesn't exist on Unix, desktop app is not running
  if (process.platform !== 'win32' && !fs.existsSync(socketPath)) {
    return {
      id: request.id,
      success: true,
      data: { isAppRunning: false, isUnlocked: false },
    };
  }

  return new Promise(resolve => {
    let client: net.Socket | null = null;
    let timer: NodeJS.Timeout | null = null;
    let responseData = '';

    const cleanup = () => {
      if (timer) clearTimeout(timer);
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

    client = net.createConnection(socketPath, () => {
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
          resolve(parsed as NativeResponse);
        } catch {
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
async function main(): Promise<void> {
  // Process requests as they arrive on stdin
  while (true) {
    try {
      const request = await readNativeMessage(process.stdin);
      if (!request) {
        // EOF reached; extension disconnected
        break;
      }

      const response = await forwardToBridge(request);
      const encoded = encodeNativeMessage(response);
      process.stdout.write(encoded);
    } catch (err: any) {
      const errorResponse: NativeResponse = {
        id: 'unknown',
        success: false,
        error: err.message || 'Fatal error processing native message.',
      };
      try {
        const encoded = encodeNativeMessage(errorResponse);
        process.stdout.write(encoded);
      } catch {
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
