import { describe, it, expect } from 'vitest';
import { parseCsvRows, parseCsvToExportData } from '../src/shared/csv-importer';

describe('CSV Importer Engine', () => {
  it('parses RFC 4180 CSV with quotes, commas, and escaped quotes', () => {
    const csv = `name,url,username,password,notes\n"Google, Inc.",https://google.com,alice,"p@ss,w""ord","Line 1\nLine 2"`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('Google, Inc.');
    expect(rows[1][1]).toBe('https://google.com');
    expect(rows[1][2]).toBe('alice');
    expect(rows[1][3]).toBe('p@ss,w"ord');
    expect(rows[1][4]).toBe('Line 1\nLine 2');
  });

  it('imports Bitwarden format CSV', () => {
    const bitwardenCsv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
,1,login,GitHub,,0,0,https://github.com,octocat,Secret123!,JBSWY3DPEHPK3PXP
,0,card,Personal Visa,,0,0,,,,`;

    const data = parseCsvToExportData(bitwardenCsv);
    expect(data.entries).toHaveLength(2);

    const login = data.entries[0];
    expect(login.type).toBe('login');
    expect(login.title).toBe('GitHub');
    expect(login.isFavorite).toBe(true);
    if (login.payload.type === 'login') {
      expect(login.payload.username).toBe('octocat');
      expect(login.payload.password).toBe('Secret123!');
      expect(login.payload.url).toBe('https://github.com');
    }

    const card = data.entries[1];
    expect(card.type).toBe('card');
    expect(card.title).toBe('Personal Visa');
    expect(card.isFavorite).toBe(false);
  });

  it('imports Google Chrome passwords CSV', () => {
    const chromeCsv = `name,url,username,password,note
Netflix,https://www.netflix.com/login,user@example.com,NetFlixPwd99,Family account`;

    const data = parseCsvToExportData(chromeCsv);
    expect(data.entries).toHaveLength(1);

    const entry = data.entries[0];
    expect(entry.type).toBe('login');
    expect(entry.title).toBe('Netflix');
    if (entry.payload.type === 'login') {
      expect(entry.payload.username).toBe('user@example.com');
      expect(entry.payload.password).toBe('NetFlixPwd99');
      expect(entry.payload.notes).toBe('Family account');
    }
  });

  it('imports 1Password and generic CSV formats', () => {
    const genericCsv = `Title,Website,User Name,Password,Notes
Amazon,https://amazon.com,buyer@domain.com,SuperSecretAmazon!,Prime member`;

    const data = parseCsvToExportData(genericCsv);
    expect(data.entries).toHaveLength(1);

    const entry = data.entries[0];
    expect(entry.type).toBe('login');
    expect(entry.title).toBe('Amazon');
    if (entry.payload.type === 'login') {
      expect(entry.payload.username).toBe('buyer@domain.com');
      expect(entry.payload.password).toBe('SuperSecretAmazon!');
    }
  });
});
