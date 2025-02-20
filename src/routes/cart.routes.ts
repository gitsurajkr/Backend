import express, { Request, Response } from "express";
import { CartController } from "../apis/user/controllers/cart.controller.ts";
import { authMiddleware } from "../middleware/auth.middleware.ts";
import { AuthenticatedRequest } from "../types/auth.ts";

const router = express.Router();

router.get("/", authMiddleware, (req: Request, res: Response) =>
  CartController.getCart(req as AuthenticatedRequest, res)
);
router.post("/add", authMiddleware, (req: Request, res: Response) =>
  CartController.addToCart(req as AuthenticatedRequest, res)
);
router.post("/remove", authMiddleware, (req: Request, res: Response) =>
  CartController.removeFromCart(req as AuthenticatedRequest, res)
);

export default router;
