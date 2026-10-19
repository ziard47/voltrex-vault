/**
 * Voltrex Vault - Authenticated Encryption Module (AES-256-GCM)
 * Uses Node.js crypto module for authenticated encryption and cryptographically secure random bytes.
 *
 * Guaranteed Properties:
 * - 256-bit AES encryption
 * - Galois/Counter Mode (GCM) for combined confidentiality and integrity authentication
 * - Unique, freshly-generated 96-bit (12-byte) random initialization vector (IV/nonce) per encryption
 * - 128-bit (16-byte) authentication tag strictly verified before decryption is accepted
 * - Zero plaintext persisted
 */

import crypto from 'node:crypto';
import { zeroizeBuffer } from './zeroize';

export class CryptoIntegrityError extends Error {
  constructor(message = 'Cryptographic authentication failed. Data may have been tampered with or key is incorrect.') {
    super(message);
    this.name = 'CryptoIntegrityError';
  }
}

export interface EncryptedPayload {
  ivHex: string;
  ciphertextHex: string;
  tagHex: string;
  version: number;
}

export interface EncryptedDekRecord {
  encryptedDekHex: string;
  dekIvHex: string;
  dekTagHex: string;
}

/**
 * Generates cryptographically secure random bytes.
 */
export function generateRandomBytes(length: number): Buffer {
  if (length <= 0) {
    throw new Error('Byte length must be positive.');
  }
  return crypto.randomBytes(length);
}

/**
 * Generates a unique 12-byte (96-bit) nonce for AES-256-GCM.
 */
export function generateNonce(): Buffer {
  return generateRandomBytes(12);
}

/**
 * Generates a 32-byte (256-bit) random Data Encryption Key (DEK).
 */
export function generateDek(): Buffer {
  return generateRandomBytes(32);
}

/**
 * Encrypts a plaintext string or object using AES-256-GCM.
 */
export function encryptPayload(data: unknown, key: Buffer): EncryptedPayload {
  if (!key || key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes.');
  }

  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const plaintextBuffer = Buffer.from(plaintext, 'utf8');
  const iv = generateNonce();

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertextBuffer = Buffer.concat([
    cipher.update(plaintextBuffer),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ivHex: iv.toString('hex'),
    ciphertextHex: ciphertextBuffer.toString('hex'),
    tagHex: tag.toString('hex'),
    version: 1,
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext payload and validates the authentication tag.
 * Throws CryptoIntegrityError if authentication fails.
 */
export function decryptPayload<T = unknown>(encrypted: EncryptedPayload, key: Buffer): T {
  if (!key || key.length !== 32) {
    throw new Error('Decryption key must be exactly 32 bytes.');
  }

  const iv = Buffer.from(encrypted.ivHex, 'hex');
  const ciphertext = Buffer.from(encrypted.ciphertextHex, 'hex');
  const tag = Buffer.from(encrypted.tagHex, 'hex');

  if (iv.length !== 12) {
    throw new CryptoIntegrityError('Invalid IV length. Expected 12 bytes.');
  }
  if (tag.length !== 16) {
    throw new CryptoIntegrityError('Invalid authentication tag length. Expected 16 bytes.');
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const decryptedUtf8 = decryptedBuffer.toString('utf8');
    try {
      return JSON.parse(decryptedUtf8) as T;
    } catch {
      return decryptedUtf8 as unknown as T;
    }
  } catch (error) {
    throw new CryptoIntegrityError(
      error instanceof CryptoIntegrityError ? error.message : 'Decryption failed: integrity tag mismatch or corrupt ciphertext.'
    );
  }
}

/**
 * Encrypts the Data Encryption Key (DEK) with the Key Encryption Key (KEK).
 */
export function encryptDek(dek: Buffer, kek: Buffer): EncryptedDekRecord {
  const encrypted = encryptPayload(dek.toString('hex'), kek);
  return {
    encryptedDekHex: encrypted.ciphertextHex,
    dekIvHex: encrypted.ivHex,
    dekTagHex: encrypted.tagHex,
  };
}

/**
 * Decrypts the Data Encryption Key (DEK) with the Key Encryption Key (KEK).
 */
export function decryptDek(
  encryptedDekHex: string,
  dekIvHex: string,
  dekTagHex: string,
  kek: Buffer
): Buffer {
  const decryptedHex = decryptPayload<string>(
    {
      ciphertextHex: encryptedDekHex,
      ivHex: dekIvHex,
      tagHex: dekTagHex,
      version: 1,
    },
    kek
  );

  return Buffer.from(decryptedHex, 'hex');
}
