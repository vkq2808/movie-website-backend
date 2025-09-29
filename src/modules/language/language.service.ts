import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Language } from './language.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
import { api } from '@/common/utils';
import { TOP_LANGUAGES } from '@/common/constants/languages.constant';
import { modelNames } from '@/common/constants/model-name.constant';

@Injectable()
export class LanguageService {
  constructor(
    @InjectRepository(Language)
    private readonly languageRepository: Repository<Language>,
  ) {
    // You can uncomment this line to initialize all top languages on service startup
    // this.initializeTopLanguages().then(() => console.log('Top languages initialized'));
  }

  /**
   * Find all languages
   * @returns Array of all language entities
   */
  async findAll(): Promise<Language[]> {
    return this.languageRepository.find({
      order: {
        name: 'ASC',
      },
    });
  }

  /**
   * Find a language by criteria
   * @param criteria Search criteria (id, iso_639_1, name, etc.)
   * @returns Language entity or null if not found
   */
  async findOne(
    criteria: FindOptionsWhere<Language>,
  ): Promise<Language | null> {
    return this.languageRepository.findOneBy(criteria);
  }

  /**
   * Find a language by its ISO code
   * @param iso_639_1 ISO 639-1 language code
   * @returns Language entity or null if not found
   */
  async findByIsoCode(iso_639_1: string): Promise<Language | null> {
    try {
      return this.languageRepository.findOneBy({ iso_639_1 });
    } catch (error) {
      console.error(
        `Error finding language with ISO code ${iso_639_1}:`,
        error,
      );
      // Fall back to simple query without transaction if transaction fails
      return await this.languageRepository.findOneBy({ iso_639_1 });
    }
  }

  /**
   * Find a language by name
   * @param name Language name
   * @returns Language entity or null if not found
   */
  async findByName(name: string): Promise<Language | null> {
    return this.languageRepository.findOneBy({ name });
  }

