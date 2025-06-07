import { TOP_LANGUAGES } from '../constants/languages.constant';

/**
 * Interface for language information
 */
export interface LanguageInfo {
  /**
   * ISO 639-1 language code (e.g., 'en', 'fr', 'ja')
   */
  iso_639_1: string;

  /**
   * Full locale code (e.g., 'en-US', 'fr-FR', 'ja-JP')
   */
  locale_code: string;

  /**
   * Language name in English
   */
  name?: string;
}

/**
 * Country-language mapping to convert ISO 3166-1 country codes to ISO 639-1 language codes
 * This map associates country codes with both their locale code and language code
 */
export const COUNTRY_LANGUAGE_MAP: Record<string, LanguageInfo> = {
  // English-speaking countries
  US: { locale_code: 'en-US', iso_639_1: 'en' },
  GB: { locale_code: 'en-GB', iso_639_1: 'en' },
  CA: { locale_code: 'en-CA', iso_639_1: 'en' },
  AU: { locale_code: 'en-AU', iso_639_1: 'en' },
  NZ: { locale_code: 'en-NZ', iso_639_1: 'en' },
  IE: { locale_code: 'en-IE', iso_639_1: 'en' },

  // European countries
  FR: { locale_code: 'fr-FR', iso_639_1: 'fr' },
  DE: { locale_code: 'de-DE', iso_639_1: 'de' },
  IT: { locale_code: 'it-IT', iso_639_1: 'it' },
  ES: { locale_code: 'es-ES', iso_639_1: 'es' },
  PT: { locale_code: 'pt-PT', iso_639_1: 'pt' },
  NL: { locale_code: 'nl-NL', iso_639_1: 'nl' },
  BE: { locale_code: 'nl-BE', iso_639_1: 'nl' }, // Belgium (also has French)
  LU: { locale_code: 'fr-LU', iso_639_1: 'fr' }, // Luxembourg
  CH: { locale_code: 'de-CH', iso_639_1: 'de' }, // Switzerland (also has French, Italian)
  AT: { locale_code: 'de-AT', iso_639_1: 'de' }, // Austria
  DK: { locale_code: 'da-DK', iso_639_1: 'da' }, // Denmark
  SE: { locale_code: 'sv-SE', iso_639_1: 'sv' }, // Sweden
  NO: { locale_code: 'no-NO', iso_639_1: 'no' }, // Norway
  FI: { locale_code: 'fi-FI', iso_639_1: 'fi' }, // Finland
  GR: { locale_code: 'el-GR', iso_639_1: 'el' }, // Greece
  PL: { locale_code: 'pl-PL', iso_639_1: 'pl' }, // Poland
  CZ: { locale_code: 'cs-CZ', iso_639_1: 'cs' }, // Czech Republic
  SK: { locale_code: 'sk-SK', iso_639_1: 'sk' }, // Slovakia
  HU: { locale_code: 'hu-HU', iso_639_1: 'hu' }, // Hungary

  // Asian countries
  CN: { locale_code: 'zh-CN', iso_639_1: 'zh' }, // China
  TW: { locale_code: 'zh-TW', iso_639_1: 'zh' }, // Taiwan
  HK: { locale_code: 'zh-HK', iso_639_1: 'zh' }, // Hong Kong
  JP: { locale_code: 'ja-JP', iso_639_1: 'ja' }, // Japan
  KR: { locale_code: 'ko-KR', iso_639_1: 'ko' }, // South Korea
  TH: { locale_code: 'th-TH', iso_639_1: 'th' }, // Thailand
  VN: { locale_code: 'vi-VN', iso_639_1: 'vi' }, // Vietnam
  ID: { locale_code: 'id-ID', iso_639_1: 'id' }, // Indonesia
  MY: { locale_code: 'ms-MY', iso_639_1: 'ms' }, // Malaysia
  PH: { locale_code: 'fil-PH', iso_639_1: 'fil' }, // Philippines
  SG: { locale_code: 'en-SG', iso_639_1: 'en' }, // Singapore
  IN: { locale_code: 'hi-IN', iso_639_1: 'hi' }, // India (Hindi, but has many languages)

  // Middle Eastern countries
  SA: { locale_code: 'ar-SA', iso_639_1: 'ar' }, // Saudi Arabia
  AE: { locale_code: 'ar-AE', iso_639_1: 'ar' }, // UAE
  EG: { locale_code: 'ar-EG', iso_639_1: 'ar' }, // Egypt
  IL: { locale_code: 'he-IL', iso_639_1: 'he' }, // Israel
  TR: { locale_code: 'tr-TR', iso_639_1: 'tr' }, // Turkey
  IR: { locale_code: 'fa-IR', iso_639_1: 'fa' }, // Iran
  IQ: { locale_code: 'ar-IQ', iso_639_1: 'ar' }, // Iraq
  JO: { locale_code: 'ar-JO', iso_639_1: 'ar' }, // Jordan
  LB: { locale_code: 'ar-LB', iso_639_1: 'ar' }, // Lebanon

  // Latin American countries
  MX: { locale_code: 'es-MX', iso_639_1: 'es' }, // Mexico
  BR: { locale_code: 'pt-BR', iso_639_1: 'pt' }, // Brazil
  AR: { locale_code: 'es-AR', iso_639_1: 'es' }, // Argentina
  CL: { locale_code: 'es-CL', iso_639_1: 'es' }, // Chile
  CO: { locale_code: 'es-CO', iso_639_1: 'es' }, // Colombia
  PE: { locale_code: 'es-PE', iso_639_1: 'es' }, // Peru
  VE: { locale_code: 'es-VE', iso_639_1: 'es' }, // Venezuela
  UY: { locale_code: 'es-UY', iso_639_1: 'es' }, // Uruguay
  PY: { locale_code: 'es-PY', iso_639_1: 'es' }, // Paraguay
  BO: { locale_code: 'es-BO', iso_639_1: 'es' }, // Bolivia
  EC: { locale_code: 'es-EC', iso_639_1: 'es' }, // Ecuador

  // Russian-speaking and other Eastern European countries
  RU: { locale_code: 'ru-RU', iso_639_1: 'ru' }, // Russia
  BY: { locale_code: 'ru-BY', iso_639_1: 'ru' }, // Belarus
  UA: { locale_code: 'uk-UA', iso_639_1: 'uk' }, // Ukraine (Ukrainian)
  KZ: { locale_code: 'kk-KZ', iso_639_1: 'kk' }, // Kazakhstan
  UZ: { locale_code: 'uz-UZ', iso_639_1: 'uz' }, // Uzbekistan

  // African countries
  ZA: { locale_code: 'en-ZA', iso_639_1: 'en' }, // South Africa
  NG: { locale_code: 'en-NG', iso_639_1: 'en' }, // Nigeria
  KE: { locale_code: 'sw-KE', iso_639_1: 'sw' }, // Kenya (Swahili)
  GH: { locale_code: 'en-GH', iso_639_1: 'en' }, // Ghana

  // South Asian and other countries
  PK: { locale_code: 'ur-PK', iso_639_1: 'ur' }, // Pakistan (Urdu)
  BD: { locale_code: 'bn-BD', iso_639_1: 'bn' }, // Bangladesh (Bengali)
  LK: { locale_code: 'si-LK', iso_639_1: 'si' }, // Sri Lanka (Sinhala)
  NP: { locale_code: 'ne-NP', iso_639_1: 'ne' }, // Nepal
  MM: { locale_code: 'my-MM', iso_639_1: 'my' }, // Myanmar
  KH: { locale_code: 'km-KH', iso_639_1: 'km' }, // Cambodia
  LA: { locale_code: 'lo-LA', iso_639_1: 'lo' }, // Laos
  MN: { locale_code: 'mn-MN', iso_639_1: 'mn' }, // Mongolia
  AM: { locale_code: 'hy-AM', iso_639_1: 'hy' }, // Armenia
  GE: { locale_code: 'ka-GE', iso_639_1: 'ka' }, // Georgia
  AZ: { locale_code: 'az-AZ', iso_639_1: 'az' }, // Azerbaijan
};

