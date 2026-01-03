import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  // Role management
  async createRole(name: string, description?: string): Promise<Role> {
    const role = this.roleRepo.create({ name, description });
    return this.roleRepo.save(role);
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepo.find({
      relations: ['permissions'],
      order: { name: 'ASC' },
    });
  }

  async findRoleById(id: string): Promise<Role | null> {
    return this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  async findRoleByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({
      where: { name },
      relations: ['permissions'],
    });
  }

  async updateRole(id: string, data: { name?: string; description?: string; is_active?: boolean }): Promise<Role> {
    const role = await this.findRoleById(id);
    if (!role) throw new Error('Role not found');

    if (data.name) role.name = data.name;
    if (data.description !== undefined) role.description = data.description;
    if (data.is_active !== undefined) role.is_active = data.is_active;

    return this.roleRepo.save(role);
  }

  async deleteRole(id: string): Promise<void> {
    await this.roleRepo.delete(id);
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<Role> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new Error('Role not found');

    const permissions = await this.permissionRepo.find({
      where: permissionIds.map((id) => ({ id })),
    });
    role.permissions = permissions;
    return this.roleRepo.save(role);
  }

  async revokePermissionsFromRole(roleId: string, permissionIds: string[]): Promise<Role> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new Error('Role not found');

    role.permissions = role.permissions.filter(
      (p) => !permissionIds.includes(p.id),
    );
    return this.roleRepo.save(role);
  }

  // Permission management
  async createPermission(
    resource: string,
    action: string,
    description?: string,
  ): Promise<Permission> {
    const permission = this.permissionRepo.create({
      resource,
      action,
      description,
    });
    return this.permissionRepo.save(permission);
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({
      relations: ['roles'],
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  async findPermissionById(id: string): Promise<Permission | null> {
    return this.permissionRepo.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  async findPermissionByResourceAndAction(
    resource: string,
    action: string,
  ): Promise<Permission | null> {
    return this.permissionRepo.findOne({
      where: { resource, action },
    });
  }

  async updatePermission(
    id: string,
    data: { description?: string },
  ): Promise<Permission> {
    const permission = await this.findPermissionById(id);
    if (!permission) throw new Error('Permission not found');

    if (data.description !== undefined)
      permission.description = data.description;

    return this.permissionRepo.save(permission);
  }

  async deletePermission(id: string): Promise<void> {
    await this.permissionRepo.delete(id);
  }

  // Check if user has permission (via role)
  async hasPermission(
    roleName: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const role = await this.findRoleByName(roleName);
    if (!role || !role.is_active) return false;

    return role.permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
  }
}

