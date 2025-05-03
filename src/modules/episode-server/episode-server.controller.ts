import { Controller } from "@nestjs/common";
import { EpisodeServerService } from "./episode-server.service";

@Controller("episode-server")
export class EpisodeServerController {
  constructor(
    private readonly episodeServerService: EpisodeServerService
  ) {
  }
}