import { Response, NextFunction, RequestHandler } from "express";
import { supabase } from "../utils/supabaseClient";
import { AuthRequest } from "../apis/user/types/express";

/**
 * Middleware to protect routes by verifying Supabase authentication.
 */
export const authMiddleware: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: "Authorization header missing" });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Invalid token format" });
      return;
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    (req as AuthRequest).user = data.user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication failed" });
    return;
  }
};
