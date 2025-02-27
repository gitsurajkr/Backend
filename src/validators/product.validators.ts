import { z } from "zod";

export const ProductSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(0, "Price must be positive"),
  discount: z.number().min(0).max(100).optional(),
  category: z.string().min(2, "Category is required"),
  stock: z.number().min(0, "Stock must be a non-negative number"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  sellerId: z.string().uuid("Invalid seller ID"),
  bulkUploaded: z.string().uuid().optional(),
});

export const ProductDetailsSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  fabricType: z.any().refine((val) => typeof val === "object", "Invalid JSON"),
  origin: z.string().min(3, "Origin must be at least 3 characters"),
  closureType: z.string().min(3, "Closure type must be at least 3 characters"),
  countryOfOrigin: z.string().min(3, "Country of origin must be at least 3 characters"),
});

export const ProductVariantSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  color: z.string().min(2, "Color must be at least 2 characters"),
  size: z.string().min(1, "Size must not be empty"),
  stock: z.number().min(0, "Stock must be a non-negative number"),
});

export const ProductImageSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  url: z.string().url("Invalid URL"),
});

export const WishlistSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  productId: z.string().uuid("Invalid product ID"),
});

export const ReviewSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  productId: z.string().uuid("Invalid product ID"),
  rating: z.number().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().min(5, "Comment must be at least 5 characters"),
});

export type ReviewType = z.infer<typeof ReviewSchema>;

export type WishlistType = z.infer<typeof WishlistSchema>;

export type ProductImageType = z.infer<typeof ProductImageSchema>;

export type ProductVariantType = z.infer<typeof ProductVariantSchema>;

export type ProductDetailsType = z.infer<typeof ProductDetailsSchema>;

export type ProductType = z.infer<typeof ProductSchema>;
