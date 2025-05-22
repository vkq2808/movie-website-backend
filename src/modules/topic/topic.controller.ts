import { Controller } from "@nestjs/common";
import { TopicService } from "./topic.service";


@Controller("topic")
export class TopicController {
  constructor(
    private readonly topicService: TopicService,
  ) {
    // Constructor logic if needed
  }

  // Define your endpoints here
  // For example:
  // @Get()
  // getAllTopics() {
  //   return this.topicService.findAll();
  // }
}