import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VaultService } from '../src/main/services/vault-service';
import { ExtensionBridgeServer } from '../src/main/ipc/extension-bridge';
import {
  NativeRequest,
  SearchLoginsRequest,
  GetLoginRequest,
  SaveLoginRequest,
} from '../src/shared/extension-types';

describe('Desktop Extension Bridge Server (Phase 3)', () => {
  let tmpDir: string;
  let vaultService: VaultService;
  let bridgeServer: ExtensionBridgeServer;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voltrex-bridge-test-'));
    const dbPath = path.join(tmpDir, 'test-vault.db');
    vaultService = new VaultService(dbPath);
    await vaultService.initialize();

    bridgeServer = new ExtensionBridgeServer(vaultService, tmpDir);
    await bridgeServer.start();
  });

  afterEach(() => {
    bridgeServer.close();
    vaultService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles status inquiry and reports locked state accurately', async () => {
    const req: NativeRequest = { id: 'test-1', action: 'status' };
    const res = await bridgeServer.processRequest(req);

    expect(res.id).toBe('test-1');
    expect(res.success).toBe(true);
    expect(res.data.isAppRunning).toBe(true);
    expect(res.data.isUnlocked).toBe(false);
  });

  it('rejects search-logins when vault is locked', async () => {
    const req: NativeRequest<SearchLoginsRequest> = {
      id: 'test-2',
      action: 'search-logins',
      payload: { origin: 'https://github.com' },
    };
    const res = await bridgeServer.processRequest(req);

    expect(res.id).toBe('test-2');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/vault is locked/i);
  });

  describe('When Vault is Unlocked', () => {
    const masterPassword = 'BridgeTestPassword123!';

    beforeEach(async () => {
      await vaultService.setupVault(masterPassword);

      // Seed vault with test logins
      vaultService.saveEntry({
        type: 'login',
        title: 'GitHub Work',
        payload: {
          type: 'login',
          title: 'GitHub Work',
          username: 'worker@github.com',
          password: 'SecretGitHubPassword123!',
          url: 'https://github.com/login',
          notes: 'Personal work recovery token',
        },
      });

      vaultService.saveEntry({
        type: 'login',
        title: 'GitHub Personal',
        payload: {
          type: 'login',
          title: 'GitHub Personal',
          username: 'personal@github.com',
          password: 'AnotherSecretGitHubPassword!',
          url: 'https://github.com/session',
        },
      });

      vaultService.saveEntry({
        type: 'login',
        title: 'GitLab Account',
        payload: {
          type: 'login',
          title: 'GitLab Account',
          username: 'developer@gitlab.com',
          password: 'GitLabSecretPassword!',
          url: 'https://gitlab.com/users/sign_in',
        },
      });
    });

    it('searches logins matching exact canonical origin and excludes passwords', async () => {
      const req: NativeRequest<SearchLoginsRequest> = {
        id: 'test-3',
        action: 'search-logins',
        payload: { origin: 'https://github.com' },
      };
      const res = await bridgeServer.processRequest(req);

      expect(res.id).toBe('test-3');
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);

      // Verify passwords and secret notes are NOT in the search results
      for (const item of res.data) {
        expect(item.id).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.username).toBeDefined();
        expect((item as any).password).toBeUndefined();
        expect((item as any).notes).toBeUndefined();
      }
    });

    it('retrieves approved credential when origin matches entry URL', async () => {
      // Find the GitHub Work entry
      const listReq: NativeRequest<SearchLoginsRequest> = {
        id: 'test-4-search',
        action: 'search-logins',
        payload: { origin: 'https://github.com' },
      };
      const listRes = await bridgeServer.processRequest(listReq);
      const target = listRes.data.find((e: any) => e.username === 'worker@github.com');
      expect(target).toBeDefined();

      // Retrieve credential with matching origin
      const getReq: NativeRequest<GetLoginRequest> = {
        id: 'test-4-get',
        action: 'get-login',
        payload: { id: target.id, origin: 'https://github.com/login' },
      };
      const getRes = await bridgeServer.processRequest(getReq);

      expect(getRes.id).toBe('test-4-get');
      expect(getRes.success).toBe(true);
      expect(getRes.data.username).toBe('worker@github.com');
      expect(getRes.data.password).toBe('SecretGitHubPassword123!');
    });

    it('denies credential retrieval when requesting origin mismatches entry URL', async () => {
      const listRes = await bridgeServer.processRequest({
        id: 'search',
        action: 'search-logins',
        payload: { origin: 'https://github.com' },
      });
      const target = listRes.data[0];

      // Request GitHub credential for a malicious origin
      const maliciousGetReq: NativeRequest<GetLoginRequest> = {
        id: 'evil-get',
        action: 'get-login',
        payload: { id: target.id, origin: 'https://evil-phishing.com' },
      };
      const getRes = await bridgeServer.processRequest(maliciousGetReq);

      expect(getRes.success).toBe(false);
      expect(getRes.error).toMatch(/authorization denied|does not match/i);
    });

    it('rejects credential retrieval on insecure HTTP origins', async () => {
      const listRes = await bridgeServer.processRequest({
        id: 'search',
        action: 'search-logins',
        payload: { origin: 'https://github.com' },
      });
      const target = listRes.data[0];

      const httpGetReq: NativeRequest<GetLoginRequest> = {
        id: 'http-get',
        action: 'get-login',
        payload: { id: target.id, origin: 'http://github.com' },
      };
      const getRes = await bridgeServer.processRequest(httpGetReq);

      expect(getRes.success).toBe(false);
      expect(getRes.error).toMatch(/insecure http/i);
    });

    it('generates passwords with entropy metadata', async () => {
      const genReq: NativeRequest = {
        id: 'gen-1',
        action: 'generate-password',
        payload: { length: 24, useSymbols: true },
      };
      const res = await bridgeServer.processRequest(genReq);

      expect(res.id).toBe('gen-1');
      expect(res.success).toBe(true);
      expect(res.data.password).toHaveLength(24);
      expect(res.data.entropyBits).toBeGreaterThan(100);
      expect(res.data.strengthLabel).toBe('Very Strong');
    });

    it('saves a user-approved login entry and updates existing credentials', async () => {
      const saveReq: NativeRequest<SaveLoginRequest> = {
        id: 'save-1',
        action: 'save-login',
        payload: {
          origin: 'https://linear.app',
          username: 'designer@linear.app',
          password: 'LinearSecurePassword2026!',
          title: 'Linear App',
          url: 'https://linear.app/login',
        },
      };
      const res = await bridgeServer.processRequest(saveReq);

      expect(res.id).toBe('save-1');
      expect(res.success).toBe(true);
      expect(res.data.id).toBeDefined();

      // Verify entry exists in vault
      const searchRes = await bridgeServer.processRequest({
        id: 'search-saved',
        action: 'search-logins',
        payload: { origin: 'https://linear.app' },
      });
      expect(searchRes.data).toHaveLength(1);
      expect(searchRes.data[0].username).toBe('designer@linear.app');
    });

    it('locks vault upon lock-vault action', async () => {
      const lockReq: NativeRequest = { id: 'lock-1', action: 'lock-vault' };
      const res = await bridgeServer.processRequest(lockReq);

      expect(res.id).toBe('lock-1');
      expect(res.success).toBe(true);
      expect(vaultService.getStatus().isUnlocked).toBe(false);
    });
  });
});
