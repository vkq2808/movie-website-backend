import { Controller, Get, Query } from "@nestjs/common";
import { KeywordService } from "./keyword.service";
import { Keyword } from "./keyword.entity";
import { ApiResponse } from "@/common";


@Controller('keyword')
export class KeywordController {
  constructor(
    private readonly keywordService: KeywordService
  ) { }


  @Get('search')
  async searchKeywords(
    @Query('query') query: string,
    @Query('limit') limit?: number,
  ): Promise<ApiResponse<Keyword[]>> {
    const keywords = await this.keywordService.searchKeywords(query, limit);
    return {
      data: keywords,
      success: true,
      message: "Successfully fetched keywords by query:" + query
    }
  }
}