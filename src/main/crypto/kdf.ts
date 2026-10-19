/**
 * Voltrex Vault - Key Derivation Function (KDF) Module
 * Implements Argon2id password-based key derivation using hash-wasm and
 * HKDF-SHA256 key separation according to cryptographic best practices.
 */

import { argon2id } from 'hash-wasm';
import crypto from 'node:crypto';
import { zeroizeBuffer } from './zeroize';

export interface Argon2Parameters {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  hashLength: number;
}

export const DEFAULT_ARGON2_PARAMS: Argon2Parameters = {
  memoryKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
  hashLength: 32, // 256 bits
};

export interface DerivedKeys {
  masterKey: Buffer;
  kek: Buffer;
  authKey: Buffer;
}

/**
 * Derives the 256-bit Master Key from a password and salt using Argon2id.
 */
export async function deriveMasterKey(
  password: string,
  salt: Uint8Array | Buffer,
  params: Argon2Parameters = DEFAULT_ARGON2_PARAMS
): Promise<Buffer> {
  if (!password || password.length === 0) {
    throw new Error('Master password cannot be empty.');
  }
  if (!salt || salt.length < 16) {
    throw new Error('Salt must be at least 16 bytes.');
  }

  const saltUint8 = salt instanceof Uint8Array ? salt : new Uint8Array(salt);

  const hexHash = await argon2id({
    password,
    salt: saltUint8,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: params.hashLength,
    outputType: 'hex',
  });

  return Buffer.from(hexHash, 'hex');
}

/**
 * Performs HKDF-SHA256 expansion to derive distinct keys from the Master Key.
 * HKDF ensures that the same Master Key is never reused directly for different cryptographic purposes.
 */
export function deriveKeyHierarchy(masterKey: Buffer): DerivedKeys {
  if (!masterKey || masterKey.length !== 32) {
    throw new Error('Master key must be 32 bytes.');
  }

  // Derive Key Encryption Key (KEK) used solely to wrap the Data Encryption Key (DEK)
  const kek = crypto.hkdfSync(
    'sha256',
    masterKey,
    Buffer.alloc(0),
    Buffer.from('voltrex-vault-kek-v1', 'utf8'),
    32
  );

  // Derive Auth Key used for password verification checks without exposing KEK
  const authKey = crypto.hkdfSync(
    'sha256',
    masterKey,
    Buffer.alloc(0),
    Buffer.from('voltrex-vault-auth-v1', 'utf8'),
    32
  );

  return {
    masterKey,
    kek: Buffer.from(kek),
    authKey: Buffer.from(authKey),
  };
}

/**
 * Convenience helper to derive all keys from password and salt.
 */
export async function deriveAllKeys(
  password: string,
  salt: Buffer,
  params: Argon2Parameters = DEFAULT_ARGON2_PARAMS
): Promise<DerivedKeys> {
  const masterKey = await deriveMasterKey(password, salt, params);
  return deriveKeyHierarchy(masterKey);
}
