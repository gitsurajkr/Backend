import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

interface CartItem {
  productId: string;
  quantity: number;
}

export class CartService {
  static async getUserCart(userId: number) {
    let cart = await prisma.cart.findUnique({ where: { userId } });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId, items: [] as unknown as Prisma.InputJsonValue },
      });
    }

    return cart;
  }

  static async addToCart(userId: number, productId: string, quantity: number) {
    let cart = await prisma.cart.findUnique({ where: { userId } });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId, items: [] as unknown as Prisma.InputJsonValue },
      });
    }

    // Ensure items is correctly typed as CartItem[]
    const updatedItems: CartItem[] = (cart.items as unknown as CartItem[]) || [];

    const existingItem = updatedItems.find((item) => item.productId === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      updatedItems.push({ productId, quantity });
    }

    return await prisma.cart.update({
      where: { userId },
      data: {
        items: updatedItems as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  static async removeFromCart(userId: number, productId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new Error("Cart not found");

    // Ensure items is correctly typed as CartItem[]
    const updatedItems: CartItem[] = ((cart.items as unknown as CartItem[]) || []).filter(
      (item) => item.productId !== productId
    );

    return await prisma.cart.update({
      where: { userId },
      data: { items: updatedItems as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    });
  }

  static async clearCart(userId: number) {
    return await prisma.cart.update({
      where: { userId },
      data: { items: [] as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    });
  }
}
