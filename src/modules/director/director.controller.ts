import { Controller } from "@nestjs/common";
import { DirectorService } from "./director.service";

@Controller("director")
export class DirectorController {
  constructor(
    private readonly directorService: DirectorService
  ) { }
}
