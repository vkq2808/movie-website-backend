import { Injectable } from '@nestjs/common';
import { Language } from '../../language/language.entity';
import { LanguageService } from '../../language/language.service';
import { TOP_LANGUAGES } from '@/common/constants/languages.constant';
import { api } from '@/common/utils';

@Injectable()
export class LanguageCrawlerService {
  constructor(private readonly languageService: LanguageService) { }

  async initializeLanguagesInBatches(): Promise<Language[]> {
    const BATCH_SIZE = 5;
    const languages: Language[] = [];
    const topLanguages = TOP_LANGUAGES;
    for (let i = 0; i < topLanguages.length; i += BATCH_SIZE) {
      const batch = topLanguages.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((lang) =>
        this.languageService
          .findOrCreate({ iso_639_1: lang.code })
          .catch((error) => {
            console.error(`Failed to initialize language ${lang.code}:`, error);
            return null;
          }),
      );
      const batchResults = await Promise.all(batchPromises);
      languages.push(
        ...batchResults.filter((lang): lang is Language => lang !== null),
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return languages;
  }

  async crawlAllLanguages(): Promise<void> {
    try {
      type LangItem = {
        name: string;
        english_name: string;
        iso_639_1: string;
      };
      const languageDatas = (await api.get<LangItem[]>(`/configuration/languages`)).data;
      const dataArray: LangItem[] = Array.isArray(languageDatas) ? languageDatas : [];
      for (const languageInfo of dataArray) {
        try {
          await this.languageService.create({
            name: languageInfo.name,
            english_name: languageInfo.english_name,
            iso_639_1: languageInfo.iso_639_1,
          });
        } catch {
          continue;
        }
      }
    } catch (e: unknown) {
      console.error("error when crawl languages:", e);
    }
  }
}
