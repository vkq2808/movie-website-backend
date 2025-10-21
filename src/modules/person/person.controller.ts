import { Controller, Get, Query } from "@nestjs/common";
import { PersonService } from "./person.service";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";
import { ApiResponse } from "@/common";
import { Person } from "./person.entity";

@Controller('person')
export class PersonController {
  constructor(
    private readonly personService: PersonService
  ) { }

  @Get('search')
  @RateLimit({ limit: 20, ttl: 10 })
  async getPersons(
    @Query('query') query: string
  ): Promise<ApiResponse<Person[]>> {
    const persons = await this.personService.searchPerons(query);

    return {
      data: persons,
      message: "Fetched Persons successfully",
      success: true
    }
  }
}