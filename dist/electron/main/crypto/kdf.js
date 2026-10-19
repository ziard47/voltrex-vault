"use strict";
/**
 * Voltrex Vault - Key Derivation Function (KDF) Module
 * Implements Argon2id password-based key derivation using hash-wasm and
 * HKDF-SHA256 key separation according to cryptographic best practices.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ARGON2_PARAMS = void 0;
exports.deriveMasterKey = deriveMasterKey;
exports.deriveKeyHierarchy = deriveKeyHierarchy;
exports.deriveAllKeys = deriveAllKeys;
const hash_wasm_1 = require("hash-wasm");
const node_crypto_1 = __importDefault(require("node:crypto"));
exports.DEFAULT_ARGON2_PARAMS = {
    memoryKiB: 65536, // 64 MiB
    iterations: 3,
    parallelism: 1,
    hashLength: 32, // 256 bits
};
/**
 * Derives the 256-bit Master Key from a password and salt using Argon2id.
 */
async function deriveMasterKey(password, salt, params = exports.DEFAULT_ARGON2_PARAMS) {
    if (!password || password.length === 0) {
        throw new Error('Master password cannot be empty.');
    }
    if (!salt || salt.length < 16) {
        throw new Error('Salt must be at least 16 bytes.');
    }
    const saltUint8 = salt instanceof Uint8Array ? salt : new Uint8Array(salt);
    const hexHash = await (0, hash_wasm_1.argon2id)({
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
function deriveKeyHierarchy(masterKey) {
    if (!masterKey || masterKey.length !== 32) {
        throw new Error('Master key must be 32 bytes.');
    }
    // Derive Key Encryption Key (KEK) used solely to wrap the Data Encryption Key (DEK)
    const kek = node_crypto_1.default.hkdfSync('sha256', masterKey, Buffer.alloc(0), Buffer.from('voltrex-vault-kek-v1', 'utf8'), 32);
    // Derive Auth Key used for password verification checks without exposing KEK
    const authKey = node_crypto_1.default.hkdfSync('sha256', masterKey, Buffer.alloc(0), Buffer.from('voltrex-vault-auth-v1', 'utf8'), 32);
    return {
        masterKey,
        kek: Buffer.from(kek),
        authKey: Buffer.from(authKey),
    };
}
/**
 * Convenience helper to derive all keys from password and salt.
 */
async function deriveAllKeys(password, salt, params = exports.DEFAULT_ARGON2_PARAMS) {
    const masterKey = await deriveMasterKey(password, salt, params);
    return deriveKeyHierarchy(masterKey);
}
