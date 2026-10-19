import { describe, it, expect } from 'vitest';
import {
  validatePayload,
  validateSettings,
  validateExportData,
  ValidationError,
} from '../src/shared/validation';

describe('Validation Module', () => {
  it('validates and sanitizes a valid login payload', () => {
    const raw = {
      type: 'login',
      title: '  GitHub  ',
      username: 'user@example.com',
      password: 'password123',
      url: 'https://github.com',
      tags: ['dev', 'git'],
    };

    const validated = validatePayload(raw);
    expect(validated.type).toBe('login');
    expect(validated.title).toBe('GitHub');
    expect((validated as any).username).toBe('user@example.com');
  });

  it('rejects payloads missing a title', () => {
    const raw = {
      type: 'login',
      title: '   ',
      username: 'admin',
      password: 'pwd',
    };
    expect(() => validatePayload(raw)).toThrow(ValidationError);
  });

  it('rejects invalid entry types', () => {
    const raw = {
      type: 'unsupported_type',
      title: 'Some title',
    };
    expect(() => validatePayload(raw)).toThrow(ValidationError);
  });

  it('validates settings and enforces bounds', () => {
    const valid = validateSettings({
      autoLockMinutes: 15,
      clipboardClearSeconds: 30,
    });
    expect(valid.autoLockMinutes).toBe(15);
    expect(valid.clipboardClearSeconds).toBe(30);

    expect(() => validateSettings({ autoLockMinutes: -5, clipboardClearSeconds: 30 })).toThrow(ValidationError);
    expect(() => validateSettings({ autoLockMinutes: 15, clipboardClearSeconds: 1 })).toThrow(ValidationError);
  });

  it('validates export payload and rejects corrupted JSON structures', () => {
    expect(() => validateExportData(null)).toThrow(ValidationError);
    expect(() => validateExportData({ format: 'invalid-format' })).toThrow(ValidationError);
    expect(() => validateExportData({ format: 'voltrex-vault-unencrypted-export', entries: 'not-an-array' })).toThrow(ValidationError);

    const validExport = {
      format: 'voltrex-vault-unencrypted-export',
      exportVersion: 1,
      exportedAt: Date.now(),
      entries: [
        {
          id: 'test-id-1',
          type: 'note',
          title: 'Meeting Notes',
          isFavorite: false,
          payload: {
            type: 'note',
            title: 'Meeting Notes',
            content: 'Project discussion',
          },
        },
      ],
    };

    const validated = validateExportData(validExport);
    expect(validated.entries).toHaveLength(1);
    expect(validated.entries[0].title).toBe('Meeting Notes');
  });
});
