import { describe, it, expect } from 'vitest';
import {
  generateSecurePassword,
  calculateEntropy,
  getStrengthLabel,
} from '../src/main/crypto/generator';

describe('Password Generator', () => {
  it('generates password of requested length', () => {
    for (const len of [12, 16, 24, 32, 64]) {
      const result = generateSecurePassword({ length: len });
      expect(result.password).toHaveLength(len);
      expect(result.entropyBits).toBeGreaterThan(0);
    }
  });

  it('guarantees inclusion of characters from all selected pools', () => {
    const result = generateSecurePassword({
      length: 24,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeAmbiguous: false,
    });

    expect(/[A-Z]/.test(result.password)).toBe(true);
    expect(/[a-z]/.test(result.password)).toBe(true);
    expect(/[0-9]/.test(result.password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(result.password)).toBe(true);
  });

  it('excludes ambiguous characters when option is enabled', () => {
    const ambiguousChars = ['0', 'O', 'o', '1', 'l', 'I'];
    for (let i = 0; i < 20; i++) {
      const result = generateSecurePassword({
        length: 32,
        excludeAmbiguous: true,
      });
      for (const char of ambiguousChars) {
        expect(result.password).not.toContain(char);
      }
    }
  });

  it('calculates entropy and assigns appropriate strength labels', () => {
    expect(calculateEntropy('123456', 10)).toBeLessThan(30);
    expect(getStrengthLabel(20)).toBe('Weak');
    expect(getStrengthLabel(45)).toBe('Fair');
    expect(getStrengthLabel(65)).toBe('Good');
    expect(getStrengthLabel(80)).toBe('Strong');
    expect(getStrengthLabel(110)).toBe('Very Strong');
  });
});
