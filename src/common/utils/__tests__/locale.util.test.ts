import {
  getLanguageInfoFromCountry,
  getLanguageCodeFromCountry,
  getLocaleFromCountry,
  getLanguageNameFromCode,
} from '../locale.util';

describe('Locale Utility Functions', () => {
  describe('getLanguageInfoFromCountry', () => {
    it('should return language info for valid country codes', () => {
      const usInfo = getLanguageInfoFromCountry('US');
      expect(usInfo.iso_639_1).toBe('en');
      expect(usInfo.locale_code).toBe('en-US');

      const frInfo = getLanguageInfoFromCountry('FR');
      expect(frInfo.iso_639_1).toBe('fr');
      expect(frInfo.locale_code).toBe('fr-FR');

      const jpInfo = getLanguageInfoFromCountry('JP');
      expect(jpInfo.iso_639_1).toBe('ja');
      expect(jpInfo.locale_code).toBe('ja-JP');
    });

    it('should handle lowercase country codes', () => {
      const deInfo = getLanguageInfoFromCountry('de');
      expect(deInfo.iso_639_1).toBe('de');
      expect(deInfo.locale_code).toBe('de-DE');
    });

    it('should return default English for invalid or missing country codes', () => {
      const emptyInfo = getLanguageInfoFromCountry('');
      expect(emptyInfo.iso_639_1).toBe('en');
      expect(emptyInfo.locale_code).toBe('en-US');

      const invalidInfo = getLanguageInfoFromCountry('XX');
      expect(invalidInfo.iso_639_1).toBe('en');
      expect(invalidInfo.locale_code).toBe('en-US');
    });
  });

  describe('getLanguageCodeFromCountry', () => {
    it('should return correct language codes', () => {
      expect(getLanguageCodeFromCountry('US')).toBe('en');
      expect(getLanguageCodeFromCountry('FR')).toBe('fr');
      expect(getLanguageCodeFromCountry('JP')).toBe('ja');
      expect(getLanguageCodeFromCountry('CN')).toBe('zh');
      expect(getLanguageCodeFromCountry('VN')).toBe('vi');
    });

    it('should return default English for invalid codes', () => {
      expect(getLanguageCodeFromCountry('')).toBe('en');
      expect(getLanguageCodeFromCountry('XX')).toBe('en');
    });
  });

  describe('getLocaleFromCountry', () => {
    it('should return correct locale codes', () => {
      expect(getLocaleFromCountry('US')).toBe('en-US');
      expect(getLocaleFromCountry('FR')).toBe('fr-FR');
      expect(getLocaleFromCountry('JP')).toBe('ja-JP');
      expect(getLocaleFromCountry('BR')).toBe('pt-BR');
    });

    it('should return default en-US for invalid codes', () => {
      expect(getLocaleFromCountry('')).toBe('en-US');
      expect(getLocaleFromCountry('XX')).toBe('en-US');
    });
  });

  describe('getLanguageNameFromCode', () => {
    it('should return language names for valid codes', () => {
      const topLanguageCodes = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ru', 'ar', 'hi'];

      // This test assumes TOP_LANGUAGES contains these codes with proper names
      for (const code of topLanguageCodes) {
        const name = getLanguageNameFromCode(code);
        expect(name).not.toBe('Unknown');
        expect(name).not.toBe(code); // Should return a name, not just the code
      }
    });

    it('should return "Unknown" for empty code', () => {
      expect(getLanguageNameFromCode('')).toBe('Unknown');
    });
  });
});