  /**
   * Create a new language
   * @param languageData Language data to create
   * @returns Created language entity
   */
  async create(languageData: {
    name: string;
    english_name: string;
    iso_639_1: string;
  }): Promise<Language> {
    // Try to find existing language first to avoid conflicts
    try {
      const existing = await this.findByIsoCode(languageData.iso_639_1);
      if (existing) {
        return existing;
      }

      const queryRunner =
        this.languageRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction('READ COMMITTED');

      try {
        const language = queryRunner.manager.create(Language, languageData);
        const saved = await queryRunner.manager.save(language);
        await queryRunner.commitTransaction();
        return saved;
      } catch (err: unknown) {
        await queryRunner.rollbackTransaction();

        // If error is due to duplicate entry, try to fetch the existing one
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code?: unknown }).code === '23505'
        ) {
          // PostgreSQL unique violation code
          const existing = await this.findByIsoCode(languageData.iso_639_1);
          if (existing) {
            return existing;
          }
        }
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      console.error(`Error creating language:`, error);
      // Fall back to simple create without transaction if transaction fails
      const language = this.languageRepository.create(languageData);
      return this.languageRepository.save(language);
    }
  }

  /**
   * Find a language by ISO code or create if it doesn't exist
   * @param languageData Language data
   * @returns Found or created language entity
   */
  async findOrCreate(languageData: { iso_639_1: string }): Promise<Language> {
    try {

      // Try to find the language by ISO code with timeout
      let language = await this.findByIsoCode(languageData.iso_639_1);
      // If not found, create a new one
      if (!language) {
        // First check if the language is in our TOP_LANGUAGES constant (fast in-memory lookup)
        console.log(
          `Language with ISO code ${languageData.iso_639_1} not found in database, checking TOP_LANGUAGES...`,
        );
        const topLanguageInfo = TOP_LANGUAGES.find(
          (lang) => lang.code === languageData.iso_639_1,
        );

        if (topLanguageInfo) {
          console.log(
            `Language with ISO code ${languageData.iso_639_1} found in TOP_LANGUAGES, creating from constant...`,
          );
          // Use the data from TOP_LANGUAGES if available
          language = await this.create({
            name: topLanguageInfo.name,
            english_name: topLanguageInfo.name,
            iso_639_1: topLanguageInfo.code,
          }).catch((error) => {
            console.error(
              'Failed to create language from TOP_LANGUAGES:',
              error,
            );
            throw error;
          });
        } else {
          console.log(
            `Language with ISO code ${languageData.iso_639_1} not found in TOP_LANGUAGES, fetching from API...`,
          );
          try {
            // Fall back to API call if not in TOP_LANGUAGES
            type LangItem = {
              name: string;
              english_name: string;
              iso_639_1: string;
            };
            const languageDatas = (await api.get<LangItem[]>(`/configuration/languages`)).data;
            const dataArray: LangItem[] = Array.isArray(languageDatas) ? languageDatas : [];
            const languageInfo = dataArray?.find(
              (lang) => lang.iso_639_1 === languageData.iso_639_1,
            );

            if (!languageInfo) {
              throw new Error(
                `Language with ISO code ${languageData.iso_639_1} not found in API`,
              );
            }

            language = await this.create({
              name: languageInfo.name,
              english_name: languageInfo.english_name,
              iso_639_1: languageInfo.iso_639_1,
            });
          } catch (apiError: unknown) {
            console.error('Failed to fetch language from API:', apiError);
            // Fallback to using ISO code as temporary data
            language = await this.create({
              name: languageData.iso_639_1,
              english_name: languageData.iso_639_1,
              iso_639_1: languageData.iso_639_1,
            });
            console.log(
              `Created temporary language entry for ${languageData.iso_639_1}`,
            );
          }
        }
      }

      return language;
    } catch (error) {
      console.error(
        `Error finding or creating language with ISO code ${languageData.iso_639_1}:`,
        error,
      );
      throw error; // Re-throw to handle it at a higher level if needed
    }
  }
  /**
   * Initialize all top languages from TOP_LANGUAGES constant into the database
   * This can be called on application startup to ensure all common languages are available
   * @returns Array of created/found language entities
   */
  async initializeTopLanguages(): Promise<Language[]> {
    const languages: Language[] = [];

    for (let i = 0; i < TOP_LANGUAGES.length; i++) {
      const langData = TOP_LANGUAGES[i];
      const language = await this.findOrCreate({ iso_639_1: langData.code });
      languages.push(language);
    }

    return languages;
  }

  /**
   * Get all top languages from the TOP_LANGUAGES constant
   * @returns Array of language codes and names
   */
  getTopLanguages() {
    return TOP_LANGUAGES;
  }

  /**
   * Find language information from TOP_LANGUAGES constant by ISO code
   * This does not query the database, just provides info from the constant
   * @param iso_639_1 ISO 639-1 language code
   * @returns Language info object or null if not in top languages
   */
  findTopLanguageByIsoCode(
    iso_639_1: string,
  ): { code: string; name: string } | null {
    const language = TOP_LANGUAGES.find((lang) => lang.code === iso_639_1);
    return language || null;
  }

  /**
   * Find popular languages based on movie count
   * @param limit Number of languages to return
   * @returns Array of language entities with movie count
   */
  async findPopularLanguages(limit: number = 3): Promise<Language[]> {
    // This query gets languages ordered by the number of movies that use them via production companies
    const query = `
      SELECT l.*, COUNT(DISTINCT m.id) as movie_count
      FROM "${modelNames.LANGUAGE}" l
      JOIN "${modelNames.PRODUCTION_COMPANY}" pc ON l.iso_639_1 = pc.origin_country
      JOIN "${modelNames.MOVIE_PRODUCTION_COMPANIES}" mpc ON pc.id = mpc."production_company_id"
      JOIN "${modelNames.MOVIE}" m ON m.id = mpc."movie_id"
      GROUP BY l.id, l.iso_639_1, l.name, l.english_name, l.created_at, l.updated_at
      ORDER BY movie_count DESC
      LIMIT $1
    `;

    try {
      const languages: Language[] = await this.languageRepository.query(query, [
        limit,
      ]);
      return languages;
    } catch (error) {
      console.error('Error finding popular languages:', error);

      // Fallback to returning top languages without count if query fails
      return this.languageRepository.find({
        take: limit,
        order: {
          name: 'ASC',
        },
      });
    }
  }
}
