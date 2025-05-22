import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { SearchHistory } from "./search-history.entity";

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectRepository(SearchHistory)
    private readonly searchHistoryRepository: Repository<SearchHistory>
  ) { }
}