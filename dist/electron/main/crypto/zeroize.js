"use strict";
/**
 * Voltrex Vault - Memory Zeroization Utility
 *
 * ARCHITECTURAL NOTICE ON JAVASCRIPT MEMORY LIMITATIONS:
 * In JavaScript (V8 engine), strings are immutable and primitive values may be
 * copied during string operations, object allocations, garbage collection passes,
 * and JIT optimizations. Complete, guaranteed zeroization of all memory pages is
 * fundamentally unachievable in managed runtimes like Node.js without low-level
 * OS-level memory pinning (e.g. mlock).
 *
 * To minimize exposure:
 * 1. Cryptographic keys and sensitive plaintext payloads are stored in Node.js
 *    Buffers whenever possible.
 * 2. Buffers are actively zeroized with `buf.fill(0)` immediately when no longer needed
 *    or during vault locking.
 * 3. Secrets are never cached in persistent module-level globals or renderer process memory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.zeroizeBuffer = zeroizeBuffer;
exports.zeroizeBuffers = zeroizeBuffers;
function zeroizeBuffer(buffer) {
    if (!buffer)
        return;
    try {
        buffer.fill(0);
    }
    catch {
        // Ignore errors if buffer is detached or read-only
    }
}
function zeroizeBuffers(...buffers) {
    for (const buf of buffers) {
        zeroizeBuffer(buf);
    }
}
