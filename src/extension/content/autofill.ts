/**
 * Voltrex Vault - Browser Extension Autofill Engine
 * Enforces strict user-driven autofill, no auto-submit, frame isolation,
 * and reliable reactive input setting.
 */

export interface FormFields {
  usernameInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement | null;
  formElement: HTMLFormElement | null;
}

/**
 * Validates whether the current execution context is safe for autofill.
 * Enforces top-level window execution or same-origin iframe matching.
 */
export function isSafeFrameContext(): boolean {
  try {
    if (window.self === window.top) {
      return true;
    }
    // If embedded, require same origin as parent window
    return window.location.origin === window.parent.location.origin;
  } catch {
    // Cross-origin access error means it's an untrusted cross-origin iframe
    return false;
  }
}

/**
 * Finds appropriate username and password input fields in the document or specific form.
 */
export function detectLoginFields(root: Document | HTMLElement = document): FormFields {
  const passwordInputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="password"]'))
    .filter(input => !input.disabled && (input.offsetParent !== null || input.style.display !== 'none'));

  if (passwordInputs.length === 0) {
    return { usernameInput: null, passwordInput: null, formElement: null };
  }

  // Primary password input
  const passwordInput = passwordInputs[0];
  const formElement = passwordInput.closest('form');

  // Search for username input in the same form, or preceding in document
  const searchRoot = formElement || root;
  const candidateUserInputs = Array.from(
    searchRoot.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"], input[type="tel"]')
  ).filter(input => !input.disabled && (input.offsetParent !== null || input.style.display !== 'none'));

  let usernameInput: HTMLInputElement | null = null;

  // Priority 1: autocomplete attribute
  usernameInput = candidateUserInputs.find(i => {
    const ac = (i.getAttribute('autocomplete') || '').toLowerCase();
    return ac === 'username' || ac === 'email';
  }) || null;

  // Priority 2: name/id attribute matching username or email
  if (!usernameInput) {
    usernameInput = candidateUserInputs.find(i => {
      const idOrName = `${i.id} ${i.name}`.toLowerCase();
      return /user|email|login|account|identifier/.test(idOrName);
    }) || null;
  }

  // Priority 3: first text/email input preceding the password input
  if (!usernameInput && candidateUserInputs.length > 0) {
    usernameInput = candidateUserInputs[0];
  }

  return {
    usernameInput,
    passwordInput,
    formElement,
  };
}

/**
 * Safely sets an input value for modern reactive frameworks (React, Angular, Vue)
 * without triggering submission.
 */
export function setInputValueSafely(input: HTMLInputElement, value: string): void {
  // Use prototype setter to bypass React 16+ synthetic event value tracking override
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  // Dispatch standard events so DOM listeners detect change
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
}

/**
 * Fills credentials into the active page upon explicit user request.
 * NEVER submits forms automatically.
 */
export function fillCredentials(username?: string, password?: string): { success: boolean; filled: string[] } {
  if (!isSafeFrameContext()) {
    return { success: false, filled: [] };
  }

  const { usernameInput, passwordInput } = detectLoginFields();
  const filled: string[] = [];

  if (username && usernameInput) {
    setInputValueSafely(usernameInput, username);
    filled.push('username');
  }

  if (password && passwordInput) {
    setInputValueSafely(passwordInput, password);
    filled.push('password');
  }

  return {
    success: filled.length > 0,
    filled,
  };
}
