import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  UseGuards
} from '@nestjs/common';
import { ProductionCompanyService } from './production-company.service';
import {
  CreateProductionCompanyDto,
  UpdateProductionCompanyDto,
  FindProductionCompaniesDto,
  AddMovieToCompanyDto
} from './production-company.dto';
import { JwtAuthGuard } from '../auth/strategy/jwt/jwt-auth.guard';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums/role.enum';

@Controller('production-companies')
export class ProductionCompanyController {
  constructor(
    private readonly productionCompanyService: ProductionCompanyService,
  ) { }

  @Get()
  async getAllCompanies(@Query() query: FindProductionCompaniesDto) {
    try {
      const companies = Object.keys(query).length > 0
        ? await this.productionCompanyService.findWithCriteria(query)
        : await this.productionCompanyService.findAll();

      return {
        success: true,
        data: companies,
        message: 'Production companies retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve production companies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('popular')
  async getPopularCompanies(@Query('limit') limit?: number) {
    try {
      const companies = await this.productionCompanyService.getPopularCompanies(limit || 20);
      return {
        success: true,
        data: companies,
        message: 'Popular production companies retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve popular production companies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('initialize')
  async initializeDefaultCompanies() {
    try {
      const companies = await this.productionCompanyService.initializeDefaultCompanies();
      return {
        success: true,
        data: {
          count: companies.length,
          companies: companies.map(c => ({
            id: c.id,
            name: c.name,
            origin_country: c.origin_country
          }))
        },
        message: `Successfully initialized ${companies.length} default production companies`,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to initialize default production companies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('initialize-from-movies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async initializeProductionCompaniesFromMovies() {
    try {
      const companies = await this.productionCompanyService.initializeProductionCompaniesFromMovies();
      return {
        success: true,
        data: {
          count: companies.length,
          companies: companies.map(c => ({
            id: c.id,
            name: c.name,
            origin_country: c.origin_country,
            original_id: c.original_id
          }))
        },
        message: `Successfully initialized ${companies.length} production companies from movies`,
      };
    } catch (error) {
      console.error('Error initializing production companies from movies:', error);
      throw new HttpException(
        'Failed to initialize production companies from movies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('search')
  async searchCompanies(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number
  ) {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new HttpException('Search term is required', HttpStatus.BAD_REQUEST);
      }

      const companies = await this.productionCompanyService.searchCompanies(
        searchTerm.trim(),
        limit || 10
      );

      return {
        success: true,
        data: companies,
        message: 'Search results retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to search production companies',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('by-country/:country')
  async getCompaniesByCountry(@Param('country') country: string) {
    try {
      const companies = await this.productionCompanyService.getCompaniesByCountry(country);
      return {
        success: true,
        data: companies,
        message: `Production companies from ${country} retrieved successfully`,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve production companies by country',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getCompanyById(@Param('id') id: string) {
    try {
      const company = await this.productionCompanyService.findById(id);
      if (!company) {
        throw new HttpException('Production company not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: company,
        message: 'Production company retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/movies')
  async getMoviesByCompany(
    @Param('id') id: string,
    @Query('limit') limit?: number
  ) {
    try {
      const movies = await this.productionCompanyService.findMoviesByCompany(id, limit);
      return {
        success: true,
        data: movies,
        message: 'Movies by production company retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve movies by production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async createCompany(@Body() createDto: CreateProductionCompanyDto) {
    try {
      const company = await this.productionCompanyService.create(createDto);
      return {
        success: true,
        data: company,
        message: 'Production company created successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('add-movie')
  async addMovieToCompany(@Body() addDto: AddMovieToCompanyDto) {
    try {
      await this.productionCompanyService.addMovieToCompany(addDto);
      return {
        success: true,
        message: 'Movie added to production company successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to add movie to production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id')
  async updateCompany(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionCompanyDto
  ) {
    try {
      const company = await this.productionCompanyService.update(id, updateDto);
      if (!company) {
        throw new HttpException('Production company not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: company,
        message: 'Production company updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deleteCompany(@Param('id') id: string) {
    try {
      const deleted = await this.productionCompanyService.delete(id);
      if (!deleted) {
        throw new HttpException('Production company not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Production company deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':companyId/movies/:movieId')
  async removeMovieFromCompany(
    @Param('companyId') companyId: string,
    @Param('movieId') movieId: string
  ) {
    try {
      await this.productionCompanyService.removeMovieFromCompany(companyId, movieId);
      return {
        success: true,
        message: 'Movie removed from production company successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to remove movie from production company',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
