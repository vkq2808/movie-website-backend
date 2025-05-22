import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EpisodeServer } from "./episode-server.entity";

@Injectable()
export class EpisodeServerService {
  constructor(
    @InjectRepository(EpisodeServer)
    private readonly episodeServerRepository: Repository<EpisodeServer>
  ) { }
}