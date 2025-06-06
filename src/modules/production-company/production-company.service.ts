import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  FindOptionsWhere,
  Like,
  In,
} from 'typeorm';
import { ProductionCompany } from './production-company.entity';
import { Movie } from '../movie/movie.entity';
import { INITIAL_PRODUCTION_COMPANIES } from '@/common/constants/production-companies.constant';
import api from '@/common/utils/axios.util';
import {
  CreateProductionCompanyDto,
  UpdateProductionCompanyDto,
  FindProductionCompaniesDto,
  AddMovieToCompanyDto,
} from './production-company.dto';

@Injectable()
export class ProductionCompanyService {
  constructor(
    @InjectRepository(ProductionCompany)
    private readonly productionCompanyRepository: Repository<ProductionCompany>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {
    // this.initializeProductionCompaniesFromMovies();
  }

  // CRUD operations for Production Companies
  async findAll(
    options?: FindManyOptions<ProductionCompany>,
  ): Promise<ProductionCompany[]> {
    return this.productionCompanyRepository.find({
      order: { name: 'ASC' },
      relations: ['logo'],
      ...options,
    });
  }

  async findWithCriteria(
    criteria: FindProductionCompaniesDto,
  ): Promise<ProductionCompany[]> {
    const where: FindOptionsWhere<ProductionCompany> = {};

    if (criteria.name) {
      where.name = Like(`%${criteria.name}%`);
    }
    if (criteria.origin_country) {
      where.origin_country = criteria.origin_country;
    }
    if (criteria.is_active !== undefined) {
      where.is_active = criteria.is_active;
    }

    return this.productionCompanyRepository.find({
      where,
      relations: ['logo'],
      order: { name: 'ASC' },
      take: criteria.limit || 50,
      skip: criteria.offset || 0,
    });
  }

  async findById(id: string): Promise<ProductionCompany | null> {
    return this.productionCompanyRepository.findOne({
      where: { id },
      relations: ['logo', 'movies'],
    });
  }

  async findByOriginalId(
    original_id: number,
  ): Promise<ProductionCompany | null> {
    return this.productionCompanyRepository.findOne({
      where: { original_id },
      relations: ['logo'],
    });
  }

  async findByName(name: string): Promise<ProductionCompany | null> {
    return this.productionCompanyRepository.findOne({
      where: { name },
      relations: ['logo'],
    });
  }

  async create(
    createDto: CreateProductionCompanyDto,
  ): Promise<ProductionCompany> {
    const company = this.productionCompanyRepository.create({
      ...createDto,
      logo: createDto.logo_id ? { id: createDto.logo_id } : undefined,
    });
    return this.productionCompanyRepository.save(company);
  }

  async update(
    id: string,
    updateDto: UpdateProductionCompanyDto,
  ): Promise<ProductionCompany | null> {
    const updateData = {
      ...updateDto,
      logo: updateDto.logo_id ? { id: updateDto.logo_id } : undefined,
    };

    const result = await this.productionCompanyRepository.update(
      id,
      updateData,
    );
    if (result.affected === 0) {
      return null;
    }
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.productionCompanyRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findOrCreate(
    companyData: CreateProductionCompanyDto,
  ): Promise<ProductionCompany> {
    let company = await this.findByOriginalId(companyData.original_id);

    if (!company) {
      company = await this.create(companyData);
    }

    return company;
  }

  // Movie-ProductionCompany relationship operations
  async addMovieToCompany(addDto: AddMovieToCompanyDto): Promise<void> {
    await this.productionCompanyRepository
      .createQueryBuilder()
      .relation(ProductionCompany, 'movies')
      .of(addDto.production_company_id)
      .add(addDto.movie_id);
  }

  async removeMovieFromCompany(
    companyId: string,
    movieId: string,
  ): Promise<void> {
    await this.productionCompanyRepository
      .createQueryBuilder()
      .relation(ProductionCompany, 'movies')
      .of(companyId)
      .remove(movieId);
  }

  async findCompaniesByMovie(movieId: string): Promise<ProductionCompany[]> {
    return this.productionCompanyRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.logo', 'logo')
      .leftJoin('pc.movies', 'movie')
      .where('movie.id = :movieId', { movieId })
      .andWhere('pc.is_active = :isActive', { isActive: true })
      .orderBy('pc.name', 'ASC')
      .getMany();
  }

  async findMoviesByCompany(
    companyId: string,
    limit?: number,
  ): Promise<Movie[]> {
    const query = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.poster', 'poster')
      .leftJoinAndSelect('movie.backdrop', 'backdrop')
      .leftJoinAndSelect('movie.genres', 'genres')
      .leftJoin('movie.production_companies', 'pc')
      .where('pc.id = :companyId', { companyId })
      .orderBy('movie.release_date', 'DESC');

    if (limit) {
      query.limit(limit);
    }

    return query.getMany();
  }

  async getPopularCompanies(limit: number = 20): Promise<ProductionCompany[]> {
    return this.productionCompanyRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.logo', 'logo')
      .leftJoin('pc.movies', 'movie')
      .where('pc.is_active = :isActive', { isActive: true })
      .groupBy('pc.id')
      .orderBy('COUNT(movie.id)', 'DESC')
      .addOrderBy('pc.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  async getCompaniesByCountry(country: string): Promise<ProductionCompany[]> {
    return this.productionCompanyRepository.find({
      where: {
        origin_country: country,
        is_active: true,
      },
      relations: ['logo'],
      order: { name: 'ASC' },
    });
  }

  async bulkAddMoviesToCompany(
    companyId: string,
    movieIds: string[],
  ): Promise<void> {
    if (movieIds.length === 0) return;

    await this.productionCompanyRepository
      .createQueryBuilder()
      .relation(ProductionCompany, 'movies')
      .of(companyId)
      .add(movieIds);
  }

  async searchCompanies(
    searchTerm: string,
    limit: number = 10,
  ): Promise<ProductionCompany[]> {
    return this.productionCompanyRepository
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.logo', 'logo')
      .where('pc.name ILIKE :searchTerm', { searchTerm: `%${searchTerm}%` })
      .andWhere('pc.is_active = :isActive', { isActive: true })
      .orderBy('pc.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  /**
   * Initialize default production companies from INITIAL_PRODUCTION_COMPANIES constant
   * This can be called on application startup to ensure popular companies are available
   * @returns Array of created/found production company entities
   */
  async initializeDefaultCompanies(): Promise<ProductionCompany[]> {
    const companies: ProductionCompany[] = [];

    for (let i = 0; i < INITIAL_PRODUCTION_COMPANIES.length; i++) {
      const companyData = INITIAL_PRODUCTION_COMPANIES[i];

      try {
        // Check if company already exists by original_id
        let company = await this.findByOriginalId(companyData.original_id);

        if (!company) {
          // Map origin_country to locale_code and iso_639_1
          const languageInfo = this.getLanguageInfoFromCountry(
            companyData.origin_country || 'US',
          );

          // Create new company if it doesn't exist
          const createDto: CreateProductionCompanyDto = {
            name: companyData.name,
            description: companyData.description,
            homepage: companyData.homepage,
            headquarters: companyData.headquarters,
            origin_country: companyData.origin_country,
            parent_company: companyData.parent_company || undefined,
            locale_code: languageInfo.locale_code,
            iso_639_1: languageInfo.iso_639_1,
            original_id: companyData.original_id,
            is_active: true,
          };

          company = await this.create(createDto);
          console.log(`Created production company: ${company.name}`);
        } else {
          console.log(`Production company already exists: ${company.name}`);
        }

        companies.push(company);
      } catch (error) {
        console.error(
          `Error initializing production company ${companyData.name}:`,
          error,
        );
        // Continue with other companies even if one fails
      }
    }

    console.log(`Initialized ${companies.length} production companies`);
    return companies;
  }

  /**
   * Get all initial production companies from the INITIAL_PRODUCTION_COMPANIES constant
   * @returns Array of initial company data
   */
  getInitialCompanies() {
    return INITIAL_PRODUCTION_COMPANIES;
  }

  /**
   * Find initial company information by name from INITIAL_PRODUCTION_COMPANIES constant
   * This does not query the database, just provides info from the constant
   * @param name Company name
   * @returns Company info object or null if not in initial companies
   */
  findInitialCompanyByName(name: string) {
    const company = INITIAL_PRODUCTION_COMPANIES.find(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    return company || null;
  }

  /**
   * Find initial company information by original_id from INITIAL_PRODUCTION_COMPANIES constant
   * This does not query the database, just provides info from the constant
   * @param originalId Original TMDB company ID
   * @returns Company info object or null if not in initial companies
   */
  findInitialCompanyByOriginalId(originalId: number) {
    const company = INITIAL_PRODUCTION_COMPANIES.find(
      (c) => c.original_id === originalId,
    );
    return company || null;
  }

  /**
   * Initialize production companies by fetching data from all movies' TMDB details
   * This function will get all movies from database, fetch their TMDB details,
   * extract production companies, and save them to database
   * @returns Promise<ProductionCompany[]> Array of created/found production companies
   */
  async initializeProductionCompaniesFromMovies(): Promise<
    ProductionCompany[]
  > {
    console.log(
      'Starting initialization of production companies from movies...',
    );

    try {
      // Get all movies with their original_id (TMDB ID)
      const movies = await this.movieRepository
        .createQueryBuilder('movie')
        .select(['movie.id', 'movie.original_id', 'movie.title'])
        .where('movie.original_id IS NOT NULL')
        .getMany();

      console.log(`Found ${movies.length} movies with TMDB IDs`);

      const createdCompanies: ProductionCompany[] = [];
      const processedCompanyIds = new Set<number>();
      let processedMovies = 0;

      // Process movies in batches to avoid rate limiting
      const BATCH_SIZE = 10;

      for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const movieBatch = movies.slice(i, i + BATCH_SIZE);

        console.log(
          `Processing movies ${i + 1}-${Math.min(i + BATCH_SIZE, movies.length)} of ${movies.length}`,
        );

        // Process each movie in the batch
        for (const movie of movieBatch) {
          try {
            // Fetch movie details from TMDB
            const movieDetails = await this.fetchMovieDetailsFromTMDB(
              movie.original_id,
            );

            if (movieDetails && movieDetails.production_companies) {
              // Process each production company
              for (const companyData of movieDetails.production_companies) {
                // Skip if we've already processed this company
                if (processedCompanyIds.has(companyData.id)) {
                  continue;
                }

                try {
                  // Fetch detailed company information from TMDB
                  const companyDetails = await this.fetchCompanyDetailsFromTMDB(
                    companyData.id,
                  );

                  if (companyDetails) {
                    // Check if company already exists in database
                    let existingCompany = await this.findByOriginalId(
                      companyDetails.id,
                    );

                    if (!existingCompany) {
                      // Create new company
                      const createDto: CreateProductionCompanyDto = {
                        name: companyDetails.name,
                        description: companyDetails.description || undefined,
                        homepage: companyDetails.homepage || undefined,
                        headquarters: companyDetails.headquarters || undefined,
                        origin_country:
                          companyDetails.origin_country || undefined,
                        parent_company:
                          companyDetails.parent_company || undefined,
                        locale_code: companyDetails.locale_code,
                        iso_639_1: companyDetails.iso_639_1,
                        original_id: companyDetails.id,
                        is_active: true,
                      };

                      const newCompany = await this.create(createDto);
                      createdCompanies.push(newCompany);

                      // Add the production company to the movie using proper relation
                      await this.addMovieToCompany({
                        production_company_id: newCompany.id,
                        movie_id: movie.id,
                      });

                      console.log(
                        `Created production company: ${newCompany.name} (ID: ${newCompany.original_id})`,
                      );
                    } else {
                      // Check if the existing company is already associated with this movie
                      const isAlreadyAssociated = await this.movieRepository
                        .createQueryBuilder('movie')
                        .leftJoin('movie.production_companies', 'pc')
                        .where('movie.id = :movieId', { movieId: movie.id })
                        .andWhere('pc.id = :companyId', {
                          companyId: existingCompany.id,
                        })
                        .getOne();

                      if (!isAlreadyAssociated) {
                        // Add the existing company to the movie
                        await this.addMovieToCompany({
                          production_company_id: existingCompany.id,
                          movie_id: movie.id,
                        });
                      }

                      console.log(
                        `Production company already exists: ${existingCompany.name} (ID: ${existingCompany.original_id})`,
                      );
                    }

                    processedCompanyIds.add(companyData.id);
                  }
                } catch (companyError) {
                  console.error(
                    `Error processing company ${companyData.id} from movie ${movie.title}:`,
                    companyError.message,
                  );
                  // Continue with other companies
                }
              }
            }

            processedMovies++;

            // Add delay to respect TMDB rate limits (40 requests per 10 seconds)
            await this.delay(300); // 300ms delay between requests
          } catch (movieError) {
            console.error(
              `Error processing movie ${movie.title} (TMDB ID: ${movie.original_id}):`,
              movieError.message,
            );
            // Continue with other movies
          }
        }

        // Additional delay between batches
        await this.delay(1000);
      }

      console.log(
        `Completed initialization: Processed ${processedMovies} movies, created ${createdCompanies.length} new production companies`,
      );
      return createdCompanies;
    } catch (error) {
      console.error('Error during production companies initialization:', error);
      throw error;
    }
  }

  /**
   * Fetch movie details from TMDB API
   * @param movieId TMDB movie ID
   * @returns Movie details including production companies
   */
  private async fetchMovieDetailsFromTMDB(movieId: number): Promise<any> {
    try {
      const response = await api.get(`/movie/${movieId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Movie ${movieId} not found on TMDB`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch production company details from TMDB API
   * @param companyId TMDB company ID
   * @returns Company details
   */
  private async fetchCompanyDetailsFromTMDB(companyId: number): Promise<{
    id: number;
    name: string;
    description?: string;
    homepage?: string;
    headquarters?: string;
    origin_country?: string;
    parent_company?: string;
    logo_path?: string;
    locale_code: string;
    iso_639_1: string;
  } | null> {
    try {
      const response = await api.get<{
        id: number;
        name: string;
        description?: string;
        homepage?: string;
        headquarters?: string;
        origin_country?: string;
        parent_company?: string;
        logo_path?: string;
      }>(`/company/${companyId}`);

      const companyData = response.data;

      // Map origin_country to locale_code and iso_639_1
      const languageInfo = this.getLanguageInfoFromCountry(
        companyData.origin_country || 'US',
      );

      return {
        ...companyData,
        locale_code: languageInfo.locale_code,
        iso_639_1: languageInfo.iso_639_1,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Company ${companyId} not found on TMDB`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Map country code to language information
   * @param countryCode ISO 3166-1 country code
   * @returns Language information including locale_code and iso_639_1
   */
  private getLanguageInfoFromCountry(countryCode: string): {
    locale_code: string;
    iso_639_1: string;
  } {
    // Mapping of common countries to their primary languages
    const countryLanguageMap: Record<
      string,
      { locale_code: string; iso_639_1: string }
    > = {
      US: { locale_code: 'en-US', iso_639_1: 'en' },
      GB: { locale_code: 'en-GB', iso_639_1: 'en' },
      CA: { locale_code: 'en-CA', iso_639_1: 'en' },
      AU: { locale_code: 'en-AU', iso_639_1: 'en' },
      FR: { locale_code: 'fr-FR', iso_639_1: 'fr' },
      DE: { locale_code: 'de-DE', iso_639_1: 'de' },
      IT: { locale_code: 'it-IT', iso_639_1: 'it' },
      ES: { locale_code: 'es-ES', iso_639_1: 'es' },
      MX: { locale_code: 'es-MX', iso_639_1: 'es' },
      AR: { locale_code: 'es-AR', iso_639_1: 'es' },
      BR: { locale_code: 'pt-BR', iso_639_1: 'pt' },
      PT: { locale_code: 'pt-PT', iso_639_1: 'pt' },
      RU: { locale_code: 'ru-RU', iso_639_1: 'ru' },
      CN: { locale_code: 'zh-CN', iso_639_1: 'zh' },
      HK: { locale_code: 'zh-HK', iso_639_1: 'zh' },
      TW: { locale_code: 'zh-TW', iso_639_1: 'zh' },
      JP: { locale_code: 'ja-JP', iso_639_1: 'ja' },
      KR: { locale_code: 'ko-KR', iso_639_1: 'ko' },
      IN: { locale_code: 'hi-IN', iso_639_1: 'hi' },
      TR: { locale_code: 'tr-TR', iso_639_1: 'tr' },
      NL: { locale_code: 'nl-NL', iso_639_1: 'nl' },
      SE: { locale_code: 'sv-SE', iso_639_1: 'sv' },
      NO: { locale_code: 'no-NO', iso_639_1: 'no' },
      DK: { locale_code: 'da-DK', iso_639_1: 'da' },
      FI: { locale_code: 'fi-FI', iso_639_1: 'fi' },
      PL: { locale_code: 'pl-PL', iso_639_1: 'pl' },
      CZ: { locale_code: 'cs-CZ', iso_639_1: 'cs' },
      HU: { locale_code: 'hu-HU', iso_639_1: 'hu' },
      GR: { locale_code: 'el-GR', iso_639_1: 'el' },
      TH: { locale_code: 'th-TH', iso_639_1: 'th' },
      VN: { locale_code: 'vi-VN', iso_639_1: 'vi' },
      ID: { locale_code: 'id-ID', iso_639_1: 'id' },
      MY: { locale_code: 'ms-MY', iso_639_1: 'ms' },
      PH: { locale_code: 'en-PH', iso_639_1: 'en' },
      SG: { locale_code: 'en-SG', iso_639_1: 'en' },
      ZA: { locale_code: 'en-ZA', iso_639_1: 'en' },
      NG: { locale_code: 'en-NG', iso_639_1: 'en' },
      EG: { locale_code: 'ar-EG', iso_639_1: 'ar' },
      SA: { locale_code: 'ar-SA', iso_639_1: 'ar' },
      IL: { locale_code: 'he-IL', iso_639_1: 'he' },
      IR: { locale_code: 'fa-IR', iso_639_1: 'fa' },
      PK: { locale_code: 'ur-PK', iso_639_1: 'ur' },
      BD: { locale_code: 'bn-BD', iso_639_1: 'bn' },
      LK: { locale_code: 'si-LK', iso_639_1: 'si' },
      NP: { locale_code: 'ne-NP', iso_639_1: 'ne' },
      MM: { locale_code: 'my-MM', iso_639_1: 'my' },
      KH: { locale_code: 'km-KH', iso_639_1: 'km' },
      LA: { locale_code: 'lo-LA', iso_639_1: 'lo' },
      MN: { locale_code: 'mn-MN', iso_639_1: 'mn' },
      KZ: { locale_code: 'kk-KZ', iso_639_1: 'kk' },
      UZ: { locale_code: 'uz-UZ', iso_639_1: 'uz' },
      AM: { locale_code: 'hy-AM', iso_639_1: 'hy' },
      GE: { locale_code: 'ka-GE', iso_639_1: 'ka' },
      AZ: { locale_code: 'az-AZ', iso_639_1: 'az' },
    };

    return (
      countryLanguageMap[countryCode] || {
        locale_code: 'en-US',
        iso_639_1: 'en',
      }
    );
  }

  /**
   * Utility function to add delay between API calls
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
