import express, { RequestHandler } from "express";
import { OrderController } from "../apis/order/controller/order.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/create", authMiddleware, OrderController.createOrder as RequestHandler);
router.get("/my-orders", authMiddleware, OrderController.getUserOrders as RequestHandler);
router.patch("/:orderId/status", authMiddleware, OrderController.updateOrderStatus as RequestHandler);

export default router;
