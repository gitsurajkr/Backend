import { RequestHandler } from "express";
import { removeUserService } from "../services/auth.service";
import { AuthRequest } from "../types/express";

/**
 * Handles user deletion from Supabase authentication.
 */
export const removeUser: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthRequest).user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized: No user found" });
      return;
    }

    const { error } = await removeUserService(userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ message: "User removed successfully" });
  } catch (_error) {
    res.status(500).json({ error: "Failed to remove user" });
  }
};
