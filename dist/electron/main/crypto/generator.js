"use strict";
/**
 * Voltrex Vault - Cryptographically Secure Password Generator
 * Uses Node.js crypto.randomInt for unbiased, secure selection.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEntropy = calculateEntropy;
exports.getStrengthLabel = getStrengthLabel;
exports.generateSecurePassword = generateSecurePassword;
const node_crypto_1 = __importDefault(require("node:crypto"));
const validation_1 = require("../../shared/validation");
const CHARSET_UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // without ambiguous chars option
const CHARSET_UPPERCASE_ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CHARSET_LOWERCASE = 'abcdefghijkmnpqrstuvwxyz'; // without ambiguous chars option (no l, o)
const CHARSET_LOWERCASE_ALL = 'abcdefghijklmnopqrstuvwxyz';
const CHARSET_NUMBERS = '23456789'; // without 0, 1
const CHARSET_NUMBERS_ALL = '0123456789';
const CHARSET_SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const CHARSET_SYMBOLS_SAFE = '!@#$%^&*-_+=';
/**
 * Calculates Shannon entropy bits for a password given the pool size.
 * Formula: E = L * log2(R)
 */
function calculateEntropy(password, poolSize) {
    if (!password || poolSize <= 0)
        return 0;
    const bitsPerChar = Math.log2(poolSize);
    return Math.round(password.length * bitsPerChar);
}
function getStrengthLabel(entropyBits) {
    if (entropyBits < 36)
        return 'Weak';
    if (entropyBits < 56)
        return 'Fair';
    if (entropyBits < 72)
        return 'Good';
    if (entropyBits < 96)
        return 'Strong';
    return 'Very Strong';
}
function generateSecurePassword(rawOptions) {
    const options = (0, validation_1.validatePasswordGeneratorOptions)({
        length: rawOptions?.length ?? 20,
        includeUppercase: rawOptions?.includeUppercase ?? true,
        includeLowercase: rawOptions?.includeLowercase ?? true,
        includeNumbers: rawOptions?.includeNumbers ?? true,
        includeSymbols: rawOptions?.includeSymbols ?? true,
        excludeAmbiguous: rawOptions?.excludeAmbiguous ?? true,
    });
    const pools = [];
    if (options.includeUppercase) {
        pools.push(options.excludeAmbiguous ? CHARSET_UPPERCASE : CHARSET_UPPERCASE_ALL);
    }
    if (options.includeLowercase) {
        pools.push(options.excludeAmbiguous ? CHARSET_LOWERCASE : CHARSET_LOWERCASE_ALL);
    }
    if (options.includeNumbers) {
        pools.push(options.excludeAmbiguous ? CHARSET_NUMBERS : CHARSET_NUMBERS_ALL);
    }
    if (options.includeSymbols) {
        pools.push(options.excludeAmbiguous ? CHARSET_SYMBOLS_SAFE : CHARSET_SYMBOLS);
    }
    // Guaranteed inclusion: at least one character from each requested pool
    const passwordChars = [];
    for (const pool of pools) {
        const idx = node_crypto_1.default.randomInt(0, pool.length);
        passwordChars.push(pool[idx]);
    }
    // Combine full charset for remaining characters
    const fullCharset = pools.join('');
    while (passwordChars.length < options.length) {
        const idx = node_crypto_1.default.randomInt(0, fullCharset.length);
        passwordChars.push(fullCharset[idx]);
    }
    // Cryptographically shuffle the characters using Fisher-Yates shuffle
    for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = node_crypto_1.default.randomInt(0, i + 1);
        [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }
    const password = passwordChars.join('');
    const entropyBits = calculateEntropy(password, fullCharset.length);
    const strengthLabel = getStrengthLabel(entropyBits);
    return {
        password,
        entropyBits,
        strengthLabel,
    };
}
