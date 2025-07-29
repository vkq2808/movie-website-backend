import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello() {
    const message = this.appService.getHello();
    return ResponseUtil.success({ message }, 'Welcome message retrieved successfully.');
  }
}
