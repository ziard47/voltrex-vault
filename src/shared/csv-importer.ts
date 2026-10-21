/**
 * Voltrex Vault - CSV Importer
 * Parses RFC 4180 CSV exports from Bitwarden, Google Chrome, 1Password, LastPass,
 * KeePass, and generic password managers, converting them into Voltrex Vault ExportData.
 */

import { EntryType, ExportData, VaultEntry, VaultEntryPayload } from './types';

/**
 * Robust RFC 4180 compliant CSV tokenizer and parser.
 * Handles multiline quoted values, escaped quotes (""), and delimiter variations.
 */
export function parseCsvRows(csvText: string): string[][] {
  // Strip BOM if present
  let text = csvText.replace(/^\uFEFF/, '');
  if (!text.trim()) return [];

  // Auto-detect delimiter from first line (comma, semicolon, or tab)
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }

      if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some(c => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      }

      if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some(c => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
        continue;
      }

      currentField += char;
      i++;
    }
  }

  // Push final field/row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(c => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes header keys for tolerant lookup across different password manager exports.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps CSV table rows to Voltrex Vault ExportData format.
 */
export function parseCsvToExportData(csvContent: string): ExportData {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or does not contain header and data rows.');
  }

  const rawHeaders = rows[0];
  const normalizedHeaders = rawHeaders.map(h => normalizeKey(h));

  // Build field index lookup helper
  const findIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const norm = normalizeKey(name);
      const idx = normalizedHeaders.indexOf(norm);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const titleIdx = findIndex(['title', 'name', 'account', 'service', 'item', 'itemname']);
  const usernameIdx = findIndex([
    'username',
    'user',
    'loginusername',
    'loginuser',
    'email',
    'login',
    'loginname',
    'accountname',
  ]);
  const passwordIdx = findIndex(['password', 'pass', 'loginpassword', 'secret']);
  const urlIdx = findIndex(['url', 'uri', 'loginuri', 'website', 'websiteurl', 'webpage', 'link']);
  const notesIdx = findIndex(['notes', 'note', 'comments', 'comment', 'extra', 'description']);
  const totpIdx = findIndex(['totp', 'logintotp', 'authenticator', 'otp']);
  const favIdx = findIndex(['favorite', 'fav', 'starred']);
  const typeIdx = findIndex(['type', 'itemtype', 'category']);

  // Payment card specific columns
  const cardholderIdx = findIndex(['cardholdername', 'cardholder', 'nameoncard']);
  const cardNumberIdx = findIndex(['cardnumber', 'number', 'creditcardnumber', 'ccnumber']);
  const expMonthIdx = findIndex(['expmonth', 'expirymonth', 'expirationmonth']);
  const expYearIdx = findIndex(['expyear', 'expiryyear', 'expirationyear']);
  const cvvIdx = findIndex(['cvv', 'cvc', 'securitycode', 'verificationcode']);

  const entries: VaultEntry[] = [];
  const now = Date.now();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(c => !c || c.trim() === '')) continue;

    const getVal = (idx: number): string => (idx !== -1 && row[idx] ? row[idx].trim() : '');

    const explicitType = getVal(typeIdx).toLowerCase();
    const titleVal = getVal(titleIdx);
    const username = getVal(usernameIdx);
    const password = getVal(passwordIdx);
    const url = getVal(urlIdx);
    const rawNotes = getVal(notesIdx);
    const totp = getVal(totpIdx);
    const notes = totp ? (rawNotes ? `${rawNotes}\nTOTP: ${totp}` : `TOTP: ${totp}`) : rawNotes;
    const favVal = getVal(favIdx).toLowerCase();
    const isFavorite = favVal === '1' || favVal === 'true' || favVal === 'yes' || favVal === 'y';

    const cardholder = getVal(cardholderIdx);
    const cardNumber = getVal(cardNumberIdx);
    const expMonth = getVal(expMonthIdx);
    const expYear = getVal(expYearIdx);
    const cvv = getVal(cvvIdx);

    // Determine target category
    let type: EntryType = 'login';
    if (
      explicitType === 'card' ||
      explicitType === 'payment' ||
      explicitType === 'credit card' ||
      cardNumber.length >= 8
    ) {
      type = 'card';
    } else if (
      explicitType === 'note' ||
      explicitType === 'secure note' ||
      explicitType === 'text' ||
      (!password && !username && !url && notes)
    ) {
      type = 'note';
    } else if (explicitType === 'identity') {
      type = 'identity';
    } else {
      type = 'login';
    }

    // Determine readable item title
    let title = titleVal;
    if (!title) {
      if (url) {
        try {
          const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
          title = parsedUrl.hostname.replace(/^www\./, '');
        } catch {
          title = url;
        }
      } else if (username) {
        title = `Login (${username})`;
      } else if (type === 'card') {
        title = `Card (${cardNumber.slice(-4) || 'Unknown'})`;
      } else if (type === 'note') {
        title = notes.slice(0, 30) || 'Imported Note';
      } else {
        title = `Imported Item ${r}`;
      }
    }

    // Construct appropriate payload
    let payload: VaultEntryPayload;
    if (type === 'login') {
      payload = {
        type: 'login',
        title,
        username,
        password,
        url: url || undefined,
        notes: notes || undefined,
      };
    } else if (type === 'card') {
      payload = {
        type: 'card',
        title,
        cardholderName: cardholder,
        cardNumber: cardNumber,
        expirationMonth: expMonth,
        expirationYear: expYear,
        cvv: cvv,
        notes: notes || undefined,
      };
    } else if (type === 'note') {
      payload = {
        type: 'note',
        title,
        content: notes || '',
        notes: notes || undefined,
      };
    } else {
      payload = {
        type: 'identity',
        title,
        fullName: username || title,
        notes: notes || undefined,
      };
    }

    entries.push({
      id: crypto.randomUUID(),
      type,
      title,
      isFavorite,
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
      payload,
    });
  }

  if (entries.length === 0) {
    throw new Error('No valid entries could be parsed from the provided CSV file.');
  }

  return {
    format: 'voltrex-vault-unencrypted-export',
    exportVersion: 1,
    exportedAt: now,
    entries,
  };
}
