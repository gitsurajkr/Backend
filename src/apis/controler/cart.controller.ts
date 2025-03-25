import { Request, RequestHandler, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const addToCart: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { title, quantity, price, userId } = req.body;

  try {
    let cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId,
          items: {
            create: [
              {
                productId: title,
                quantity,
                price,
              },
            ],
          },
        },
        include: { items: true },
      });
    } else {
      const existingItems = cart.items.filter((item) => item.productId === title);
      if (existingItems.length) {
        await prisma.cartItems.update({
          where: { id: existingItems[0].id },
          data: { quantity: existingItems[0].quantity + quantity },
        });
      } else {
        await prisma.cartItems.create({
          data: {
            productId: title,
            quantity,
            price,
            cartId: cart.id,
          },
        });
      }
    }

    const updatedCart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    const totalPrice = updatedCart?.items.reduce((total, item) => total + item.price * item.quantity, 0);

    await prisma.cart.update({
      where: { id: userId },
      data: { totalPrice },
    });

    res.status(200).json(updatedCart);
  } catch (error) {
    console.error((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateCart: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { userId, items } = req.body;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    const totalPrice = items.reduce(
      (total: number, item: { quantity: number; price: number }) => total + item.price * item.quantity,
      0
    );

    const updatedCart = await prisma.cart.update({
      where: { id: userId },
      data: {
        items: {
          upsert: items.map((item: { productId: string; quantity: number; price: number }) => ({
            where: { productId_cartId: { productId: item.productId, cartId: userId } },
            update: { quantity: item.quantity, price: item.price },
            create: { productId: item.productId, quantity: item.quantity, price: item.price, cartId: userId },
          })),
        },
        totalPrice,
      },
      include: { items: true },
    });

    res.status(200).json(updatedCart);
  } catch (error) {
    console.error((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const clearCart: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }
    await prisma.cartItems.deleteMany({
      where: { cartId: userId },
    });

    await prisma.cart.update({
      where: { id: userId },
      data: { totalPrice: 0 },
    });

    res.status(200).json({ message: "Cart cleared successfully" });
  } catch (error) {
    console.log((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const removeItemFromCart: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { userId, productId } = req.params;

  try {
    const cartItem = await prisma.cartItems.findFirst({
      where: { cartId: userId, productId },
    });

    if (!cartItem) {
      res.status(404).json({ message: "Item not found in the car" });
      return;
    }

    // delete the item from the cart

    await prisma.cartItems.delete({
      where: { id: cartItem.id },
    });

    const updatedCart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    const totalPrice = updatedCart?.items.reduce((total, item) => total + item.price * item.quantity, 0);

    await prisma.cart.update({
      where: { id: userId },
      data: { totalPrice },
    });

    res.status(200).json({ message: "Item removed Successfully", updatedCart });
  } catch (error) {
    console.log((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getItemsCount: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    const itemsCount = cart.items.reduce((total, item) => total + item.quantity, 0);

    res.status(200).json({ itemsCount });
  } catch (error) {
    console.log((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getCart: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    res.status(200).json(cart);
  } catch (error) {
    console.log((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// add to cart -> done
// update cart -> done
// update cart item quantity -> done
// clear cart -> done
// remove item from cart -> done
// get cart items count -> done
// get cart -> done
// get cart items
// validate cart
// restore saved cart
// delete from cart
// apply cart discount
// get cart total
// create cart
// merge cart
// save cart for later
// get cart summary
// checkout cart
// get cart by id
// share cart
// apply coupon to cart
// remove coupon from cart
// estimate shipping for cart

export { addToCart, updateCart, clearCart, removeItemFromCart };
