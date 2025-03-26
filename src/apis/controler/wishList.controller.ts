import { Request, Response, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Add to Wishlist
const addToWishList: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;
    const { productId } = req.body;

    if (!userId || !productId) {
      res.status(400).json({ message: "Product ID is required." });
      return;
    }

    // Check if product exists
    const productExists = await prisma.product.findUnique({ where: { id: productId } });
    if (!productExists) {
      res.status(404).json({ message: "Product not found." });
      return;
    }

    // Check if item is already in wishlist
    const existingItem = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existingItem) {
      res.status(400).json({ message: "Item already in wishlist." });
      return;
    }

    // Add product to wishlist
    const newWishListItem = await prisma.wishlist.create({
      data: { userId, productId },
    });

    res.status(201).json(newWishListItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Remove from Wishlist
const removeFromWishList: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;
    const { productId } = req.body;

    if (!userId || !productId) {
      res.status(400).json({ message: "Product ID is required." });
      return;
    }

    const existingItem = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!existingItem) {
      res.status(404).json({ message: "Item not found in wishlist." });
      return;
    }

    await prisma.wishlist.delete({
      where: { userId_productId: { userId, productId } },
    });

    res.status(200).json({ message: "Item removed from wishlist." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get Wishlist
const getWishList: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized access." });
      return;
    }

    const wishListItems = await prisma.wishlist.findMany({
      where: { userId },
      include: { product: true }, // Include product details
    });

    res.status(200).json(wishListItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Move Wishlist Item to Cart
const moveWishListToCart: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;
    const { productId } = req.body;

    if (!userId || !productId) {
      res.status(400).json({ message: "Product ID is required." });
      return;
    }

    // Check if the item exists in the wishlist
    const existingItem = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!existingItem) {
      res.status(404).json({ message: "Item not found in wishlist." });
      return;
    }

    // Remove from wishlist
    await prisma.wishlist.delete({
      where: { userId_productId: { userId, productId } },
    });

    // Add to cart
    const cartItem = await prisma.cartItems.create({
      data: { cartId: userId, productId, quantity: 1, price: 0 },
    });

    res.status(200).json(cartItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Clear Wishlist
const clearWishList: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized access." });
      return;
    }

    await prisma.wishlist.deleteMany({ where: { userId } });

    res.status(200).json({ message: "Wishlist cleared." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Wishlist Count
const getWishListCount: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized access." });
      return;
    }

    const count = await prisma.wishlist.count({ where: { userId } });

    res.status(200).json({ count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export { addToWishList, removeFromWishList, getWishList, moveWishListToCart, clearWishList, getWishListCount };

// add to wishlist -> done
// remove from wishlist -> done
// get wishlist -> done
// move to cart -> done
// clear wishlist
// get wishlist count
