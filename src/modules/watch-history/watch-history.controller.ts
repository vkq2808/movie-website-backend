import { Controller } from "@nestjs/common";
import { WatchHistoryService } from "./watch-history.service";

@Controller("watch-history")
export class WatchHistoryController {
  constructor(
    private readonly watchHistoryService: WatchHistoryService
  ) { }
}
