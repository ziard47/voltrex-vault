import { describe, it, expect } from 'vitest';
import {
  getCanonicalOrigin,
  parseOrigin,
  isAllowedAutofillOrigin,
  doOriginsMatch,
  validateCandidateUrl,
} from '../src/shared/origin';

describe('Strict Origin Matching & Security (Phase 3)', () => {
  it('extracts canonical origin and strips default ports', () => {
    expect(getCanonicalOrigin('https://github.com/login')).toBe('https://github.com');
    expect(getCanonicalOrigin('https://github.com:443/session')).toBe('https://github.com');
    expect(getCanonicalOrigin('http://localhost:80/home')).toBe('http://localhost');
    expect(getCanonicalOrigin('https://api.github.com:8443/v1')).toBe('https://api.github.com:8443');
  });

  it('normalizes uppercase hostnames to lowercase', () => {
    expect(getCanonicalOrigin('HTTPS://GITHUB.COM/login')).toBe('https://github.com');
    expect(getCanonicalOrigin('https://MyVault.CORP.Internal:8080/')).toBe(
      'https://myvault.corp.internal:8080'
    );
  });

  it('enforces strict subdomain separation', () => {
    // sub.example.com must never match example.com
    expect(doOriginsMatch('https://sub.example.com', 'https://example.com')).toBe(false);
    expect(doOriginsMatch('https://login.live.com', 'https://live.com')).toBe(false);
    expect(doOriginsMatch('https://accounts.google.com', 'https://google.com')).toBe(false);
    expect(doOriginsMatch('https://app.slack.com', 'https://myteam.slack.com')).toBe(false);

    // Exact matches
    expect(doOriginsMatch('https://github.com', 'https://github.com/settings')).toBe(true);
    expect(doOriginsMatch('https://github.com:443', 'https://github.com')).toBe(true);
  });

  it('enforces strict port separation', () => {
    expect(doOriginsMatch('https://localhost:3000', 'https://localhost:8080')).toBe(false);
    expect(doOriginsMatch('https://mycorp.internal:8443', 'https://mycorp.internal:9443')).toBe(
      false
    );
    expect(doOriginsMatch('https://localhost:3000', 'https://localhost:3000/api')).toBe(true);
  });

  it('enforces scheme separation', () => {
    expect(doOriginsMatch('http://example.com', 'https://example.com')).toBe(false);
  });

  it('restricts autofill on cleartext HTTP pages by default', () => {
    // Insecure public HTTP rejected
    expect(isAllowedAutofillOrigin('http://example.com')).toBe(false);
    expect(isAllowedAutofillOrigin('http://insecure-bank.org/login')).toBe(false);
    expect(isAllowedAutofillOrigin('http://192.168.1.100/admin')).toBe(false);

    // Secure HTTPS allowed
    expect(isAllowedAutofillOrigin('https://example.com')).toBe(true);
    expect(isAllowedAutofillOrigin('https://sub.domain.com:8443')).toBe(true);

    // Localhost / Loopback HTTP allowed for developer convenience
    expect(isAllowedAutofillOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedAutofillOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isAllowedAutofillOrigin('http://[::1]:8080')).toBe(true);
  });

  it('handles internationalized domain names (IDN / Punycode)', () => {
    // Standard URL parser converts unicode domains to punycode
    const origin1 = getCanonicalOrigin('https://münchen.de/portal');
    const origin2 = getCanonicalOrigin('https://xn--mnchen-3ya.de/portal');
    expect(origin1).toBe('https://xn--mnchen-3ya.de');
    expect(origin2).toBe('https://xn--mnchen-3ya.de');
    expect(doOriginsMatch('https://münchen.de', 'https://xn--mnchen-3ya.de')).toBe(true);

    // Lookalike protection: Cyrillic 'а' (U+0430) vs Latin 'a' (U+0061)
    const cyrillicApple = getCanonicalOrigin('https://аpple.com'); // Cyrillic 'а'
    const latinApple = getCanonicalOrigin('https://apple.com'); // Latin 'a'
    expect(cyrillicApple).not.toBe(latinApple);
    expect(doOriginsMatch('https://аpple.com', 'https://apple.com')).toBe(false);
  });

  it('validates candidate URLs thoroughly', () => {
    expect(validateCandidateUrl('').isValid).toBe(false);
    expect(validateCandidateUrl('javascript:alert(1)').isValid).toBe(false);
    expect(validateCandidateUrl('file:///etc/passwd').isValid).toBe(false);
    expect(validateCandidateUrl('http://insecure.com').isValid).toBe(false);

    const validHttps = validateCandidateUrl('https://app.github.com/login');
    expect(validHttps.isValid).toBe(true);
    expect(validHttps.origin).toBe('https://app.github.com');
  });
});
