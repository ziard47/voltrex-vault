/**
 * Voltrex Vault - Validation and Sanitization Module
 * Validates untrusted IPC messages, imported datasets, and entry payloads.
 */

import {
  VaultEntryPayload,
  LoginPayload,
  NotePayload,
  CardPayload,
  IdentityPayload,
  PasswordGeneratorOptions,
  VaultSettings,
  ExportData,
  EntryType
} from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateString(value: unknown, fieldName: string, minLength = 0, maxLength = 10000): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Field '${fieldName}' must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new ValidationError(`Field '${fieldName}' must be at least ${minLength} characters.`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(`Field '${fieldName}' cannot exceed ${maxLength} characters.`);
  }
  return trimmed;
}

export function validateOptionalString(value: unknown, fieldName: string, maxLength = 10000): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return validateString(value, fieldName, 0, maxLength);
}

export function validateEntryType(type: unknown): EntryType {
  if (type === 'login' || type === 'note' || type === 'card' || type === 'identity') {
    return type;
  }
  throw new ValidationError(`Invalid entry type: ${String(type)}`);
}

export function validateTags(tags: unknown): string[] {
  if (!tags) return [];
  if (!Array.isArray(tags)) {
    throw new ValidationError('Tags must be an array of strings.');
  }
  return tags
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map(t => t.trim().slice(0, 50));
}

export function validatePayload(payload: unknown): VaultEntryPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Entry payload must be a valid object.');
  }

  const obj = payload as Record<string, unknown>;
  const type = validateEntryType(obj.type);
  const title = validateString(obj.title, 'title', 1, 200);
  const tags = validateTags(obj.tags);
  const notes = validateOptionalString(obj.notes, 'notes', 50000);

  switch (type) {
    case 'login': {
      const username = validateString(obj.username ?? '', 'username', 0, 500);
      const password = validateString(obj.password ?? '', 'password', 0, 5000);
      const url = validateOptionalString(obj.url, 'url', 2000);
      const loginPayload: LoginPayload = {
        type: 'login',
        title,
        username,
        password,
        url,
        tags,
        notes,
      };
      return loginPayload;
    }
    case 'note': {
      const content = validateString(obj.content ?? '', 'content', 0, 500000);
      const notePayload: NotePayload = {
        type: 'note',
        title,
        content,
        tags,
        notes,
      };
      return notePayload;
    }
    case 'card': {
      const cardholderName = validateString(obj.cardholderName ?? '', 'cardholderName', 0, 200);
      const cardNumber = validateString(obj.cardNumber ?? '', 'cardNumber', 0, 50);
      const expirationMonth = validateString(obj.expirationMonth ?? '', 'expirationMonth', 0, 2);
      const expirationYear = validateString(obj.expirationYear ?? '', 'expirationYear', 0, 4);
      const cvv = validateString(obj.cvv ?? '', 'cvv', 0, 10);
      const pin = validateOptionalString(obj.pin, 'pin', 20);
      const cardPayload: CardPayload = {
        type: 'card',
        title,
        cardholderName,
        cardNumber,
        expirationMonth,
        expirationYear,
        cvv,
        pin,
        tags,
        notes,
      };
      return cardPayload;
    }
    case 'identity': {
      const fullName = validateString(obj.fullName ?? '', 'fullName', 0, 200);
      const email = validateOptionalString(obj.email, 'email', 200);
      const phone = validateOptionalString(obj.phone, 'phone', 50);
      const address = validateOptionalString(obj.address, 'address', 500);
      const company = validateOptionalString(obj.company, 'company', 200);
      const nationalId = validateOptionalString(obj.nationalId, 'nationalId', 100);
      const identityPayload: IdentityPayload = {
        type: 'identity',
        title,
        fullName,
        email,
        phone,
        address,
        company,
        nationalId,
        tags,
        notes,
      };
      return identityPayload;
    }
  }
}

