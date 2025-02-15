import { Request, Response, NextFunction, RequestHandler } from "express";
import { IUser } from "../interfaces";

export interface AuthRequest extends Request {
  user: IUser;
}

export type ExpressHandler = RequestHandler<any, any, any, any, Record<string, any>>;
