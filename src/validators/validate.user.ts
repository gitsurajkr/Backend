// use zod schema here
import { z } from "zod";

export const signupInput = z
  .object({
    email: z.string().email(),
    phoneNumber: z.string().length(10),
    password: z
      .string()
      .min(6)
      .regex(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/),
    role: z.enum(["buyer", "seller"]),
  })
  .and(
    z.union([
      // Buyer Schema
      z.object({
        role: z.literal("buyer"),
        address: z.string(),
        budget: z.number(),
      }),
      // Seller Schema
      z.object({
        role: z.literal("seller"),
        storeName: z.string(),
        gstNumber: z.string().length(15),
        adharNumber: z.string().length(12),
        panCardNumber: z.string().length(10),
      }),
    ])
  );

export const signinInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const forgotPasswordInput = z.object({
  email: z.string().email(),
});

export type SignupInputType = z.infer<typeof signupInput>;
export type SigninInputType = z.infer<typeof signinInput>;
export type ForgotPasswordInputType = z.infer<typeof forgotPasswordInput>;
