import { Role } from './enums/role.enum';

export type TokenPayload = {
  sub: string;
  username: string;
  email: string;
  role: Role;
  age: number;
  isVerified: boolean;
};