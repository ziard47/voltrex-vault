"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoIntegrityError = void 0;
exports.generateRandomBytes = generateRandomBytes;
exports.generateNonce = generateNonce;
exports.generateDek = generateDek;
exports.encryptPayload = encryptPayload;
exports.decryptPayload = decryptPayload;
exports.encryptDek = encryptDek;
exports.decryptDek = decryptDek;
const node_crypto_1 = __importDefault(require("node:crypto"));
class CryptoIntegrityError extends Error {
    constructor(message = 'Cryptographic authentication failed. Data may have been tampered with or key is incorrect.') {
        super(message);
        this.name = 'CryptoIntegrityError';
    }
}
exports.CryptoIntegrityError = CryptoIntegrityError;
/**
 * Generates cryptographically secure random bytes.
 */
function generateRandomBytes(length) {
    if (length <= 0) {
        throw new Error('Byte length must be positive.');
    }
    return node_crypto_1.default.randomBytes(length);
}
/**
 * Generates a unique 12-byte (96-bit) nonce for AES-256-GCM.
 */
function generateNonce() {
    return generateRandomBytes(12);
}
/**
 * Generates a 32-byte (256-bit) random Data Encryption Key (DEK).
 */
function generateDek() {
    return generateRandomBytes(32);
}
/**
 * Encrypts a plaintext string or object using AES-256-GCM.
 */
function encryptPayload(data, key) {
    if (!key || key.length !== 32) {
        throw new Error('Encryption key must be exactly 32 bytes.');
    }
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const plaintextBuffer = Buffer.from(plaintext, 'utf8');
    const iv = generateNonce();
    const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
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
function decryptPayload(encrypted, key) {
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
        const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const decryptedBuffer = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        const decryptedUtf8 = decryptedBuffer.toString('utf8');
        try {
            return JSON.parse(decryptedUtf8);
        }
        catch {
            return decryptedUtf8;
        }
    }
    catch (error) {
        throw new CryptoIntegrityError(error instanceof CryptoIntegrityError ? error.message : 'Decryption failed: integrity tag mismatch or corrupt ciphertext.');
    }
}
/**
 * Encrypts the Data Encryption Key (DEK) with the Key Encryption Key (KEK).
 */
function encryptDek(dek, kek) {
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
function decryptDek(encryptedDekHex, dekIvHex, dekTagHex, kek) {
    const decryptedHex = decryptPayload({
        ciphertextHex: encryptedDekHex,
        ivHex: dekIvHex,
        tagHex: dekTagHex,
        version: 1,
    }, kek);
    return Buffer.from(decryptedHex, 'hex');
}
