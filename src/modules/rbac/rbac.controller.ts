import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { RolesGuard } from '@/modules/auth/guards';
import { Roles } from '@/modules/auth/decorators';
import { Role } from '@/common/enums/role.enum';
import { RbacService } from './rbac.service';
import { ResponseUtil } from '@/common/utils/response.util';

@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // Roles
  @Get('roles')
  async findAllRoles() {
    const roles = await this.rbacService.findAllRoles();
    return ResponseUtil.success(roles, 'Roles retrieved successfully');
  }

  @Get('roles/:id')
  async findRoleById(@Param('id') id: string) {
    const role = await this.rbacService.findRoleById(id);
    if (!role) {
      return ResponseUtil.error('Role not found');
    }
    return ResponseUtil.success(role, 'Role retrieved successfully');
  }

  @Post('roles')
  async createRole(@Body() body: { name: string; description?: string }) {
    const role = await this.rbacService.createRole(body.name, body.description);
    return ResponseUtil.success(role, 'Role created successfully');
  }

  @Put('roles/:id')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; is_active?: boolean },
  ) {
    const role = await this.rbacService.updateRole(id, body);
    return ResponseUtil.success(role, 'Role updated successfully');
  }

  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    await this.rbacService.deleteRole(id);
    return ResponseUtil.success(null, 'Role deleted successfully');
  }

  @Post('roles/:id/permissions')
  async assignPermissions(
    @Param('id') id: string,
    @Body() body: { permission_ids: string[] },
  ) {
    const role = await this.rbacService.assignPermissionsToRole(
      id,
      body.permission_ids,
    );
    return ResponseUtil.success(role, 'Permissions assigned successfully');
  }

  @Delete('roles/:id/permissions')
  async revokePermissions(
    @Param('id') id: string,
    @Body() body: { permission_ids: string[] },
  ) {
    const role = await this.rbacService.revokePermissionsFromRole(
      id,
      body.permission_ids,
    );
    return ResponseUtil.success(role, 'Permissions revoked successfully');
  }

  // Permissions
  @Get('permissions')
  async findAllPermissions() {
    const permissions = await this.rbacService.findAllPermissions();
    return ResponseUtil.success(
      permissions,
      'Permissions retrieved successfully',
    );
  }

  @Get('permissions/:id')
  async findPermissionById(@Param('id') id: string) {
    const permission = await this.rbacService.findPermissionById(id);
    if (!permission) {
      return ResponseUtil.error('Permission not found');
    }
    return ResponseUtil.success(
      permission,
      'Permission retrieved successfully',
    );
  }

  @Post('permissions')
  async createPermission(
    @Body() body: { resource: string; action: string; description?: string },
  ) {
    const permission = await this.rbacService.createPermission(
      body.resource,
      body.action,
      body.description,
    );
    return ResponseUtil.success(permission, 'Permission created successfully');
  }

  @Put('permissions/:id')
  async updatePermission(
    @Param('id') id: string,
    @Body() body: { description?: string },
  ) {
    const permission = await this.rbacService.updatePermission(id, body);
    return ResponseUtil.success(permission, 'Permission updated successfully');
  }

  @Delete('permissions/:id')
  async deletePermission(@Param('id') id: string) {
    await this.rbacService.deletePermission(id);
    return ResponseUtil.success(null, 'Permission deleted successfully');
  }
}
