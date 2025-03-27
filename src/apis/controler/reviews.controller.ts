import { Request, Response } from "express";
import { reviewSchema } from "../../validators/product.validators";
import verifyTokenAndGetUser from "../../helper/getUser";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { z } from "zod";

const prisma = new PrismaClient();

const uuidSchema = z.string().uuid();

const addReviewsByBuyer = async (req: Request, res: Response) => {
  try {
    const validatedBody = reviewSchema.safeParse(req.body);

    if (!validatedBody.success) {
      return res.status(400).json({
        error: "Invalid product data",
        details: validatedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { productId, rating, review } = validatedBody.data;

    // check buyer id

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const buyer = await prisma.buyer.findUnique({
      where: { BuyerId: user.id },
    });

    if (!buyer) {
      return res.status(404).json({ error: "Buyer not found" });
    }

    // check product id

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // check if buyer has already reviewed the product

    const existingReview = await prisma.review.findFirst({
      where: { productId, buyerId: buyer.id },
    });

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    // add review

    const newReview = await prisma.review.create({
      data: {
        productId,
        buyerId: buyer.id,
        rating,
        review,
        sellerId: product.sellerId,
      },
    });
    console.log("Review added successfully", newReview);

    return res.status(201).json({
      message: "Review added successfully",
      data: newReview,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getReviewsByProductId = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Validate Product ID
    const { productId } = req.params;
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid Product ID format" });
    }

    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: {
        id: true,
        rating: true,
        review: true,
        buyer: {
          select: {
            id: true,
            user: {
              select: {
                name: true, // Include buyer's username
              },
            },
          },
        },
      },
    });

    // Return Reviews
    return res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getReviewsByBuyerId = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Fetch Buyer ID
    const buyerId = user.id;

    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      where: { buyerId },
      select: {
        id: true,
        rating: true,
        review: true,
        productId: true,
        product: {
          select: {
            title: true,
            sellerId: true,
          },
        },
      },
    });

    if (reviews.length === 0) {
      return res.status(200).json({ message: "No reviews found", data: [] });
    }

    // Return Reviews
    return res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteReviewById = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Fetch Review ID
    const { reviewId } = req.params;
    const validReviewId = uuidSchema.safeParse(reviewId);
    if (!validReviewId.success) {
      return res.status(400).json({ error: "Invalid Review ID format" });
    }

    // Fetch Review from Database
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if the review belongs to the user
    if (review.buyerId !== user.id) {
      return res.status(403).json({ error: "Forbidden: You cannot delete this review" });
    }

    // Delete Review
    await prisma.review.delete({
      where: { id: reviewId },
    });

    return res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error deleting review:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateReviewById = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Fetch Review ID
    const { reviewId } = req.params;
    const validReviewId = uuidSchema.safeParse(reviewId);
    if (!validReviewId.success) {
      return res.status(400).json({ error: "Invalid Review ID format" });
    }

    // Fetch Review from Database
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if the review belongs to the user
    if (review.buyerId !== user.id) {
      return res.status(403).json({ error: "Forbidden: You cannot update this review" });
    }

    // Validate Request Body
    const validatedBody = reviewSchema.safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({
        error: "Invalid review data",
        details: validatedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Update Review
    await prisma.review.update({
      where: { id: reviewId },
      data: validatedBody.data,
    });

    return res.status(200).json({ message: "Review updated successfully" });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error updating review:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllReviews = async (req: Request, res: Response) => {
  try {
    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      select: {
        id: true,
        rating: true,
        review: true,
        buyer: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            sellerId: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: reviews.length ? "Reviews fetched successfully" : "No reviews found",
      data: reviews,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllReviewsByProductId = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Validate Product ID
    const { productId } = req.params;
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid Product ID format" });
    }

    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: {
        id: true,
        rating: true,
        review: true,
        buyer: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Return Reviews
    return res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export {
  addReviewsByBuyer,
  getReviewsByProductId,
  getReviewsByBuyerId,
  deleteReviewById,
  updateReviewById,
  getAllReviews,
  getAllReviewsByProductId,
};
