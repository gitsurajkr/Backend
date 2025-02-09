import config from "../config/JWT.key";
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

// Extend the Request interface to include the user property
declare module "express-serve-static-core" {
  interface Request {
    user?: DecodedToken;
  }
}

// Define custom interface for the decoded token
interface DecodedToken extends JwtPayload {
  role: string;
}

// Authentication Middleware
export const authenticateUser = (req: Request, res: Response, next: NextFunction): void => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized User: Missing or Invalid Token" });
    return;
  }

  try {
    const token = authorizationHeader.split(" ")[1];

    if (!config.JWT_SECRET) {
      console.error("JWT_SECRET is missing in config.");
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as DecodedToken;

    if (!decoded) {
      res.status(401).json({ message: "Unauthorized User: Invalid Token" });
      return;
    }

    req.user = decoded;
    console.log("Authenticated User:", req.user);
    next(); // Ensure next() is called and nothing is returned
  } catch (error) {
    console.error("JWT Verification Error:", error);
    res.status(401).json({ message: "Unauthorized User: Invalid or Expired Token" });
  }
};

// Role-based Authorization Middleware
export const authorizeRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized User: No User Data" });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ message: "Forbidden: Insufficient Permissions" });
      return;
    }

    next();
  };
};
