import { Role } from './enums/role.enum';

export type TokenPayload = {
  userId: string;
  username: string;
  email: string;
  role: Role;
  age: number;
};