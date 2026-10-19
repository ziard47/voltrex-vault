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

import { clipboard } from 'electron';

export class ClipboardManager {
  private clearTimer: NodeJS.Timeout | null = null;
  private lastCopiedText: string | null = null;

  public copyWithAutoClear(text: string, clearAfterSeconds = 30): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }

    this.lastCopiedText = text;
    clipboard.writeText(text);

    if (clearAfterSeconds > 0) {
      this.clearTimer = setTimeout(() => {
        try {
          const currentContent = clipboard.readText();
          // Only clear if the clipboard still contains the exact text we copied
          if (currentContent === this.lastCopiedText) {
            clipboard.clear();
          }
        } catch {
          // Ignore clipboard access errors
        } finally {
          this.lastCopiedText = null;
          this.clearTimer = null;
        }
      }, clearAfterSeconds * 1000);
    }
  }

  public clearNow(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.lastCopiedText = null;
    clipboard.clear();
  }
}
