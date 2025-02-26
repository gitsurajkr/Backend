import { z } from "zod";

export const signUpInput = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
  phoneNumber: z.string().optional(),

  // Optional fields
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),

  // Relations (only one can be present at a time)
  Buyer: z
    .object({
      address: z.string().min(5),
    })
    .optional(),

  Seller: z
    .object({
      storeName: z.string().min(2),
      aadharCard: z.string().min(12).max(12),
      panCard: z.string().min(10).max(10),
      gstNumber: z.string().optional(),
      rating: z.number().optional(),
    })
    .optional(),
});

export const signinInput = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const updateInput = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")
    .optional(),
  phoneNumber: z.string().optional(),

  // Optional fields
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),

  // Relations (only one can be updated at a time)
  Buyer: z
    .object({
      address: z.string().min(5).optional(),
    })
    .optional(),

  Seller: z
    .object({
      storeName: z.string().min(2).optional(),
      aadharCard: z.string().min(12).max(12).optional(),
      panCard: z.string().min(10).max(10).optional(),
      gstNumber: z.string().optional(),
      rating: z.number().optional(),
    })
    .optional(),
});

export const emailSchema = z.object({
  email: z.string().email(),
});

export const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters long"),
});

export const buyerUpdateSchema = z.object({
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6, "Password must be at least 6 characters long").optional(),
  address: z.string().optional(),
});

export const sellerUpdateSchema = z.object({
  storeName: z.string().optional(),
  aadharCard: z.string().optional(),
  panCard: z.string().optional(),
  gstNumber: z.string().optional(),
});

export type SignUpInput = z.infer<typeof signUpInput>;
export type SigninInput = z.infer<typeof signinInput>;
export type UpdateInput = z.infer<typeof updateInput>;
export type EmailInput = z.infer<typeof emailSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type BuyerUpdateSchema = z.infer<typeof buyerUpdateSchema>;
export type SellerUpdateSchema = z.infer<typeof sellerUpdateSchema>;
