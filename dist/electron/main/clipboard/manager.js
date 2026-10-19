"use strict";
/**
 * Voltrex Vault - Clipboard Manager
 * Provides clipboard copying with timed auto-clear functionality.
 *
 * NOTE ON SECURITY LIMITATIONS:
 * Automatic clipboard clearing is strictly BEST-EFFORT.
 * External clipboard managers (e.g. Klipper, GPaste, Ditto, Windows Clipboard History)
 * or malicious background utilities may capture copied secrets immediately upon insertion.
 * Users should be aware that no desktop application can prevent external tools from
 * recording clipboard events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClipboardManager = void 0;
const electron_1 = require("electron");
class ClipboardManager {
    clearTimer = null;
    lastCopiedText = null;
    copyWithAutoClear(text, clearAfterSeconds = 30) {
        if (this.clearTimer) {
            clearTimeout(this.clearTimer);
            this.clearTimer = null;
        }
        this.lastCopiedText = text;
        electron_1.clipboard.writeText(text);
        if (clearAfterSeconds > 0) {
            this.clearTimer = setTimeout(() => {
                try {
                    const currentContent = electron_1.clipboard.readText();
                    // Only clear if the clipboard still contains the exact text we copied
                    if (currentContent === this.lastCopiedText) {
                        electron_1.clipboard.clear();
                    }
                }
                catch {
                    // Ignore clipboard access errors
                }
                finally {
                    this.lastCopiedText = null;
                    this.clearTimer = null;
                }
            }, clearAfterSeconds * 1000);
        }
    }
    clearNow() {
        if (this.clearTimer) {
            clearTimeout(this.clearTimer);
            this.clearTimer = null;
        }
        this.lastCopiedText = null;
        electron_1.clipboard.clear();
    }
}
exports.ClipboardManager = ClipboardManager;