/**
 * Returns language information for a given country code
 * 
 * @param countryCode ISO 3166-1 country code (e.g., 'US', 'FR', 'JP')
 * @returns Language information including ISO 639-1 code and locale code
 */
export function getLanguageInfoFromCountry(countryCode: string): LanguageInfo {
  if (!countryCode) {
    return { locale_code: 'en-US', iso_639_1: 'en' };
  }

  // Standardize input
  const code = countryCode.toUpperCase();

  // Get language info from map
  const languageInfo = COUNTRY_LANGUAGE_MAP[code];

  if (languageInfo) {
    // If the language info exists, try to enhance it with the language name
    const languageFromTopLanguages = TOP_LANGUAGES.find(
      (lang) => lang.code === languageInfo.iso_639_1,
    );

    if (languageFromTopLanguages) {
      return {
        ...languageInfo,
        name: languageFromTopLanguages.name,
      };
    }

    return languageInfo;
  }

  // Default to English if country code not found
  return { locale_code: 'en-US', iso_639_1: 'en' };
}

/**
 * Simplified version that only returns the ISO 639-1 language code
 * 
 * @param countryCode ISO 3166-1 country code (e.g., 'US', 'FR', 'JP')
 * @returns ISO 639-1 language code (e.g., 'en', 'fr', 'ja')
 */
export function getLanguageCodeFromCountry(countryCode: string): string {
  return getLanguageInfoFromCountry(countryCode).iso_639_1;
}

/**
 * Returns the locale code for a given country code
 * 
 * @param countryCode ISO 3166-1 country code (e.g., 'US', 'FR', 'JP')
 * @returns Locale code (e.g., 'en-US', 'fr-FR', 'ja-JP')
 */
export function getLocaleFromCountry(countryCode: string): string {
  return getLanguageInfoFromCountry(countryCode).locale_code;
}

/**
 * Returns the English name of a language for a given ISO 639-1 code
 * 
 * @param languageCode ISO 639-1 language code (e.g., 'en', 'fr', 'ja')
 * @returns Language name in English or the code itself if not found
 */
export function getLanguageNameFromCode(languageCode: string): string {
  if (!languageCode) return 'Unknown';

  const language = TOP_LANGUAGES.find((lang) => lang.code === languageCode);
  return language ? language.name : languageCode;
}
