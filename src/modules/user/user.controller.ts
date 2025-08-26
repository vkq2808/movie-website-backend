import {
  Controller,
  Get,
  Query,
  UseGuards,
  Put,
  Param,
  Body,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/common/role.guard';
import { Roles } from '@/common/role.decorator';
import { Role } from '@/common/enums/role.enum';
import { UserService } from './user.service';
import { AdminListUsersQueryDto, AdminUpdateUserDto } from './user.dto';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('admin')
  async listUsers(@Query() query: AdminListUsersQueryDto) {
    const data = await this.userService.listUsers(query);
    return ResponseUtil.success(data, 'Users retrieved');
  }

  @Put('admin/:id')
  async updateUser(@Param('id') id: string, @Body() body: AdminUpdateUserDto) {
    const user = await this.userService.updateUser(id, body);
    return ResponseUtil.success(user, 'User updated');
  }

  @Delete('admin/:id')
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return ResponseUtil.success(null, 'User deleted');
  }
}
