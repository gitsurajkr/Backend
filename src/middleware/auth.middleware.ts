// import config from "../config/JWT.key";
// import { Request, Response, NextFunction } from "express";
// import jwt, { JwtPayload } from "jsonwebtoken";

// // Extend the Request interface to include the user property
// declare module "express-serve-static-core" {
//   interface Request {
//     user?: DecodedToken;
//   }
// }

// // Define custom interface for the decoded token
// interface DecodedToken extends JwtPayload {
//   role: string;
// }

// // Authentication Middleware
// export const authenticateUser = (req: Request, res: Response, next: NextFunction): void => {
//   const authorizationHeader = req.headers.authorization;

//   if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
//     res.status(401).json({ message: "Unauthorized User: Missing or Invalid Token" });
//     return;
//   }

//   try {
//     const token = authorizationHeader.split(" ")[1];

//     if (!config.JWT_SECRET) {
//       console.error("JWT_SECRET is missing in config.");
//       res.status(500).json({ message: "Internal Server Error" });
//       return;
//     }

//     const decoded = jwt.verify(token, config.JWT_SECRET) as DecodedToken;

//     if (!decoded) {
//       res.status(401).json({ message: "Unauthorized User: Invalid Token" });
//       return;
//     }

//     req.user = decoded;
//     console.log("Authenticated User:", req.user);
//     next(); // Ensure next() is called and nothing is returned
//   } catch (error) {
//     console.error("JWT Verification Error:", error);
//     res.status(401).json({ message: "Unauthorized User: Invalid or Expired Token" });
//   }
// };

// // Role-based Authorization Middleware
// export const authorizeRole = (role: string) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     if (!req.user) {
//       res.status(401).json({ message: "Unauthorized User: No User Data" });
//       return;
//     }

//     if (req.user.role !== role) {
//       res.status(403).json({ message: "Forbidden: Insufficient Permissions" });
//       return;
//     }

//     next();
//   };
// // };import { Request, Response, NextFunction } from "express";
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
