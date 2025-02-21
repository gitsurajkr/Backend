import { Request, Response } from "express";
import { OrderService } from "../services/order.service";
import { AuthenticatedRequest } from "../../../types/auth";

export class OrderController {
  static async createOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.user.id); // Assuming user ID is stored in JWT token
      const order = await OrderService.createOrder(userId);
      res.status(201).json({ message: "Order placed successfully", order });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: "An unknown error occurred" });
      }
    }
  }

  static async getUserOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.user.id);
      const orders = await OrderService.getUserOrders(userId);
      res.json(orders);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: "An unknown error occurred" });
      }
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      const updatedOrder = await OrderService.updateOrderStatus(orderId, status);
      res.json({ message: "Order status updated", updatedOrder });
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: "An unknown error occurred" });
      }
    }
  }
}
