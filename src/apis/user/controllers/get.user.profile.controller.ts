import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/express";

/**
 * Handles fetching the authenticated user's profile.
 */
export const getUserProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // The `authMiddleware` ensures `req.user` is populated with the authenticated user's data
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    // Returning the user's profile (email, id, etc.)
    res.status(200).json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};
