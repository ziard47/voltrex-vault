import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isSafeFrameContext,
  detectLoginFields,
  setInputValueSafely,
  fillCredentials,
} from '../src/extension/content/autofill';

describe('Autofill Security & Field Detection Engine (Phase 3)', () => {
  const originalWindow = global.window;
  const originalDocument = global.document;

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    vi.restoreAllMocks();
  });

  describe('Frame Isolation Security (isSafeFrameContext)', () => {
    it('allows execution when in top-level window context', () => {
      const mockWindow = {} as any;
      mockWindow.self = mockWindow;
      mockWindow.top = mockWindow;
      mockWindow.location = { origin: 'https://linear.app' };
      global.window = mockWindow;

      expect(isSafeFrameContext()).toBe(true);
    });

    it('allows execution in same-origin iframe', () => {
      const topWindow = { location: { origin: 'https://linear.app' } };
      const childWindow = {} as any;
      childWindow.self = childWindow;
      childWindow.top = topWindow;
      childWindow.parent = topWindow;
      childWindow.location = { origin: 'https://linear.app' };
      global.window = childWindow;

      expect(isSafeFrameContext()).toBe(true);
    });

    it('blocks execution in cross-origin iframe with differing origin', () => {
      const topWindow = { location: { origin: 'https://attacker.evil' } };
      const childWindow = {} as any;
      childWindow.self = childWindow;
      childWindow.top = topWindow;
      childWindow.parent = topWindow;
      childWindow.location = { origin: 'https://bank.com' };
      global.window = childWindow;

      expect(isSafeFrameContext()).toBe(false);
    });

    it('blocks execution when parent window access throws cross-origin DOMException', () => {
      const childWindow = {} as any;
      childWindow.self = childWindow;
      Object.defineProperty(childWindow, 'top', {
        get() {
          throw new Error('Blocked a frame with origin "https://attacker.evil" from accessing a cross-origin frame.');
        },
      });
      global.window = childWindow;

      expect(isSafeFrameContext()).toBe(false);
    });
  });

  describe('Login Field Detection (detectLoginFields)', () => {
    function createMockInput(attributes: Record<string, string>, disabled = false): any {
      return {
        tagName: 'INPUT',
        getAttribute: (attr: string) => attributes[attr] || null,
        id: attributes.id || '',
        name: attributes.name || '',
        type: attributes.type || 'text',
        disabled,
        offsetParent: {}, // visible
        style: { display: 'block' },
        closest: vi.fn(),
      };
    }

    it('identifies username and password fields in a form', () => {
      const userField = createMockInput({ type: 'text', name: 'user_login', autocomplete: 'username' });
      const passField = createMockInput({ type: 'password', name: 'user_password' });

      const mockDoc = {
        querySelectorAll: (selector: string) => {
          if (selector.includes('type="password"')) {
            return [passField];
          }
          if (selector.includes('type="text"')) {
            return [userField];
          }
          return [];
        },
      } as any;

      const fields = detectLoginFields(mockDoc);
      expect(fields.passwordInput).toBe(passField);
      expect(fields.usernameInput).toBe(userField);
    });

    it('prioritizes autocomplete="username" over preceding text fields', () => {
      const searchBox = createMockInput({ type: 'text', name: 'search_query' });
      const userField = createMockInput({ type: 'text', name: 'login', autocomplete: 'username' });
      const passField = createMockInput({ type: 'password', name: 'password' });

      const mockDoc = {
        querySelectorAll: (selector: string) => {
          if (selector.includes('type="password"')) return [passField];
          if (selector.includes('type="text"')) return [searchBox, userField];
          return [];
        },
      } as any;

      const fields = detectLoginFields(mockDoc);
      expect(fields.usernameInput).toBe(userField);
    });

    it('ignores disabled or hidden password fields', () => {
      const disabledPass = createMockInput({ type: 'password' }, true);
      const mockDoc = {
        querySelectorAll: (selector: string) => {
          if (selector.includes('type="password"')) return [disabledPass];
          return [];
        },
      } as any;

      const fields = detectLoginFields(mockDoc);
      expect(fields.passwordInput).toBeNull();
    });
  });

  describe('Safe Input Setting (setInputValueSafely)', () => {
    it('sets value and dispatches input and change events without triggering submission', () => {
      const dispatchedEvents: string[] = [];
      const mockInput = {
        value: '',
        dispatchEvent: (evt: any) => {
          dispatchedEvents.push(evt.type);
          return true;
        },
      } as any;

      // Mock Event constructor
      (global as any).Event = class MockEvent {
        constructor(public type: string, public options?: any) {}
      };

      // Mock window.HTMLInputElement
      global.window = {
        HTMLInputElement: {
          prototype: {
            value: '',
          },
        },
      } as any;

      setInputValueSafely(mockInput, 'supersecretpassword123');

      expect(mockInput.value).toBe('supersecretpassword123');
      expect(dispatchedEvents).toContain('input');
      expect(dispatchedEvents).toContain('change');
    });
  });

  describe('User-Driven Credential Filling (fillCredentials)', () => {
    it('refuses to fill if not in safe frame context', () => {
      const childWindow = {} as any;
      childWindow.self = childWindow;
      childWindow.top = { location: { origin: 'https://evil.com' } };
      childWindow.parent = childWindow.top;
      childWindow.location = { origin: 'https://victim.com' };
      global.window = childWindow;

      const result = fillCredentials('admin', 'pass123');
      expect(result.success).toBe(false);
      expect(result.filled).toHaveLength(0);
    });

    it('fills username and password when present and never triggers auto-submit', () => {
      const userField: any = {
        value: '',
        dispatchEvent: vi.fn(),
        offsetParent: {},
        style: {},
        getAttribute: () => null,
        closest: vi.fn(),
      };
      const passField: any = {
        value: '',
        dispatchEvent: vi.fn(),
        offsetParent: {},
        style: {},
        getAttribute: () => null,
        closest: vi.fn(),
      };

      const mockWindow = {} as any;
      mockWindow.self = mockWindow;
      mockWindow.top = mockWindow;
      mockWindow.location = { origin: 'https://linear.app' };
      mockWindow.HTMLInputElement = { prototype: { value: '' } };
      global.window = mockWindow;

      (global as any).Event = class MockEvent {
        constructor(public type: string) {}
      };

      global.document = {
        querySelectorAll: (selector: string) => {
          if (selector.includes('type="password"')) return [passField];
          if (selector.includes('type="text"')) return [userField];
          return [];
        },
      } as any;

      const result = fillCredentials('designer@linear.app', 'SecretPass2026!');
      expect(result.success).toBe(true);
      expect(result.filled).toEqual(['username', 'password']);
      expect(userField.value).toBe('designer@linear.app');
      expect(passField.value).toBe('SecretPass2026!');
    });
  });
});
