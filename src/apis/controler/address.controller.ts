import { Request, RequestHandler, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const addBuyerAddress: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    const { fullName, phoneNumber, address1, pincode, city, state, isDefault } = req.body;

    // Ensure user is a Buyer
    const buyer = await prisma.buyer.findUnique({ where: { BuyerId: userId } });
    if (!buyer) {
      res.status(403).json({ message: "Forbidden: Only buyers can add addresses" });
      return;
    }

    // If this address is set as default, update other addresses to non-default
    if (isDefault) {
      await prisma.address.updateMany({
        where: { buyerId: userId },
        data: { isDefault: false },
      });
    }

    // Save the address
    const newAddress = await prisma.address.create({
      data: { buyerId: userId, fullName, phoneNumber, address1, pincode, city, state, isDefault: isDefault || false },
    });

    res.json({ message: "Address added successfully", newAddress });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error adding address", error });
    return;
  }
};

export const updateBuyerAddress: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    const { addressId } = req.params;
    const { fullName, phoneNumber, address1, pincode, city, state, isDefault } = req.body;

    // Ensure address belongs to the buyer
    const address = await prisma.address.findFirst({ where: { id: addressId, buyerId: userId } });
    if (!address) {
      res.status(404).json({ message: "Address not found or not yours" });
      return;
    }

    // If setting as default, update other addresses to false
    if (isDefault) {
      await prisma.address.updateMany({ where: { buyerId: userId }, data: { isDefault: false } });
    }

    // Update the address
    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: { fullName, phoneNumber, address1, pincode, city, state, isDefault: isDefault || false },
    });

    res.json({ message: "Address updated successfully", updatedAddress });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error updating address", error });
    return;
  }
};

export const deleteBuyerAddress: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;
    const { addressId } = req.params;

    // Ensure the address belongs to the buyer
    const address = await prisma.address.findFirst({ where: { id: addressId, buyerId: userId } });
    if (!address) {
      res.status(404).json({ message: "Address not found or not yours" });
      return;
    }

    // Check if the address being deleted is the default address
    if (address.isDefault) {
      // Find another address to set as default
      const anotherAddress = await prisma.address.findFirst({
        where: { buyerId: userId, id: { not: addressId } },
      });

      if (anotherAddress) {
        // Set the new address as default
        await prisma.address.update({
          where: { id: anotherAddress.id },
          data: { isDefault: true },
        });
      }
    }

    // Delete the address
    await prisma.address.delete({ where: { id: addressId } });

    res.json({ message: "Address deleted successfully" });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error deleting address", error });
    return;
  }
};

export const getBuyerAddresses: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    // Get addresses for the buyer, sorting default address first
    const addresses = await prisma.address.findMany({
      where: { buyerId: userId },
      orderBy: { isDefault: "desc" }, // Default address comes first
    });

    res.json({ addresses });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error fetching addresses", error });
    return;
  }
};

export const getBuyerAddressForSeller: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;
    const { orderId } = req.params;

    // Ensure the user is a seller
    const seller = await prisma.seller.findUnique({ where: { sellerId: userId } });
    if (!seller) {
      res.status(403).json({ message: "Forbidden: Only Sellers can access this" });
      return;
    }

    // Get the order and ensure the seller is fulfilling it
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { include: { address: true } }, // Get buyer and their addresses
      },
    });

    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    if (!order.buyerId) {
      res.status(404).json({ message: "Buyer not found for this order" });
      return;
    }

    if (order.sellerId !== userId) {
      res.status(403).json({ message: "Forbidden: You are not assigned to this order" });
      return;
    }

    // Find the default address or fallback to any address
    const defaultAddress = order.buyer.address.find((a) => a.isDefault);
    const addressToSend = defaultAddress || order.buyer.address[0];

    if (!addressToSend) {
      res.status(404).json({ message: "No address found for this buyer" });
      return;
    }

    res.json({ address: addressToSend });
    return;
  } catch (error) {
    console.error("Get Buyer Address for Seller Error:", error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

export const getDefaultAddress: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as { id: string };
    const userId = user?.id;

    const defaultAddress = await prisma.address.findFirst({
      where: { buyerId: userId, isDefault: true },
    });

    if (!defaultAddress) {
      res.status(404).json({ message: "No default address found" });
      return;
    }

    res.json({ defaultAddress });
    return;
  } catch (error) {
    console.error("Get Default Address Error:", error);
    res.status(500).json({ message: "Error fetching default address", error });
    return;
  }
};
