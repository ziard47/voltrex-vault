/**
 * Voltrex Vault - Chrome Extension Background Service Worker
 * Mediates between popup UI / content scripts and the Chrome Native Messaging host.
 * Keeps zero plaintext secrets in storage; holds transient candidates in memory only.
 */

import {
  NATIVE_HOST_NAME,
  NativeAction,
  NativeRequest,
  NativeResponse,
  SaveLoginRequest,
} from '../../shared/extension-types';
import { getCanonicalOrigin } from '../../shared/origin';

interface CandidateLogin {
  tabId: number;
  origin: string;
  url: string;
  username: string;
  password: string;
  timestamp: number;
}

// In-memory candidate storage keyed by tabId (destroyed on tab close / navigation)
const candidateLogins = new Map<number, CandidateLogin>();

/**
 * Sends a native messaging request to com.voltrex.vault host with timeout.
 */
export function sendNativeMessageAsync<T = any>(
  action: NativeAction,
  payload?: any,
  timeoutMs = 5000
): Promise<NativeResponse<T>> {
  const requestId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const request: NativeRequest = {
    id: requestId,
    action,
    payload,
  };

  return new Promise((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        resolve({
          id: requestId,
          success: false,
          error: `Native host timed out after ${timeoutMs}ms. Is Voltrex Vault running?`,
        });
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST_NAME,
        request,
        (response: NativeResponse<T> | undefined) => {
          if (completed) return;
          completed = true;
          clearTimeout(timer);

          const lastError = chrome.runtime.lastError;
          if (lastError || !response) {
            resolve({
              id: requestId,
              success: false,
              error:
                lastError?.message ||
                'Could not communicate with Voltrex Vault native messaging host. Please ensure the host is registered.',
            });
            return;
          }

          resolve(response);
        }
      );
    } catch (err: any) {
      if (!completed) {
        completed = true;
        clearTimeout(timer);
        resolve({
          id: requestId,
          success: false,
          error: err.message || 'Error executing native message call.',
        });
      }
    }
  });
}

/**
 * Returns canonical origin and info of active tab in current window.
 */
async function getActiveTabInfo(): Promise<{ tabId: number; url: string; origin: string | null } | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab || !activeTab.id || !activeTab.url) return null;

  return {
    tabId: activeTab.id,
    url: activeTab.url,
    origin: getCanonicalOrigin(activeTab.url),
  };
}

// Clean up candidate logins when tab is closed or navigates
chrome.tabs.onRemoved.addListener((tabId) => {
  candidateLogins.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    candidateLogins.delete(tabId);
  }
});

// Main message router for popup and content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Content script candidate capture
  if (message.type === 'VOLTREX_CANDIDATE_LOGIN') {
    const tabId = sender.tab?.id;
    if (tabId && message.origin && message.password) {
      candidateLogins.set(tabId, {
        tabId,
        origin: message.origin,
        url: message.url || message.origin,
        username: message.username || '',
        password: message.password,
        timestamp: Date.now(),
      });
      // Optionally notify badge on action icon
      chrome.action.setBadgeText({ tabId, text: '+' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#A7D129' });
    }
    sendResponse({ received: true });
    return true;
  }

  // 2. Active tab inspection for popup
  if (message.type === 'GET_ACTIVE_TAB_INFO') {
    getActiveTabInfo().then((tabInfo) => sendResponse(tabInfo));
    return true;
  }

  // 3. Vault status
  if (message.type === 'GET_STATUS') {
    sendNativeMessageAsync('status').then((res) => sendResponse(res));
    return true;
  }

  // 4. Search logins for active tab origin or search term
  if (message.type === 'SEARCH_LOGINS') {
    sendNativeMessageAsync('search-logins', {
      origin: message.origin,
      query: message.query,
    }).then((res) => sendResponse(res));
    return true;
  }

  // 5. Retrieve single credential with origin enforcement
  if (message.type === 'GET_LOGIN') {
    sendNativeMessageAsync('get-login', {
      id: message.id,
      origin: message.origin,
    }).then((res) => sendResponse(res));
    return true;
  }

  // 6. Generate secure password with entropy
  if (message.type === 'GENERATE_PASSWORD') {
    sendNativeMessageAsync('generate-password', message.options).then((res) => sendResponse(res));
    return true;
  }

  // 7. Save login entry to desktop vault
  if (message.type === 'SAVE_LOGIN') {
    const payload = message.payload as SaveLoginRequest;
    sendNativeMessageAsync('save-login', payload).then((res) => {
      if (res.success && message.tabId) {
        candidateLogins.delete(message.tabId);
        chrome.action.setBadgeText({ tabId: message.tabId, text: '' });
      }
      sendResponse(res);
    });
    return true;
  }

  // 8. Lock desktop vault
  if (message.type === 'LOCK_VAULT') {
    sendNativeMessageAsync('lock-vault').then((res) => sendResponse(res));
    return true;
  }

  // 9. Candidate inspection & dismissal
  if (message.type === 'GET_CANDIDATE_LOGIN') {
    const candidate = message.tabId ? candidateLogins.get(message.tabId) : null;
    sendResponse(candidate || null);
    return true;
  }

  if (message.type === 'DISMISS_CANDIDATE_LOGIN') {
    if (message.tabId) {
      candidateLogins.delete(message.tabId);
      chrome.action.setBadgeText({ tabId: message.tabId, text: '' });
    }
    sendResponse({ dismissed: true });
    return true;
  }

  // 10. Autofill command sent to active tab's content script
  if (message.type === 'FILL_ACTIVE_TAB') {
    chrome.tabs.sendMessage(
      message.tabId,
      {
        type: 'VOLTREX_FILL_CREDENTIALS',
        username: message.username,
        password: message.password,
      },
      (res: any) => {
        sendResponse(res || { success: false });
      }
    );
    return true;
  }

  return false;
});
