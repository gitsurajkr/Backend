import { Request, Response } from "express";
import { CartService } from "../services/cart.service";

// Add this interface
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

export class CartController {
  static async getCart(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.user.id); // Ensure correct type
      const cart = await CartService.getUserCart(userId);
      res.status(200).json(cart);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unknown error occurred" });
      }
    }
  }
  static async addToCart(req: AuthenticatedRequest, res: Response) {
    try {
      const { productId, quantity } = req.body;
      const userId = parseInt(req.user.id);
      const updatedCart = await CartService.addToCart(userId, productId, quantity);
      res.status(200).json(updatedCart);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unknown error occurred" });
      }
    }
  }

  static async removeFromCart(req: AuthenticatedRequest, res: Response) {
    try {
      const { productId } = req.body;
      const userId = parseInt(req.user.id);
      const response = await CartService.removeFromCart(userId, productId);
      res.status(200).json(response);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unknown error occurred" });
      }
    }
  }
  static async clearCart(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = parseInt(req.user.id);
      const response = await CartService.clearCart(userId);
      res.status(200).json(response);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unknown error occurred" });
      }
    }
  }
}
