"use strict";
/**
 * Voltrex Vault - Extension & Native Messaging Protocol Types
 * Strictly enforces message boundaries, command allowlisting, and response schemas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_NATIVE_ACTIONS = exports.MAX_NATIVE_MESSAGE_BYTES = exports.NATIVE_HOST_NAME = void 0;
exports.NATIVE_HOST_NAME = 'com.voltrex.vault';
exports.MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024; // 1 MB ceiling
exports.ALLOWED_NATIVE_ACTIONS = new Set([
    'status',
    'search-logins',
    'get-login',
    'generate-password',
    'save-login',
    'lock-vault',
]);
