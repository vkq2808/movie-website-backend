import { TokenPayload } from '@/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthMiddleware {
  constructor(private jwtService: JwtService) { }

  use = (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        console.log("[WsAuth] Missing token, disconnecting");
        socket.disconnect();
        return;
      }

      const decoded = this.jwtService.verify<TokenPayload>(token);
      socket.data.user = decoded;

      console.log("[WsAuth] Auth OK for user:", decoded.sub);

      next();
    } catch (err) {
      console.log("[WsAuth] Invalid token");
      socket.disconnect();
    }
  };

}
