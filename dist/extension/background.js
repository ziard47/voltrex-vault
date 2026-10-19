// src/shared/extension-types.ts
var NATIVE_HOST_NAME = "com.voltrex.vault";
var MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;

// src/shared/origin.ts
function getCanonicalOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const trimmed = rawUrl.trim();
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
      return null;
    }
    const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    const scheme = parsed.protocol.slice(0, -1).toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    let port = parsed.port;
    if (scheme === "https" && port === "443" || scheme === "http" && port === "80") {
      port = "";
    }
    return port ? `${scheme}://${hostname}:${port}` : `${scheme}://${hostname}`;
  } catch {
    return null;
  }
}

// src/extension/background/index.ts
var candidateLogins = /* @__PURE__ */ new Map();
function sendNativeMessageAsync(action, payload, timeoutMs = 5e3) {
  const requestId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const request = {
    id: requestId,
    action,
    payload
  };
  return new Promise((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        resolve({
          id: requestId,
          success: false,
          error: `Native host timed out after ${timeoutMs}ms. Is Voltrex Vault running?`
        });
      }
    }, timeoutMs);
    try {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST_NAME,
        request,
        (response) => {
          if (completed) return;
          completed = true;
          clearTimeout(timer);
          const lastError = chrome.runtime.lastError;
          if (lastError || !response) {
            resolve({
              id: requestId,
              success: false,
              error: lastError?.message || "Could not communicate with Voltrex Vault native messaging host. Please ensure the host is registered."
            });
            return;
          }
          resolve(response);
        }
      );
    } catch (err) {
      if (!completed) {
        completed = true;
        clearTimeout(timer);
        resolve({
          id: requestId,
          success: false,
          error: err.message || "Error executing native message call."
        });
      }
    }
  });
}
async function getActiveTabInfo() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab || !activeTab.id || !activeTab.url) return null;
  return {
    tabId: activeTab.id,
    url: activeTab.url,
    origin: getCanonicalOrigin(activeTab.url)
  };
}
chrome.tabs.onRemoved.addListener((tabId) => {
  candidateLogins.delete(tabId);
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    candidateLogins.delete(tabId);
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "VOLTREX_CANDIDATE_LOGIN") {
    const tabId = sender.tab?.id;
    if (tabId && message.origin && message.password) {
      candidateLogins.set(tabId, {
        tabId,
        origin: message.origin,
        url: message.url || message.origin,
        username: message.username || "",
        password: message.password,
        timestamp: Date.now()
      });
      chrome.action.setBadgeText({ tabId, text: "+" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#A7D129" });
    }
    sendResponse({ received: true });
    return true;
  }
  if (message.type === "GET_ACTIVE_TAB_INFO") {
    getActiveTabInfo().then((tabInfo) => sendResponse(tabInfo));
    return true;
  }
  if (message.type === "GET_STATUS") {
    sendNativeMessageAsync("status").then((res) => sendResponse(res));
    return true;
  }
  if (message.type === "SEARCH_LOGINS") {
    sendNativeMessageAsync("search-logins", {
      origin: message.origin,
      query: message.query
    }).then((res) => sendResponse(res));
    return true;
  }
  if (message.type === "GET_LOGIN") {
    sendNativeMessageAsync("get-login", {
      id: message.id,
      origin: message.origin
    }).then((res) => sendResponse(res));
    return true;
  }
  if (message.type === "GENERATE_PASSWORD") {
    sendNativeMessageAsync("generate-password", message.options).then((res) => sendResponse(res));
    return true;
  }
  if (message.type === "SAVE_LOGIN") {
    const payload = message.payload;
    sendNativeMessageAsync("save-login", payload).then((res) => {
      if (res.success && message.tabId) {
        candidateLogins.delete(message.tabId);
        chrome.action.setBadgeText({ tabId: message.tabId, text: "" });
      }
      sendResponse(res);
    });
    return true;
  }
  if (message.type === "LOCK_VAULT") {
    sendNativeMessageAsync("lock-vault").then((res) => sendResponse(res));
    return true;
  }
  if (message.type === "GET_CANDIDATE_LOGIN") {
    const candidate = message.tabId ? candidateLogins.get(message.tabId) : null;
    sendResponse(candidate || null);
    return true;
  }
  if (message.type === "DISMISS_CANDIDATE_LOGIN") {
    if (message.tabId) {
      candidateLogins.delete(message.tabId);
      chrome.action.setBadgeText({ tabId: message.tabId, text: "" });
    }
    sendResponse({ dismissed: true });
    return true;
  }
  if (message.type === "FILL_ACTIVE_TAB") {
    chrome.tabs.sendMessage(
      message.tabId,
      {
        type: "VOLTREX_FILL_CREDENTIALS",
        username: message.username,
        password: message.password
      },
      (res) => {
        sendResponse(res || { success: false });
      }
    );
    return true;
  }
  return false;
});
export {
  sendNativeMessageAsync
};
