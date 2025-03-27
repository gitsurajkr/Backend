import { Request, RequestHandler, Response } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GOOGLE_GMAIL,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
});

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
          buyerId: userId,
          totalPrice: price * quantity,
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

const getCartItems: RequestHandler = async (req: Request, res: Response): Promise<void> => {
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
    console.log("cart Items: ", cart.items);
    res.status(200).json(cart.items);
  } catch (error) {
    console.error((error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};
const validateCart = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    let isValid = true;
    const validatedItems = cart.items.map((item) => {
      const isAvailable = item.product.stock >= item.quantity;
      const isPriceCorrect = item.product.price === item.price;

      if (!isAvailable || !isPriceCorrect) {
        isValid = false;
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        isAvailable,
        isPriceCorrect,
      };
    });

    if (!isValid) {
      res.status(400).json({ message: "Cart contains invalid items", items: validatedItems });
      return;
    }

    res.status(200).json({ message: "Cart is valid", items: validatedItems });
  } catch (error) {
    console.error("Cart validation error:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// const restoreSavedCart = async (req: Request, res: Response): Promise<void> => {
//   const { userId } = req.params;

//   try {
//     const savedCart = await prisma.savedCart.findUnique({
//       where: { id: userId },
//       include: { items: true },
//     });

//     if (!savedCart) {
//       res.status(404).json({ message: "Saved cart not found" });
//       return;
//     }

//     const cart = await prisma.cart.findUnique({
//       where: { id: userId },
//       include: { items: true },
//     });

//     if (cart) {
//       await prisma.cartItems.deleteMany({
//         where: { cartId: userId },
//       });
//     }

//     await prisma.cart.create({
//       data: {
//         userId,
//         items: {
//           create: savedCart.items.map((item) => ({
//             productId: item.productId,
//             quantity: item.quantity,
//             price: item.price,
//           })),
//         },
//       },
//     });

//     res.status(200).json({ message: "Saved cart restored successfully" });
//   } catch (error) {
//     console.error("Restore saved cart error:", (error as Error).message);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };  // no model for saved cart

const deleteFromCart = async (req: Request, res: Response): Promise<void> => {
  const { userId, productId } = req.params;

  try {
    // Find the cart first
    const cart = await prisma.cart.findUnique({
      where: { id: userId },
      include: { items: true },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    // Find the specific item in the cart
    const itemToDelete = cart.items.find((item) => item.productId === productId);

    if (!itemToDelete) {
      res.status(404).json({ message: "Item not found in cart" });
      return;
    }

    // Delete the item from the CartItem table
    await prisma.cartItems.deleteMany({
      where: {
        cartId: userId,
        productId: productId,
      },
    });

    // Recalculate total price after deletion
    const updatedItems = cart.items.filter((item) => item.productId !== productId);
    const totalPrice = updatedItems.reduce((total, item) => total + item.price * item.quantity, 0);

    // Update the cart with the new total price
    await prisma.cart.update({
      where: { id: userId },
      data: { totalPrice },
    });

    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Delete from cart error:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const applyCartDiscount: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Find the user's cart
    const cart = await prisma.cart.findFirst({
      where: { buyerId: userId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart) {
      res.status(404).json({ message: "Cart not found" });
      return;
    }

    // Calculate the total price with discounts
    const totalPrice = cart.items.reduce((sum, item) => {
      const productPrice = item.product.price || 0;
      const discountAmount = item.product.discount ?? 0;

      // Ensure the final price doesn't go below a minimum value
      const finalPrice = Math.max(0.01, productPrice - discountAmount);

      return sum + finalPrice * item.quantity;
    }, 0);

    // Update the cart with the new discounted total price
    await prisma.cart.update({
      where: { id: cart.id },
      data: { totalPrice },
    });

    res.status(200).json({ message: "Discount applied successfully", totalPrice });
  } catch (error) {
    console.error("Apply cart discount error:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    await prisma.$disconnect();
  }
};

const checkoutCart: RequestHandler = async (req: Request, res: Response) => {
  const { userid, email } = req.body;

  try {
    // fetch cart with items

    const cart = await prisma.cart.findUnique({
      where: { id: userid },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      res.status(404).json({ message: "Cart is empty" });
      return;
    }

    // validate the cart or stock

    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        res.status(400).json({ message: "Item out of stock", item });
        return;
      }
    }

    // calculate the total price

    let totalPrice = 0;
    let orderDetails = "";

    cart.items.forEach((item) => {
      const discount = item.product.discount || 0;
      const finalPrice = Math.max(item.product.price - discount, 0);
      totalPrice += finalPrice * item.quantity;

      // add product details for email

      orderDetails += `${item.product.title} - ${item.quantity} x ${finalPrice}\n`;
    });

    const order = await prisma.order.create({
      data: {
        buyer: {
          connect: { id: userid },
        },
        totalAmount: totalPrice,
        status: "Pending",
        seller: {
          connect: { id: cart.items[0]?.product.sellerId }, // Assuming the first item's seller is used
        },
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
      include: { items: true },
    });

    // Reduce stock
    for (const item of cart.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
    // Clear cart
    await prisma.cartItems.deleteMany({ where: { cartId: userid } });

    // Send order confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Order Confirmation",
      text: `Thank you for your order! \n\nYour Order ID: ${order.id}\n\nItems:\n${orderDetails}\nTotal: $${totalPrice}\n\nWe appreciate your business!`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Checkout successful, email sent", orderId: order.id });
  } catch (error) {
    console.error("Checkout error:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createOrder: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { buyerId, totalAmount, status, items } = req.body;

  if (!buyerId || !totalAmount || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: "Invalid order data" });
    return;
  }

  try {
    // Fetch buyer details
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      select: { user: { select: { email: true, name: true } } },
    });

    if (!buyer) {
      res.status(404).json({ message: "Buyer not found" });
      return;
    }

    // Fetch product details along with seller information
    const products = await prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        title: true,
        sellerId: true,
        seller: {
          select: {
            sellerId: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!products.length) {
      res.status(404).json({ message: "No valid products found" });
      return;
    }

    // Group order items by seller
    const ordersBySeller: Record<
      string,
      { items: { productId: string; quantity: number; price: number }[]; totalAmount: number }
    > = {};

    items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return;

      if (!ordersBySeller[product.sellerId]) {
        ordersBySeller[product.sellerId] = { items: [], totalAmount: 0 };
      }
      ordersBySeller[product.sellerId].items.push({
        productId: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.price),
      });
      ordersBySeller[product.sellerId].totalAmount += parseFloat(item.price) * item.quantity;
    });

    // Create orders per seller
    const createdOrders = await Promise.all(
      Object.entries(ordersBySeller).map(async ([sellerId, orderData]) => {
        return prisma.order.create({
          data: {
            buyerId: buyerId,
            sellerId,
            totalAmount: orderData.totalAmount,
            status: status || "Pending",
            items: { create: orderData.items },
          },
          include: { items: true },
        });
      })
    );

    // Send Email to Buyer
    const orderDetails = createdOrders
      .flatMap((order) =>
        order.items.map((item) => `- Product ID: ${item.productId}, Quantity: ${item.quantity}, Price: $${item.price}`)
      )
      .join("\n");

    const userEmailContent = `
      Hello ${buyer.user.name},

      Thank you for your order! Here are your order details:

      Order IDs: ${createdOrders.map((o) => o.id).join(", ")}
      Total Amount: $${createdOrders.reduce((sum, o) => sum + o.totalAmount, 0)}
      Status: ${status || "Pending"}

      Items:
      ${orderDetails}

      We will notify you once your order is shipped.

      Regards,  
      E-Commerce Team
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: buyer.user.email,
      subject: "Order Confirmation - Your Order Has Been Placed",
      text: userEmailContent,
    });

    // Email to Sellers
    for (const order of createdOrders) {
      const seller = products.find((p) => p.sellerId === order.sellerId)?.seller;
      if (!seller || !seller.user.email) continue;

      const sellerOrderDetails = order.items
        .map((item) => `- Product ID: ${item.productId}, Quantity: ${item.quantity}`)
        .join("\n");

      const sellerEmailContent = `
        New Order Received!

        Order ID: ${order.id}
        Customer: ${buyer.user.name} (${buyer.user.email})
        Total Amount: $${order.totalAmount}

        Ordered Products:
        ${sellerOrderDetails}

        Please process the order as soon as possible.
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: seller.user.email,
        subject: "New Order Received",
        text: sellerEmailContent,
      });
    }

    res.status(201).json(createdOrders);
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Internal server error", error: (error as Error).message });
  }
};

// add to cart -> done
// update cart -> done
// update cart item quantity -> done
// clear cart -> done
// remove item from cart -> done
// get cart items count -> done
// get cart -> done
// get cart items -> done
// validate cart -> done
// restore saved cart -> done
// delete from cart -> done
// apply cart discount -> done
// checkout cart -> done
// create order -> done
// get cart total
// create cart
// merge cart
// save cart for later
// get cart summary
// get cart by id
// share cart
// apply coupon to cart
// remove coupon from cart
// estimate shipping for cart

export {
  addToCart,
  updateCart,
  clearCart,
  removeItemFromCart,
  getItemsCount,
  getCart,
  getCartItems,
  validateCart,
  deleteFromCart,
  applyCartDiscount,
  checkoutCart,
  createOrder,
};
