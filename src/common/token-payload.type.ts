import { Role } from './enums/role.enum';

export type TokenPayload = {
  sub: string;
  username: string;
  email: string;
  role: Role;
  isVerified: boolean;
};