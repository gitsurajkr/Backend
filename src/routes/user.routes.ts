import { Router } from "express";
import { userSignin, userSignup } from "../controllers/auth.controller";

const userRoutes = Router();

userRoutes.post("/signup", userSignup);
userRoutes.post("/signin", userSignin);

export default userRoutes;