export function validateSettings(settings: unknown): VaultSettings {
  if (!settings || typeof settings !== 'object') {
    throw new ValidationError('Settings must be an object.');
  }
  const obj = settings as Record<string, unknown>;
  const autoLockMinutes = Number(obj.autoLockMinutes);
  if (isNaN(autoLockMinutes) || autoLockMinutes < 0 || autoLockMinutes > 1440) {
    throw new ValidationError('autoLockMinutes must be between 0 and 1440.');
  }

  const clipboardClearSeconds = Number(obj.clipboardClearSeconds);
  if (isNaN(clipboardClearSeconds) || clipboardClearSeconds < 5 || clipboardClearSeconds > 600) {
    throw new ValidationError('clipboardClearSeconds must be between 5 and 600.');
  }

  return {
    autoLockMinutes,
    clipboardClearSeconds,
  };
}

export function validatePartialSettings(settings: unknown): Partial<VaultSettings> {
  if (!settings || typeof settings !== 'object') {
    throw new ValidationError('Settings must be an object.');
  }
  const obj = settings as Record<string, unknown>;
  const result: Partial<VaultSettings> = {};

  if (obj.autoLockMinutes !== undefined) {
    const autoLockMinutes = Number(obj.autoLockMinutes);
    if (isNaN(autoLockMinutes) || autoLockMinutes < 0 || autoLockMinutes > 1440) {
      throw new ValidationError('autoLockMinutes must be between 0 and 1440.');
    }
    result.autoLockMinutes = autoLockMinutes;
  }

  if (obj.clipboardClearSeconds !== undefined) {
    const clipboardClearSeconds = Number(obj.clipboardClearSeconds);
    if (isNaN(clipboardClearSeconds) || clipboardClearSeconds < 5 || clipboardClearSeconds > 600) {
      throw new ValidationError('clipboardClearSeconds must be between 5 and 600.');
    }
    result.clipboardClearSeconds = clipboardClearSeconds;
  }

  return result;
}

export function validatePasswordGeneratorOptions(options: unknown): PasswordGeneratorOptions {
  if (!options || typeof options !== 'object') {
    throw new ValidationError('Options must be an object.');
  }
  const obj = options as Record<string, unknown>;
  const length = obj.length !== undefined ? Number(obj.length) : 20;
  if (isNaN(length) || length < 8 || length > 128) {
    throw new ValidationError('Password length must be between 8 and 128.');
  }

  const includeUppercase = obj.includeUppercase !== undefined ? Boolean(obj.includeUppercase) : true;
  const includeLowercase = obj.includeLowercase !== undefined ? Boolean(obj.includeLowercase) : true;
  const includeNumbers = obj.includeNumbers !== undefined ? Boolean(obj.includeNumbers) : true;
  const includeSymbols = obj.includeSymbols !== undefined ? Boolean(obj.includeSymbols) : true;
  const excludeAmbiguous = obj.excludeAmbiguous !== undefined ? Boolean(obj.excludeAmbiguous) : true;

  if (!includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols) {
    throw new ValidationError('At least one character set must be selected.');
  }

  return {
    length,
    includeUppercase,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    excludeAmbiguous,
  };
}

export function validateExportData(data: unknown): ExportData {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Import data is not a valid JSON object.');
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== 'voltrex-vault-unencrypted-export') {
    throw new ValidationError('Unsupported or unrecognized export format.');
  }
  if (!Array.isArray(obj.entries)) {
    throw new ValidationError('Export entries must be an array.');
  }

  const validatedEntries = obj.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ValidationError(`Entry at index ${index} is invalid.`);
    }
    const e = entry as Record<string, unknown>;
    const type = validateEntryType(e.type);
    const title = validateString(e.title, `entry[${index}].title`, 1, 200);
    const isFavorite = Boolean(e.isFavorite);
    const createdAt = typeof e.createdAt === 'number' ? e.createdAt : Date.now();
    const updatedAt = typeof e.updatedAt === 'number' ? e.updatedAt : Date.now();
    const payload = validatePayload(e.payload);

    return {
      id: typeof e.id === 'string' && e.id.length > 0 ? e.id : crypto.randomUUID(),
      type,
      title,
      isFavorite,
      createdAt,
      updatedAt,
      payload,
    };
  });

  return {
    format: 'voltrex-vault-unencrypted-export',
    exportVersion: 1,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
    entries: validatedEntries,
  };
}
