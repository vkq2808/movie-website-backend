import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionCompany } from './production-company.entity';
import { ProductionCompanyService } from './production-company.service';
import { ProductionCompanyController } from './production-company.controller';
import { Movie } from '../movie/entities/movie.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionCompany, Movie])],
  controllers: [ProductionCompanyController],
  providers: [ProductionCompanyService],
  exports: [ProductionCompanyService],
})
export class ProductionCompanyModule {}
