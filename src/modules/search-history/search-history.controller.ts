import { Controller, UseGuards } from '@nestjs/common';
import { SearchHistoryService } from './search-history.service';
import { JwtAuthGuard } from '@/modules/auth/strategy';

@Controller('search-history')
@UseGuards(JwtAuthGuard)
export class SearchHistoryController {
  constructor(private readonly searchHistoryService: SearchHistoryService) {}
}
