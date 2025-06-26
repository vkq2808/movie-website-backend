/**
 * Simplified locale utility for handling the most popular 20 languages
 * Converts between locale code (xx-XX), ISO 639-1 language code (xx), and ISO 3166-1 country code (XX)
 */

/**
 * The supported languages (based on your movie website languages)
 * Combined from the languages shown in the image and your backend
 */
export const SUPPORTED_LANGUAGES = [
  'en', // English
  'zh', // Mandarin Chinese (Standard Chinese)
  'hi', // Hindi
  'es', // Spanish
  'ar', // Arabic
  'bn', // Bengali
  'fr', // French
  'ru', // Russian
  'pt', // Portuguese
  'ur', // Urdu
  'id', // Indonesian
  'de', // German
  'ja', // Japanese
  'mr', // Marathi
  'te', // Telugu
  'tr', // Turkish
  'ta', // Tamil
  'yue', // Yue Chinese (Cantonese)
  'ko', // Korean
  'vi', // Vietnamese
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Language to native name mapping
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  zh: '中文',
  hi: 'हिन्दी',
  es: 'Español',
  ar: 'العربية',
  bn: 'বাংলা',
  fr: 'Français',
  ru: 'Русский',
  pt: 'Português',
  ur: 'اردو',
  id: 'Bahasa Indonesia',
  de: 'Deutsch',
  ja: '日本語',
  mr: 'मराठी',
  te: 'తెలుగు',
  tr: 'Türkçe',
  ta: 'தமிழ்',
  yue: '粵語',
  ko: '한국어',
  vi: 'Tiếng Việt',
};

/**
 * Default countries for each language
 */
export const LANGUAGE_TO_COUNTRY: Record<SupportedLanguage, string> = {
  en: 'US',
  zh: 'CN',
  hi: 'IN',
  es: 'ES',
  ar: 'SA',
  bn: 'BD',
  fr: 'FR',
  ru: 'RU',
  pt: 'PT',
  ur: 'PK',
  id: 'ID',
  de: 'DE',
  ja: 'JP',
  mr: 'IN',
  te: 'IN',
  tr: 'TR',
  ta: 'IN',
  yue: 'HK',
  ko: 'KR',
  vi: 'VN',
};

/**
 * Common country to language mapping
 * Note: Some countries may have multiple languages
 */
export const COUNTRY_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  CN: 'zh',
  SG: 'zh',
  TW: 'zh',
  IN: 'hi', // India has multiple languages (hi, mr, te, ta, etc.)
  ES: 'es',
  MX: 'es',
  CO: 'es',
  AR: 'es',
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  BD: 'bn',
  FR: 'fr',
  'CA-FR': 'fr',
  RU: 'ru',
  PT: 'pt',
  BR: 'pt',
  PK: 'ur',
  ID: 'id',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  JP: 'ja',
  TR: 'tr',
  HK: 'yue',
  KR: 'ko',
  VN: 'vi',
};

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return SUPPORTED_LANGUAGES.includes(
    language.toLowerCase() as SupportedLanguage,
  );
}

/**
 * Parse a locale code (e.g., en-US) into its language and country parts
 * Validates if the locale code is valid (contains a valid language code)
 * @param localeCode The locale code to parse
 * @returns Object with language and country parts, or null if invalid
 */
export function parseLocaleCode(
  localeCode: string,
): { language: string; country: string } | null {
  if (!localeCode || typeof localeCode !== 'string') {
    return null;
  }

  // Match valid locale format: xx or xx-XX or xx_XX
  const localeRegex = /^([a-z]{2,3})(?:[-_]([A-Z]{2,3}))?$/i;
  const match = localeCode.match(localeRegex);

  if (!match) {
    return null;
  }

  const language = match[1].toLowerCase();

  // Check if the language is in our supported list
  if (!isLanguageSupported(language)) {
    return null;
  }

  let country = match[2]?.toUpperCase() || '';

  // If country is not provided, try to get the default country for the language
  if (!country) {
    country = LANGUAGE_TO_COUNTRY[language as SupportedLanguage] || '';
  }

  return {
    language,
    country,
  };
}

/**
 * Create a locale code from language and country codes
 */
export function createLocaleCode(language: string, country?: string): string {
  if (!language) return 'en';

  const languageCode = language.toLowerCase();

  // Check if language is supported
  if (!isLanguageSupported(languageCode)) {
    return 'en';
  }

  const countryCode =
    country?.toUpperCase() ||
    LANGUAGE_TO_COUNTRY[languageCode as SupportedLanguage] ||
    '';

  return countryCode ? `${languageCode}-${countryCode}` : languageCode;
}

/**
 * Get language (ISO 639-1) code from locale code
 */
export function getLanguageFromLocale(localeCode: string): string {
  const parsed = parseLocaleCode(localeCode);
  return parsed ? parsed.language : 'en';
}

/**
 * Get country (ISO 3166-1) code from locale code
 */
export function getCountryFromLocale(localeCode: string): string {
  const parsed = parseLocaleCode(localeCode);
  return parsed ? parsed.country : 'US';
}

/**
 * Get language code from country code
 */
export function getLanguageFromCountry(countryCode: string): string {
  if (!countryCode) return 'en';
  const code = countryCode.toUpperCase();
  return COUNTRY_TO_LANGUAGE[code] || 'en';
}

/**
 * Get country code from language code
 */
export function getCountryFromLanguage(languageCode: string): string {
  if (!languageCode) return 'US';
  const code = languageCode.toLowerCase();
  return LANGUAGE_TO_COUNTRY[code as SupportedLanguage] || 'US';
}

/**
 * Get the native language name
 */
export function getLanguageName(languageCode: string): string {
  if (!languageCode) return 'English';
  const code = languageCode.toLowerCase() as SupportedLanguage;
  return LANGUAGE_NAMES[code] || languageCode;
}

/**
 * Get the native country name
 * Uses browser's Intl API if available
 */
export function getCountryName(countryCode: string): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();

  // Try browser's Intl API if available
  if (
    typeof window !== 'undefined' &&
    typeof Intl !== 'undefined' &&
    Intl.DisplayNames
  ) {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const name = regionNames.of(code);
      if (name) return name;
    } catch (e) {
      // Continue to fallback
    }
  }

  return code;
}

/**
 * Convert between ISO codes and locale formats
 */
export const localeConverter = {
  // ISO 639-1 language code to native name
  languageToName: (language: string) => getLanguageName(language),

  // ISO 3166-1 country code to country name
  countryToName: (country: string) => getCountryName(country),

  // ISO 639-1 language code to ISO 3166-1 country code
  languageToCountry: (language: string) => getCountryFromLanguage(language),

  // ISO 3166-1 country code to ISO 639-1 language code
  countryToLanguage: (country: string) => getLanguageFromCountry(country),

  // Convert locale code to language code
  localeToLanguage: (locale: string) => getLanguageFromLocale(locale),

  // Convert locale code to country code
  localeToCountry: (locale: string) => getCountryFromLocale(locale),

  // Create locale from language and country
  createLocale: (language: string, country?: string) =>
    createLocaleCode(language, country),

  // Parse locale into components
  parseLocale: (locale: string) => parseLocaleCode(locale),

  // Check if language is in our supported list
  isSupportedLanguage: (language: string) => isLanguageSupported(language),
};

export default localeConverter;
