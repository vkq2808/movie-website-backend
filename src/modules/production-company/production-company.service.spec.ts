import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductionCompanyService } from './production-company.service';
import { ProductionCompany } from './production-company.entity';
import { Movie } from '../movie/entities/movie.entity';

describe('ProductionCompanyService', () => {
  let service: ProductionCompanyService;
  // Repositories are mocked via getRepositoryToken; avoid unused var warnings

  const mockCompany: Partial<ProductionCompany> = {
    id: '1',
    name: 'Marvel Studios',
    description: 'American film and television production company',
    homepage: 'https://www.marvel.com',
    headquarters: 'Burbank, California',
    origin_country: 'US',
    parent_company: 'The Walt Disney Company',
    original_id: 420,
    is_active: true,
    movies: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCompanyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockMovieRepository = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionCompanyService,
        {
          provide: getRepositoryToken(ProductionCompany),
          useValue: mockCompanyRepository,
        },
        {
          provide: getRepositoryToken(Movie),
          useValue: mockMovieRepository,
        },
      ],
    }).compile();

    service = module.get<ProductionCompanyService>(ProductionCompanyService);
    // Intentionally not assigning repository instances to avoid unused vars
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of production companies', async () => {
      const expected = [mockCompany];
      mockCompanyRepository.find.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(mockCompanyRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
        relations: ['logo'],
      });
    });
  });

  describe('findById', () => {
    it('should return a production company by id', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(mockCompany);

      const result = await service.findById('1');

      expect(result).toEqual(mockCompany);
      expect(mockCompanyRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['logo', 'movies'],
      });
    });

    it('should return null if production company not found', async () => {
      mockCompanyRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new production company', async () => {
      const createDto = {
        name: 'Marvel Studios',
        description: 'American film and television production company',
        homepage: 'https://www.marvel.com',
        headquarters: 'Burbank, California',
        origin_country: 'US',
        original_id: 420,
        // required by DTO
        locale_code: 'en-US',
        iso_639_1: 'en',
      };

      mockCompanyRepository.create.mockReturnValue(mockCompany);
      mockCompanyRepository.save.mockResolvedValue(mockCompany);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCompany);
      expect(mockCompanyRepository.create).toHaveBeenCalledWith({
        ...createDto,
        logo: undefined,
      });
      expect(mockCompanyRepository.save).toHaveBeenCalledWith(mockCompany);
    });
  });

  describe('update', () => {
    it('should update an existing production company', async () => {
      const updateDto = { name: 'Updated Marvel Studios' };
      const updatedCompany = { ...mockCompany, ...updateDto };

      mockCompanyRepository.update.mockResolvedValue({ affected: 1 });
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue(updatedCompany as ProductionCompany);

      const result = await service.update('1', updateDto);

      expect(result).toEqual(updatedCompany);
      expect(mockCompanyRepository.update).toHaveBeenCalledWith('1', {
        ...updateDto,
        logo: undefined,
      });
    });

    it('should return null if production company not found', async () => {
      mockCompanyRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.update('nonexistent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a production company', async () => {
      mockCompanyRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete('1');

      expect(result).toBe(true);
      expect(mockCompanyRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should return false if production company not found', async () => {
      mockCompanyRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
