import { Controller } from "@nestjs/common";
import { SearchHistoryService } from "./search-history.service";

@Controller("search-history")
export class SearchHistoryController {
  constructor(
    private readonly searchHistoryService: SearchHistoryService
  ) { }
}