import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validate = (schema: ZodSchema<unknown>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.safeParse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: (error as Error).message,
      });
    }
  };
};
