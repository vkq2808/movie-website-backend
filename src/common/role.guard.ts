import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true; // Nếu không có metadata role nào được chỉ định, cho phép truy cập
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Giả sử JwtStrategy đã gán dữ liệu người dùng vào req.user

    return user && requiredRoles.includes(user.role);
  }
}
