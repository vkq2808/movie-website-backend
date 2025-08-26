import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './enums/role.enum';
import { TokenPayload } from './token-payload.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true; // Nếu không có metadata role nào được chỉ định, cho phép truy cập
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: TokenPayload }>();
    const user = request.user;

    if (!user) return false;
    return requiredRoles.includes(user.role);
  }
}
