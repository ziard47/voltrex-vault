"use strict";
(() => {
  // src/extension/content/autofill.ts
  function isSafeFrameContext() {
    try {
      if (window.self === window.top) {
        return true;
      }
      return window.location.origin === window.parent.location.origin;
    } catch {
      return false;
    }
  }
  function detectLoginFields(root = document) {
    const passwordInputs = Array.from(root.querySelectorAll('input[type="password"]')).filter((input) => !input.disabled && (input.offsetParent !== null || input.style.display !== "none"));
    if (passwordInputs.length === 0) {
      return { usernameInput: null, passwordInput: null, formElement: null };
    }
    const passwordInput = passwordInputs[0];
    const formElement = passwordInput.closest("form");
    const searchRoot = formElement || root;
    const candidateUserInputs = Array.from(
      searchRoot.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]')
    ).filter((input) => !input.disabled && (input.offsetParent !== null || input.style.display !== "none"));
    let usernameInput = null;
    usernameInput = candidateUserInputs.find((i) => {
      const ac = (i.getAttribute("autocomplete") || "").toLowerCase();
      return ac === "username" || ac === "email";
    }) || null;
    if (!usernameInput) {
      usernameInput = candidateUserInputs.find((i) => {
        const idOrName = `${i.id} ${i.name}`.toLowerCase();
        return /user|email|login|account|identifier/.test(idOrName);
      }) || null;
    }
    if (!usernameInput && candidateUserInputs.length > 0) {
      usernameInput = candidateUserInputs[0];
    }
    return {
      usernameInput,
      passwordInput,
      formElement
    };
  }
  function setInputValueSafely(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  }
  function fillCredentials(username, password) {
    if (!isSafeFrameContext()) {
      return { success: false, filled: [] };
    }
    const { usernameInput, passwordInput } = detectLoginFields();
    const filled = [];
    if (username && usernameInput) {
      setInputValueSafely(usernameInput, username);
      filled.push("username");
    }
    if (password && passwordInput) {
      setInputValueSafely(passwordInput, password);
      filled.push("password");
    }
    return {
      success: filled.length > 0,
      filled
    };
  }

  // src/extension/content/index.ts
  if (isSafeFrameContext()) {
    initContentScript();
  }
  function initContentScript() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "VOLTREX_PING") {
        const { usernameInput, passwordInput } = detectLoginFields();
        sendResponse({
          alive: true,
          hasLoginFields: !!(usernameInput || passwordInput),
          hasPasswordField: !!passwordInput,
          origin: window.location.origin
        });
        return true;
      }
      if (message.type === "VOLTREX_FILL_CREDENTIALS") {
        const result = fillCredentials(message.username, message.password);
        sendResponse(result);
        return true;
      }
      return false;
    });
    window.addEventListener(
      "submit",
      (event) => {
        try {
          const form = event.target;
          if (!form || typeof form.querySelectorAll !== "function") return;
          const passwordInput = form.querySelector('input[type="password"]');
          if (!passwordInput || !passwordInput.value) return;
          const { usernameInput } = detectLoginFields(form);
          const username = usernameInput ? usernameInput.value.trim() : "";
          const password = passwordInput.value;
          if (password) {
            chrome.runtime.sendMessage({
              type: "VOLTREX_CANDIDATE_LOGIN",
              origin: window.location.origin,
              url: window.location.href,
              username,
              password
            });
          }
        } catch {
        }
      },
      true
      // Capture phase to intercept before page listeners might stop propagation
    );
  }
})();
