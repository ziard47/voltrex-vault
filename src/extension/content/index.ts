/**
 * Voltrex Vault - Content Script Entry Point
 * Listens for fill instructions from the extension popup and captures candidate logins
 * upon legitimate form submission without storing plaintext in local storage.
 */

import { detectLoginFields, fillCredentials, isSafeFrameContext } from './autofill';

// Enforce top-level or same-origin frame isolation
if (isSafeFrameContext()) {
  initContentScript();
}

function initContentScript(): void {
  // Listen for extension commands (Fill credentials, Page inspection)
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VOLTREX_PING') {
      const { usernameInput, passwordInput } = detectLoginFields();
      sendResponse({
        alive: true,
        hasLoginFields: !!(usernameInput || passwordInput),
        hasPasswordField: !!passwordInput,
        origin: window.location.origin,
      });
      return true;
    }

    if (message.type === 'VOLTREX_FILL_CREDENTIALS') {
      const result = fillCredentials(message.username, message.password);
      sendResponse(result);
      return true;
    }

    return false;
  });

  // Observe form submissions to capture candidate credentials for saving
  window.addEventListener(
    'submit',
    (event: Event) => {
      try {
        const form = event.target as HTMLFormElement;
        if (!form || typeof form.querySelectorAll !== 'function') return;

        const passwordInput = form.querySelector<HTMLInputElement>('input[type="password"]');
        if (!passwordInput || !passwordInput.value) return;

        const { usernameInput } = detectLoginFields(form);
        const username = usernameInput ? usernameInput.value.trim() : '';
        const password = passwordInput.value;

        if (password) {
          // Notify background service worker in-memory candidate store
          chrome.runtime.sendMessage({
            type: 'VOLTREX_CANDIDATE_LOGIN',
            origin: window.location.origin,
            url: window.location.href,
            username,
            password,
          });
        }
      } catch {
        // Silently fail without interrupting page submission
      }
    },
    true // Capture phase to intercept before page listeners might stop propagation
  );
}
