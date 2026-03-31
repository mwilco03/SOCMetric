import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidUrl,
  isValidDate,
  isValidJiraDomain,
  sanitizeString,
  validateRequired,
  validateRange,
} from '../src/utils/validation';

describe('Validation', () => {
  describe('isValidEmail', () => {
    it('returns true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('returns false for invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('returns true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidJiraDomain', () => {
    it('returns true for valid domains', () => {
      expect(isValidJiraDomain('company.atlassian.net')).toBe(true);
      expect(isValidJiraDomain('my-team.atlassian.net')).toBe(true);
    });

    it('returns false for invalid domains', () => {
      expect(isValidJiraDomain('example.com')).toBe(false);
      expect(isValidJiraDomain('atlassian.net')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('removes dangerous characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
      expect(sanitizeString('test\'quote')).toBe('testquote');
    });
  });

  describe('validateRequired', () => {
    it('returns error for empty values', () => {
      expect(validateRequired('', 'Field')).toBe('Field is required');
      expect(validateRequired(null, 'Field')).toBe('Field is required');
    });

    it('returns null for valid values', () => {
      expect(validateRequired('value', 'Field')).toBe(null);
      expect(validateRequired(0, 'Field')).toBe(null);
    });
  });

  describe('validateRange', () => {
    it('returns error for out of range values', () => {
      expect(validateRange(5, 0, 100, 'Score')).toBe(null);
      expect(validateRange(150, 0, 100, 'Score')).toBe('Score must be between 0 and 100');
    });
  });
});

