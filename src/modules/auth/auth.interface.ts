import { TokenPayload } from "@/common";
import { Request } from "express";

export interface RequestWithUser extends Request {
  user: TokenPayload;
}

export interface RequestWithOptionalUser extends Request {
  user?: TokenPayload;
}