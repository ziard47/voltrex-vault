import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { encodeNativeMessage, readNativeMessage } from '../src/native-host/protocol';
import { forwardToBridge } from '../src/native-host/index';
import { NativeRequest, NativeResponse } from '../src/shared/extension-types';

describe('Native Messaging Framing Protocol & Host (Phase 3)', () => {
  it('encodes a NativeResponse with 4-byte little-endian length prefix', () => {
    const response: NativeResponse = {
      id: 'req-1',
      success: true,
      data: { isUnlocked: true },
    };

    const encoded = encodeNativeMessage(response);
    expect(encoded.length).toBeGreaterThan(4);

    const length = encoded.readUInt32LE(0);
    const jsonStr = encoded.slice(4).toString('utf8');

    expect(length).toBe(Buffer.byteLength(jsonStr, 'utf8'));
    expect(JSON.parse(jsonStr)).toEqual(response);
  });

  it('reads and decodes a valid length-prefixed request stream', async () => {
    const request: NativeRequest = {
      id: 'req-42',
      action: 'status',
    };

    const payloadStr = JSON.stringify(request);
    const payloadBuf = Buffer.from(payloadStr, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payloadBuf.length, 0);

    const fullMessage = Buffer.concat([header, payloadBuf]);
    const stream = Readable.from(fullMessage);

    const decoded = await readNativeMessage(stream);
    expect(decoded).toEqual(request);
  });

  it('returns null on clean EOF', async () => {
    const emptyStream = Readable.from(Buffer.alloc(0));
    const decoded = await readNativeMessage(emptyStream);
    expect(decoded).toBeNull();
  });

  it('rejects native messages exceeding 1 MB limit (DoS mitigation)', async () => {
    const oversizedLength = 1024 * 1024 + 1; // 1 MB + 1 byte
    const header = Buffer.alloc(4);
    header.writeUInt32LE(oversizedLength, 0);

    const stream = Readable.from(header);
    await expect(readNativeMessage(stream)).rejects.toThrow(
      /exceeds maximum permitted ceiling of 1048576 bytes/i
    );
  });

  it('rejects zero-length native messages', async () => {
    const header = Buffer.alloc(4);
    header.writeUInt32LE(0, 0);

    const stream = Readable.from(header);
    await expect(readNativeMessage(stream)).rejects.toThrow(/zero length/i);
  });

  it('rejects commands not in allowlist', async () => {
    const maliciousRequest = {
      id: 'evil-1',
      action: 'export-entire-vault',
    };

    const payload = Buffer.from(JSON.stringify(maliciousRequest), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length, 0);

    const stream = Readable.from(Buffer.concat([header, payload]));
    await expect(readNativeMessage(stream)).rejects.toThrow(
      /unauthorized action 'export-entire-vault' rejected/i
    );
  });

  describe('forwardToBridge', () => {
    let tmpDir: string;
    let mockSocketPath: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voltrex-host-test-'));
      mockSocketPath = path.join(tmpDir, 'test_bridge.sock');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns isAppRunning=false gracefully when desktop bridge is closed', async () => {
      const request: NativeRequest = { id: 'req-1', action: 'status' };
      const response = await forwardToBridge(request, mockSocketPath);

      expect(response.id).toBe('req-1');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ isAppRunning: false, isUnlocked: false });
    });

    it('successfully forwards request to bridge server and returns response', async () => {
      // Setup mock domain socket server
      const mockServer = net.createServer(socket => {
        socket.on('data', chunk => {
          const req = JSON.parse(chunk.toString('utf8').trim());
          const res: NativeResponse = {
            id: req.id,
            success: true,
            data: { isAppRunning: true, isUnlocked: true },
          };
          socket.write(JSON.stringify(res) + '\n');
        });
      });

      await new Promise<void>(resolve => mockServer.listen(mockSocketPath, () => resolve()));

      const request: NativeRequest = { id: 'req-2', action: 'status' };
      const response = await forwardToBridge(request, mockSocketPath);

      expect(response.id).toBe('req-2');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ isAppRunning: true, isUnlocked: true });

      mockServer.close();
    });
  });
});
