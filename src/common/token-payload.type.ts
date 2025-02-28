import { Role } from './role.enum';

export type TokenPayload = {
  userId: string;
  email: string;
  role: Role;
  age: number;
};