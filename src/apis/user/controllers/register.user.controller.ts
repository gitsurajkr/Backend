import { RequestHandler } from "express";
import { signUpService } from "../services/auth.service";

/**
 * Handles user registration with Supabase authentication.
 */
export const registerUser: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const { data, error } = await signUpService(email, password);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: "User registered successfully", user: data });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
};
