"use strict";
/**
 * Voltrex Vault - Validation and Sanitization Module
 * Validates untrusted IPC messages, imported datasets, and entry payloads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validateString = validateString;
exports.validateOptionalString = validateOptionalString;
exports.validateEntryType = validateEntryType;
exports.validateTags = validateTags;
exports.validatePayload = validatePayload;
exports.validateSettings = validateSettings;
exports.validatePartialSettings = validatePartialSettings;
exports.validatePasswordGeneratorOptions = validatePasswordGeneratorOptions;
exports.validateExportData = validateExportData;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
function validateString(value, fieldName, minLength = 0, maxLength = 10000) {
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
function validateOptionalString(value, fieldName, maxLength = 10000) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    return validateString(value, fieldName, 0, maxLength);
}
function validateEntryType(type) {
    if (type === 'login' || type === 'note' || type === 'card' || type === 'identity') {
        return type;
    }
    throw new ValidationError(`Invalid entry type: ${String(type)}`);
}
function validateTags(tags) {
    if (!tags)
        return [];
    if (!Array.isArray(tags)) {
        throw new ValidationError('Tags must be an array of strings.');
    }
    return tags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map(t => t.trim().slice(0, 50));
}
function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new ValidationError('Entry payload must be a valid object.');
    }
    const obj = payload;
    const type = validateEntryType(obj.type);
    const title = validateString(obj.title, 'title', 1, 200);
    const tags = validateTags(obj.tags);
    const notes = validateOptionalString(obj.notes, 'notes', 50000);
    switch (type) {
        case 'login': {
            const username = validateString(obj.username ?? '', 'username', 0, 500);
            const password = validateString(obj.password ?? '', 'password', 0, 5000);
            const url = validateOptionalString(obj.url, 'url', 2000);
            const loginPayload = {
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
            const notePayload = {
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
            const cardPayload = {
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
            const identityPayload = {
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
function validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        throw new ValidationError('Settings must be an object.');
    }
    const obj = settings;
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
function validatePartialSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        throw new ValidationError('Settings must be an object.');
    }
    const obj = settings;
    const result = {};
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
function validatePasswordGeneratorOptions(options) {
    if (!options || typeof options !== 'object') {
        throw new ValidationError('Options must be an object.');
    }
    const obj = options;
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
function validateExportData(data) {
    if (!data || typeof data !== 'object') {
        throw new ValidationError('Import data is not a valid JSON object.');
    }
    const obj = data;
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
        const e = entry;
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
