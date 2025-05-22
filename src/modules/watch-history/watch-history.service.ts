import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { WatchHistory } from "./watch-history.entity";

@Injectable()
export class WatchHistoryService {
  constructor(
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepository: Repository<WatchHistory>
  ) { }
}