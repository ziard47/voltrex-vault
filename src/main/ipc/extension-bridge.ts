/**
 * Voltrex Vault - Desktop Extension IPC Bridge
 * Exposes a strictly authenticated, local-only domain socket server for the Native Messaging Host.
 * Implements command allowlisting, origin matching verification, and credential access control.
 */

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VaultService } from '../services/vault-service';
import { generateSecurePassword } from '../crypto/generator';
import {
  NativeRequest,
  NativeResponse,
  ALLOWED_NATIVE_ACTIONS,
  MatchedLogin,
  ApprovedLoginCredentials,
  SaveLoginRequest,
  SearchLoginsRequest,
  GetLoginRequest,
  ExtensionStatus,
} from '../../shared/extension-types';
import { doOriginsMatch, getCanonicalOrigin, isAllowedAutofillOrigin } from '../../shared/origin';
import { LoginPayload } from '../../shared/types';
import { validateString } from '../../shared/validation';

export function getBridgeSocketPath(userDataPath: string): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\voltrex-vault-bridge';
  }
  return path.join(userDataPath, 'voltrex_bridge.sock');
}

export class ExtensionBridgeServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private vaultService: VaultService;

  constructor(vaultService: VaultService, userDataPath: string) {
    this.vaultService = vaultService;
    this.socketPath = getBridgeSocketPath(userDataPath);
  }

  public getSocketPath(): string {
    return this.socketPath;
  }

  public async start(): Promise<void> {
    // If a stale socket file exists on Unix, unlink it
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch (err) {
        console.warn('[ExtensionBridge] Could not remove stale socket:', err);
      }
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer(socket => {
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
            fs.chmodSync(this.socketPath, 0o600);
          } catch (e) {
            console.warn('[ExtensionBridge] Failed to set 0600 on socket file:', e);
          }
        }
        resolve();
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', async chunk => {
      buffer += chunk.toString('utf8');

      // Process newline-delimited JSON messages from the native host
      let delimiterIndex: number;
      while ((delimiterIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, delimiterIndex).trim();
        buffer = buffer.slice(delimiterIndex + 1);

        if (!line) continue;

        try {
          const request: NativeRequest = JSON.parse(line);
          const response = await this.processRequest(request);
          socket.write(JSON.stringify(response) + '\n');
        } catch (err: any) {
          const errorResponse: NativeResponse = {
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

  public async processRequest(request: NativeRequest): Promise<NativeResponse> {
    if (!request || typeof request !== 'object' || !request.id || !request.action) {
      return {
        id: request?.id || 'invalid',
        success: false,
        error: 'Malformed request: missing id or action.',
      };
    }

    if (!ALLOWED_NATIVE_ACTIONS.has(request.action)) {
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
          const data: ExtensionStatus = {
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

          const { origin } = (request.payload || {}) as SearchLoginsRequest;
          const canonicalOrigin = getCanonicalOrigin(origin);
          if (!canonicalOrigin) {
            return { id: request.id, success: false, error: 'Invalid or missing origin.' };
          }

          const entries = this.vaultService.listEntries(false);
          const matched: MatchedLogin[] = [];

          for (const entry of entries) {
            if (entry.type !== 'login') continue;
            const login = entry.payload as LoginPayload;
            if (!login.url) continue;

            if (doOriginsMatch(login.url, canonicalOrigin)) {
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

          const { id, origin } = (request.payload || {}) as GetLoginRequest;
          const canonicalOrigin = getCanonicalOrigin(origin);
          if (!canonicalOrigin) {
            return { id: request.id, success: false, error: 'Invalid origin.' };
          }

          if (!isAllowedAutofillOrigin(canonicalOrigin)) {
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

          const login = entry.payload as LoginPayload;
          if (!login.url || !doOriginsMatch(login.url, canonicalOrigin)) {
            return {
              id: request.id,
              success: false,
              error: `Authorization denied: entry url does not match requesting origin (${canonicalOrigin}).`,
            };
          }

          const credentials: ApprovedLoginCredentials = {
            id: entry.id,
            username: login.username,
            password: login.password,
            url: login.url,
          };
          return { id: request.id, success: true, data: credentials };
        }

        case 'generate-password': {
          const result = generateSecurePassword(request.payload);
          return { id: request.id, success: true, data: result };
        }

        case 'save-login': {
          const status = this.vaultService.getStatus();
          if (!status.isUnlocked) {
            return { id: request.id, success: false, error: 'Vault is locked.' };
          }

          const payload = (request.payload || {}) as SaveLoginRequest;
          const canonicalOrigin = getCanonicalOrigin(payload.origin);
          if (!canonicalOrigin) {
            return { id: request.id, success: false, error: 'Invalid login origin.' };
          }

          const username = validateString(payload.username, 'username', 1, 200);
          const password = validateString(payload.password, 'password', 1, 500);
          const title = payload.title?.trim() || new URL(canonicalOrigin).hostname;
          const url = payload.url || canonicalOrigin;

          // Check for existing login on this origin with same username to update
          const allEntries = this.vaultService.listEntries(false);
          const existing = allEntries.find(
            e =>
              e.type === 'login' &&
              (e.payload as LoginPayload).username.toLowerCase() === username.toLowerCase() &&
              doOriginsMatch((e.payload as LoginPayload).url || '', canonicalOrigin)
          );

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
    } catch (err: any) {
      return { id: request.id, success: false, error: err.message || 'Operation failed.' };
    }
  }

  public close(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (process.platform !== 'win32' && fs.existsSync(this.socketPath)) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // ignore
      }
    }
  }
}
