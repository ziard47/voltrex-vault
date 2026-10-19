"use strict";
/**
 * Voltrex Vault - Native Messaging Framing Protocol
 * Encodes and decodes Chrome Native Messaging 32-bit length-prefixed stdio streams.
 * Enforces strict 1 MB maximum message limit to prevent buffer exhaustion and DoS.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeMessageReader = void 0;
exports.encodeNativeMessage = encodeNativeMessage;
exports.readNativeMessage = readNativeMessage;
const extension_types_1 = require("../shared/extension-types");
/**
 * Encodes a NativeResponse object into Chrome Native Messaging framing:
 * 4-byte unsigned integer (little-endian) specifying length, followed by UTF-8 JSON payload.
 */
function encodeNativeMessage(message) {
    const jsonStr = JSON.stringify(message);
    const messageBuffer = Buffer.from(jsonStr, 'utf8');
    if (messageBuffer.length > extension_types_1.MAX_NATIVE_MESSAGE_BYTES) {
        throw new Error(`Response payload size (${messageBuffer.length} bytes) exceeds maximum allowable limit of ${extension_types_1.MAX_NATIVE_MESSAGE_BYTES} bytes.`);
    }
    const header = Buffer.alloc(4);
    header.writeUInt32LE(messageBuffer.length, 0);
    return Buffer.concat([header, messageBuffer]);
}
/**
 * Stateful reader for sequential length-prefixed native messages from any stream.
 */
class NativeMessageReader {
    buffer = Buffer.alloc(0);
    stream;
    ended = false;
    waiter = null;
    error = null;
    constructor(stream) {
        this.stream = stream;
        this.stream.on('data', chunk => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            this.buffer = Buffer.concat([this.buffer, buf]);
            if (this.waiter) {
                const w = this.waiter;
                this.waiter = null;
                w();
            }
        });
        this.stream.on('end', () => {
            this.ended = true;
            if (this.waiter) {
                const w = this.waiter;
                this.waiter = null;
                w();
            }
        });
        this.stream.on('error', err => {
            this.error = err;
            if (this.waiter) {
                const w = this.waiter;
                this.waiter = null;
                w();
            }
        });
        if (this.stream.resume) {
            this.stream.resume();
        }
    }
    async waitForBytes(count) {
        while (this.buffer.length < count) {
            if (this.error)
                throw this.error;
            if (this.ended)
                return false;
            await new Promise(resolve => {
                this.waiter = resolve;
            });
        }
        return true;
    }
    async readMessage() {
        const hasHeader = await this.waitForBytes(4);
        if (!hasHeader) {
            if (this.buffer.length === 0)
                return null; // Clean EOF
            throw new Error('Unexpected EOF: incomplete 4-byte header received.');
        }
        const length = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.subarray(4);
        if (length === 0) {
            throw new Error('Malformed native message: zero length specified.');
        }
        if (length > extension_types_1.MAX_NATIVE_MESSAGE_BYTES) {
            throw new Error(`Native message length (${length} bytes) exceeds maximum permitted ceiling of ${extension_types_1.MAX_NATIVE_MESSAGE_BYTES} bytes.`);
        }
        const hasPayload = await this.waitForBytes(length);
        if (!hasPayload) {
            throw new Error('Unexpected EOF while reading native message payload.');
        }
        const payloadBuf = this.buffer.subarray(0, length);
        this.buffer = this.buffer.subarray(length);
        const jsonStr = payloadBuf.toString('utf8');
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        }
        catch {
            throw new Error('Malformed JSON received in native messaging payload.');
        }
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Native message payload must be an object.');
        }
        const request = parsed;
        if (!request.id || typeof request.id !== 'string') {
            throw new Error('Native message missing required string field: id.');
        }
        if (!request.action || typeof request.action !== 'string') {
            throw new Error('Native message missing required string field: action.');
        }
        if (!extension_types_1.ALLOWED_NATIVE_ACTIONS.has(request.action)) {
            throw new Error(`Unauthorized action '${request.action}' rejected by native host allowlist.`);
        }
        return parsed;
    }
}
exports.NativeMessageReader = NativeMessageReader;
/**
 * Convenience function reading a single native message.
 */
async function readNativeMessage(stream) {
    const reader = new NativeMessageReader(stream);
    return reader.readMessage();
}
