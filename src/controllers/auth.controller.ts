// write all function here
import { Request, RequestHandler, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { signinInput, signupInput } from "../validators/validate.user";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

const userSignup: RequestHandler = async (req: Request, res: Response) => {
  const validateBody = signupInput.safeParse(req.body);

  if (!validateBody.success) {
    res.status(400).json({
      message: validateBody.error.errors[0].message,
      errors: validateBody.error.errors,
    });
    return;
  }

  try {
    const { email, password, phoneNumber, role } = validateBody.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        phoneNumber,
      },
    });

    if (role === "buyer") {
      const { address, budget } = validateBody.data;
      await prisma.buyer.create({
        data: {
          user: { connect: { id: user.id } },
          address,
          budget,
        },
      });
    } else if (role === "seller") {
      const { storeName, gstNumber, adharNumber, panCardNumber } = validateBody.data;
      await prisma.seller.create({
        data: {
          user: { connect: { id: user.id } },
          storeName,
          gstNumber,
          adharNumber,
          panCardNumber,
        },
      });
    }

    console.log("User created successfully", user);

    const token = jwt.sign({ userId: user.id, role }, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    res.status(201).json({ message: "User created successfully", token });
  } catch (error) {
    console.error("Error creating user", error);
    res.status(400).json({ message: "Sign-up error", error: (error as Error).message });
  }
};

const userSignin: RequestHandler = async (req: Request, res: Response) => {
  const validateBody = signinInput.safeParse(req.body);

  if (!validateBody.success) {
    const errorMessage = validateBody.error.errors[0].message;

    res.status(400).json({
      message: errorMessage,
      errors: validateBody.error.errors,
    });

    return;
  }

  try {
    const { email, password } = validateBody.data;
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        Buyer: true,
        Seller: true,
      },
    });

    if (!user) {
      res.status(400).json({ message: "User not found" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(400).json({ message: "Invalid password" });
      return;
    }

    const role = user.Buyer ? "buyer" : user.Seller ? "seller" : "unknown";

    const userData = {
      userId: user.id,
      role,
    };

    const token = jwt.sign(userData, process.env.JWT_SECRET as string, {
      expiresIn: "1d",
    });

    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      token,
      role,
    });
  } catch (error) {
    console.error("Sign-in error", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during sign-in. Please try again later.",
    });
  }
};

export { userSignup, userSignin };
