// import { Request, Response } from "express";
// import { loginService } from "../services/auth.service";

// /**
//  * Handles user login using Supabase authentication.
//  */
// export const loginUser = async (req: Request, res: Response) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

//     const { data, error } = await loginService(email, password);

//     if (error) return res.status(400).json({ error: error.message });

//     res.status(200).json({ message: "Login successful", user: data });
//   } catch (error) {
//     res.status(500).json({ error: "Server error" });
//   }
// };

import { Response, NextFunction } from "express";
import { signInService } from "../services/auth.service";
import { ExpressHandler, AuthRequest } from "../types/express";

/**
 * Handles user login with Supabase authentication.
 */
export const loginUser: ExpressHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const { data, error } = await signInService(email, password);

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(200).json({ message: "Login successful", user: data.user, session: data.session });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
};
