import { Controller, UseGuards } from "@nestjs/common";
import { WatchHistoryService } from "./watch-history.service";
import { JwtAuthGuard } from "@/common";

@Controller("watch-history")
@UseGuards(JwtAuthGuard)
export class WatchHistoryController {
  constructor(
    private readonly watchHistoryService: WatchHistoryService
  ) { }
}
