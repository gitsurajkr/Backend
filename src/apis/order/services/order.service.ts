import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface OrderItem {
  productId: string;
  quantity: number;
}

export class OrderService {
  static async createOrder(userId: number) {
    // Fetch user's cart
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart || !cart.items || (cart.items as unknown as OrderItem[]).length === 0) {
      throw new Error("Cart is empty");
    }

    // const items = cart.items as OrderItem[];
    const items = cart.items as unknown as OrderItem[];

    // Assume totalAmount is calculated dynamically
    const totalAmount = items.reduce((acc, item) => acc + item.quantity * 100, 0); // Replace 100 with actual product price logic

    // Create an order
    const order = await prisma.order.create({
      data: {
        userId,
        items,
        totalAmount,
        status: "pending",
      },
    });

    // Clear the cart after order is placed
    await prisma.cart.update({
      where: { userId },
      data: { items: [] },
    });

    return order;
  }

  static async getUserOrders(userId: number) {
    return await prisma.order.findMany({ where: { userId } });
  }

  static async updateOrderStatus(orderId: string, status: string) {
    return await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }
}
