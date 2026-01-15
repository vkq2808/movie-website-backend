import {
  Controller,
  Get,
  Query,
  UseGuards,
  Put,
  Param,
  Body,
  Delete,
  Patch,
  Post,
  Request,
  HttpCode,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { UserService } from './user.service';
import {
  AdminListUsersQueryDto,
  AdminUpdateUserDto,
  UpdateProfileDto,
  AddFavoriteDto,
  RemoveFavoriteDto,
  SubmitFavoriteGenresDto,
} from './user.dto';
import { ResponseUtil } from '@/common/utils/response.util';
import { TokenPayload } from '@/common/token-payload.type';

type AuthenticatedRequest = Request & { user: TokenPayload };

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/user/me - Get current user profile
   */
  @Get('me')
  @HttpCode(200)
  async getMe(@Request() req: AuthenticatedRequest) {
    const user = await this.userService.getMe(req.user.sub);
    return ResponseUtil.success(user, 'User profile retrieved successfully');
  }

  /**
   * PATCH /api/user/me - Update current user profile
   */
  @Patch('me')
  @HttpCode(200)
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    const user = await this.userService.updateProfile(req.user.sub, body);
    return ResponseUtil.success(user, 'Profile updated successfully');
  }

  /**
   * GET /api/user/me/favorites - Get user's favorite movies
   */
  @Get('me/favorites')
  @HttpCode(200)
  async getFavorites(@Request() req: AuthenticatedRequest) {
    const favorites = await this.userService.getFavorites(req.user.sub);
    return ResponseUtil.success(
      favorites,
      'Favorite movies retrieved successfully',
    );
  }

  /**
   * POST /api/user/me/favorite-genres - Submit user's favorite genres
   */
  @Post('me/favorite-genres')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    }),
  )
  async submitFavoriteGenres(
    @Request() req: AuthenticatedRequest,
    @Body() body: SubmitFavoriteGenresDto,
  ) {
    const result = await this.userService.submitFavoriteGenres(
      req.user.sub,
      body.genreIds,
    );
    return ResponseUtil.success(
      result,
      'Favorite genres submitted successfully',
    );
  }

  // Admin endpoints
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async listUsers(@Query() query: AdminListUsersQueryDto) {
    const data = await this.userService.listUsers(query);
    return ResponseUtil.success(data, 'Users retrieved');
  }

  @Put('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async updateUser(@Param('id') id: string, @Body() body: AdminUpdateUserDto) {
    const user = await this.userService.updateUser(id, body);
    return ResponseUtil.success(user, 'User updated');
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return ResponseUtil.success(null, 'User deleted');
  }

  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async getUserDetails(@Param('id') id: string) {
    // This will be implemented in AdminUserService
    return ResponseUtil.error('Not implemented yet');
  }

  @Post('admin/:id/ban')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async banUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason: string; banned_until?: string },
  ) {
    // This will be implemented in AdminUserService
    return ResponseUtil.error('Not implemented yet');
  }

  @Post('admin/:id/unban')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async unbanUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    // This will be implemented in AdminUserService
    return ResponseUtil.error('Not implemented yet');
  }

  @Post('admin/:id/force-logout')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async forceLogout(@Param('id') id: string) {
    // This will be implemented in AdminUserService
    return ResponseUtil.error('Not implemented yet');
  }

  @Post('admin/:id/reset-password')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async resetPassword(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { new_password: string },
  ) {
    // This will be implemented in AdminUserService
    return ResponseUtil.error('Not implemented yet');
  }

  @Post('admin/:id/impersonate')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  async impersonate(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    // This will be implemented in AdminUserService
    return ResponseUtil.error('Not implemented yet');
  }
}
