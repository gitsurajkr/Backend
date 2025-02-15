import { Router, RequestHandler } from "express";
import { registerUser } from "../apis/user/controllers/register.user.controller";
import { loginUser } from "../apis/user/controllers/login.user.controller";
import { getUserProfile } from "../apis/user/controllers/get.user.profile.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Define authentication routes
router.post("/register", registerUser as RequestHandler);
router.post("/login", loginUser as RequestHandler);
router.get("/profile", authMiddleware, getUserProfile as RequestHandler);

export default router;
