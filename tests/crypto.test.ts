import { describe, it, expect } from 'vitest';
import {
  generateRandomBytes,
  generateNonce,
  generateDek,
  encryptPayload,
  decryptPayload,
  encryptDek,
  decryptDek,
  CryptoIntegrityError,
} from '../src/main/crypto/cipher';
import {
  deriveMasterKey,
  deriveKeyHierarchy,
  deriveAllKeys,
} from '../src/main/crypto/kdf';
import { zeroizeBuffer } from '../src/main/crypto/zeroize';

describe('Cryptography Engine', () => {
  it('generates unique nonces across 1000 iterations', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const nonce = generateNonce();
      expect(nonce.length).toBe(12);
      nonces.add(nonce.toString('hex'));
    }
    expect(nonces.size).toBe(1000);
  });

  it('performs AES-256-GCM authenticated encryption and decryption round-trip', () => {
    const key = generateDek();
    const sensitiveData = {
      username: 'security_auditor',
      password: 'SuperSecretPassword!2026',
      notes: 'Contains high-value credentials',
    };

    const encrypted = encryptPayload(sensitiveData, key);
    expect(encrypted.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tagHex).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.ciphertextHex.length).toBeGreaterThan(0);
    expect(encrypted.ciphertextHex).not.toContain('SuperSecretPassword');

    const decrypted = decryptPayload<typeof sensitiveData>(encrypted, key);
    expect(decrypted).toEqual(sensitiveData);
  });

  it('rejects tampered ciphertext with CryptoIntegrityError', () => {
    const key = generateDek();
    const encrypted = encryptPayload('Confidential Note', key);

    // Tamper with one byte of ciphertext
    const rawCiphertext = Buffer.from(encrypted.ciphertextHex, 'hex');
    rawCiphertext[0] ^= 0xff; // Flip bits
    const tamperedPayload = {
      ...encrypted,
      ciphertextHex: rawCiphertext.toString('hex'),
    };

    expect(() => decryptPayload(tamperedPayload, key)).toThrow(CryptoIntegrityError);
  });

  it('rejects tampered authentication tag with CryptoIntegrityError', () => {
    const key = generateDek();
    const encrypted = encryptPayload('Confidential Note', key);

    // Tamper with authentication tag
    const rawTag = Buffer.from(encrypted.tagHex, 'hex');
    rawTag[rawTag.length - 1] ^= 0x01;
    const tamperedPayload = {
      ...encrypted,
      tagHex: rawTag.toString('hex'),
    };

    expect(() => decryptPayload(tamperedPayload, key)).toThrow(CryptoIntegrityError);
  });

  it('encrypts and decrypts Data Encryption Key (DEK) under Key Encryption Key (KEK)', () => {
    const dek = generateDek();
    const kek = generateDek();

    const wrappedDek = encryptDek(dek, kek);
    expect(wrappedDek.encryptedDekHex).not.toBe(dek.toString('hex'));

    const unwrappedDek = decryptDek(
      wrappedDek.encryptedDekHex,
      wrappedDek.dekIvHex,
      wrappedDek.dekTagHex,
      kek
    );

    expect(unwrappedDek).toEqual(dek);
  });

  it('derives master key with Argon2id and splits key hierarchy via HKDF', async () => {
    const salt = generateRandomBytes(32);
    // Use lightweight parameters for unit test speed
    const testParams = {
      memoryKiB: 1024,
      iterations: 1,
      parallelism: 1,
      hashLength: 32,
    };

    const keys = await deriveAllKeys('correct-master-password', salt, testParams);
    expect(keys.masterKey).toHaveLength(32);
    expect(keys.kek).toHaveLength(32);
    expect(keys.authKey).toHaveLength(32);

    // Keys must be completely distinct
    expect(keys.masterKey).not.toEqual(keys.kek);
    expect(keys.kek).not.toEqual(keys.authKey);
  });

  it('zeroizes memory buffer safely', () => {
    const secret = Buffer.from('my-super-secret-key-32-bytes-len');
    expect(secret.some(b => b !== 0)).toBe(true);

    zeroizeBuffer(secret);
    expect(secret.every(b => b === 0)).toBe(true);
  });
});
