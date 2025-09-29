import { api } from "@/common/utils";
import { ProductionCompany } from "@/modules/production-company/production-company.entity";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TMDBProductionCompanyDetails } from "../dtos/production-company.dto";


@Injectable()
export class ProductionCompanyCrawlerService {
  private readonly logger: Logger = new Logger(ProductionCompanyCrawlerService.name)
  constructor(
    @InjectRepository(ProductionCompany)
    private readonly productionCompanyRepository: Repository<ProductionCompany>
  ) { }

  async importProductionCompaniesByIds(productionCompaniesIds: string[]): Promise<ProductionCompany[]> {
    try {
      let validProductionCompanies: ProductionCompany[] = [];
      for (const id of productionCompaniesIds) {
        const pc = await this.importById(id);
        if (pc) validProductionCompanies.push(pc);
      }
      return validProductionCompanies;
    } catch (e) {
      this.logger.log("Error while importing ProductionCompanies by Ids:", e)
      return [];
    }
  }

  async importById(productionCompanyId: string): Promise<ProductionCompany | undefined> {
    try {
      const existingCompany = await this.productionCompanyRepository.findOneBy({ original_id: productionCompanyId })
      if (existingCompany) {
        return existingCompany;
      }

      const { data } = await api.get<TMDBProductionCompanyDetails>(`/company/${productionCompanyId}`);

      const pc = this.productionCompanyRepository.create({
        name: data.name,
        description: data.description ?? undefined,
        homepage: data.homepage ?? undefined,
        headquarters: data.headquarters ?? undefined,
        origin_country: data.origin_country ?? undefined,
        original_id: productionCompanyId,
      });

      // Save the created production company so that callers can reuse it
      await this.productionCompanyRepository.save(pc);
      return pc;
    } catch (err) {
      this.logger.log(`Failed to import production company ${JSON.stringify(productionCompanyId)}:`, err as any)
      return undefined
    }
  }
}
