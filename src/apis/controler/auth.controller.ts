import { RequestHandler, Request, Response } from "express";
import { signinInput, signUpInput, updateInput } from "../../validators/validate.user";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import verifyTokenAndGetUser from "../../helper/getUser";
import nodemailer from "nodemailer";
import crypto from "crypto";

const JWT_KEY = process.env.JWT_SECRET as string;
const REFRESH_TOKEN_KEY = process.env.REFRESH_TOKEN_SECRET as string;

const prisma = new PrismaClient();

// generate access Token which will be store in memory

const generateAccessToken = (user: { id: string; email: string }) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_KEY, { expiresIn: "1h" });
};

// generateRefresh token which will bw stored in db

const generateRefreshToken = (user: { id: string; email: string }) => {
  return jwt.sign({ id: user.id, email: user.email }, REFRESH_TOKEN_KEY, { expiresIn: "7d" });
};

const createAdmin: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminName = process.env.ADMIN_NAME;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminName || !adminEmail || !adminPassword) {
      console.error(" Missing admin credentials in environment variables");
      res.status(500).json({ message: "Admin credentials are missing in environment variables" });
      return;
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (existingAdmin) {
      res.status(400).json({ message: "Admin already exists" });
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    // Generate JWT Token
    const accessToken = jwt.sign({ id: admin.id, email: admin.email, role: "ADMIN" }, JWT_KEY, { expiresIn: "1h" });

    console.log("Admin created successfully:", admin);
    res.status(201).json({ message: "Admin created successfully", admin, accessToken });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const adminSignIn: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const jwtSecret = process.env.JWT_SECRET;

    if (!adminEmail || !adminPassword || !jwtSecret) {
      console.error("❌ Missing admin credentials or JWT_SECRET in environment variables");
      res.status(500).json({ message: "Server misconfiguration" });
      return;
    }

    // Check if credentials match environment variables
    if (email !== adminEmail) {
      console.warn("⚠️ Attempted login with incorrect admin email:", email);
      res.status(401).json({ message: "Invalid admin credentials" });
      return;
    }

    // Find admin in the database
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!adminUser || adminUser.role !== "ADMIN") {
      console.warn("⚠️ Admin not found in the database");
      res.status(401).json({ message: "Unauthorized: Admin not found" });
      return;
    }

    // Compare hashed password
    const isPasswordValid = await bcrypt.compare(password, adminUser.password);

    if (!isPasswordValid) {
      console.warn("⚠️ Incorrect admin password");
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // Generate JWT Token
    const accessToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, jwtSecret, {
      expiresIn: "1h",
    });

    console.log("✅ Admin login successful");
    res.status(200).json({ message: "Admin login successful", accessToken });
  } catch (error) {
    console.error("❌ Error during admin sign-in:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const registerUser: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const validateBody = signUpInput.safeParse(req.body);
  if (!validateBody.success) {
    res.status(400).json({
      message: validateBody.error.message,
      errors: validateBody.error.errors,
    });
    return;
  }

  try {
    const { email, password, name } = validateBody.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const role: Role = "USER";

    // bcrypt passowrd for admin : havent done yet

    const user = await prisma.user.create({ data: { email, password: hashedPassword, name, role } });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in the database
    // add ip to increase more security
    // const ip = req.ip
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken } });

    // Set refresh token as an HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    // setup nodemailer to show user register successfully

    res.status(201).json({ message: "User registered successfully", accessToken });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const signinUser: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const validateBody = signinInput.safeParse(req.body);
  if (!validateBody.success) {
    res.status(400).json({
      message: validateBody.error.message,
      errors: validateBody.error.errors,
    });
    return;
  }

  try {
    const { email, password } = validateBody.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token in the database
    await prisma.refreshToken.upsert({
      where: { id: user.id },
      update: { token: refreshToken },
      create: { userId: user.id, token: refreshToken },
    });

    // Set refresh token as an HTTP-only cookie
    res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: true, sameSite: "strict" });

    res.status(200).json({ message: "User signed in successfully", accessToken });
  } catch (error) {
    console.error("Error signing in user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const refreshToken: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized: No refresh token provided" });
    return;
  }
  try {
    // Verify refresh token
    const decodedToken = jwt.verify(refreshToken, REFRESH_TOKEN_KEY) as JwtPayload;
    if (!decodedToken) {
      res.status(401).json({ message: "Invalid or expired refresh token" });
      return;
    }

    // Check if the refresh token exists in the database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { userId: decodedToken.id, token: refreshToken },
    });

    if (!storedToken) {
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }

    const newAccessToken = generateAccessToken({ id: decodedToken.id, email: decodedToken.email });

    res.status(200).json({ message: "Token refreshed successfully", token: newAccessToken });
  } catch (error) {
    console.error("Error refreshing token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const logoutUser: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    res.status(400).json({ message: "Refresh token required" });
    return;
  }

  try {
    // Delete refresh token from the database
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });

    // Clear refresh token cookie
    res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "strict" });

    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // get token from header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Unauthorized : No token provided" });
      return;
    }

    const decodedToken = jwt.verify(token, JWT_KEY as string) as JwtPayload;
    const userId = decodedToken.id;

    const validateBody = updateInput.safeParse(req.body);
    if (!validateBody.success) {
      res.status(400).json({
        message: validateBody.error.errors[0].message,
        errors: validateBody.error.errors,
      });
      return;
    }

    const { email, password, name } = validateBody.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({
        message: "Email already in use",
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = password ? await bcrypt.hash(password, salt) : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });
    prisma.refreshToken.deleteMany({ where: { userId } });

    console.log("User updated Successfully.Please log in again", updatedUser);
    res.status(200).json({
      message: "User Updated successfuly.  Please log in again",
    });
    return;
  } catch (error) {
    console.error("Error updating user", (error as Error).message);
    res.status(500).json({
      message: "Internal Server Error",
    });
    return;
  }
};

const getUser: RequestHandler = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.status(200).json(users);
  } catch (error) {
    console.error("Error getting users:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteUser: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(400).json({ message: "User not found" });
      return;
    }

    // Start a transaction to delete refresh tokens first, then delete the user
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      prisma.seller.deleteMany({ where: { sellerId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    res.status(200).json({ message: "User deleted successfully" });
    return;
  } catch (error) {
    console.error("Error deleting user:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

const assignBuyer: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract token and verify
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    const user = await verifyTokenAndGetUser(token);

    // Ensure user has a valid refresh token (active session)
    const activeSession = await prisma.refreshToken.findFirst({
      where: { userId: user.id },
    });

    if (!activeSession) {
      res.status(401).json({ message: "Unauthorized: Invalid session" });
      return;
    }

    // Prevent sellers from being assigned as buyers
    if (user.role === "SELLER") {
      res.status(403).json({ message: "Sellers cannot register as buyers" });
      return;
    }

    const { address } = req.body;

    if (!address) {
      res.status(400).json({ message: "Address is required" });
      return;
    }

    // Check if user is already a buyer
    if (user.role === "BUYER") {
      res.status(409).json({ message: "User is already assigned as a Buyer" });
      return;
    }

    // Assign buyer role
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "BUYER",
        isVerified: true,
      },
    });

    await prisma.buyer.create({
      data: {
        BuyerId: user.id,
        address,
      },
    });

    res.status(201).json({ message: "User assigned as buyer" });
  } catch (error) {
    console.error("Error assigning buyer:", (error as Error).message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const assignSeller: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Unauthorized: Token required" });
      return;
    }

    const user = await verifyTokenAndGetUser(token);

    if (user.role === "BUYER") {
      res.status(403).json({ message: "Buyers cannot register as sellers" });
      return;
    }

    const { storeName, aadharCard, panCard, gstNumber } = req.body;

    if (!storeName || !aadharCard || !panCard) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { role: "SELLER" },
      }),
      prisma.seller.create({
        data: { sellerId: user.id, storeName, aadharCard, panCard, gstNumber },
      }),
    ]);
    res.status(201).json({
      message: "Seller registration in progress, awaiting verification",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "User is already a seller") {
      res.status(409).json({ message: error.message });
    } else {
      console.error("Error assigning seller:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
};

const verifySeller: RequestHandler = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    const admin = await verifyTokenAndGetUser(token);

    if (admin.role !== "ADMIN") {
      res.status(403).json({ message: "Forbidden: Only admins can verify sellers" });
      return;
    }

    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const seller = await prisma.seller.findUnique({ where: { sellerId: user.id } });

    if (!seller) {
      res.status(404).json({ message: "Seller not found" });
      return;
    }

    if (seller.isVerified) {
      res.status(400).json({ message: "Seller is already verified" });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
    await prisma.seller.update({
      where: { sellerId: seller.id },
      data: { isVerified: true },
    });

    const updatedSeller = await prisma.seller.findUnique({ where: { sellerId: user.id } });
    console.log("After update:", updatedSeller);

    res.status(200).json({ message: "Seller verified successfully" });
  } catch (error) {
    console.error("Error verifying seller:", (error as Error).message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const passwordRequest: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const expiresAt = new Date(Date.now() + 3600000);

    // Delete existing token if it exists
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Store new token in database
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt,
      },
    });

    const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

    // Send email with reset link
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_GMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.GOOGLE_GMAIL,
      to: user.email,
      subject: "Password Reset Request",
      html: `<p>Click <a href="${resetLink}" style="color: blue; text-decoration: underline;">here</a> to reset your password.</p>
      <p>Or copy and paste this link in your browser:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
};

const updatePassword: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters long" });
    return;
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      res.status(400).json({ message: "Invalid or expired token" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.delete({
      where: { token: hashedToken },
    });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserProfile: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  try {
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      console.log("User not found for the provided token.");
      res.status(404).json({ message: "User not found" });
      return;
    }

    console.log("User profile:", user);
    res.status(200).json(user);
  } catch (error) {
    console.error("Error getting user profile:", (error as Error).message || error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

const getAllSellers: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  try {
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if user has the right role to access sellers
    if (user.role !== "ADMIN" && user.role !== "SELLER") {
      res.status(403).json({ message: "Forbidden: Only admins and sellers can access this resource" });
      return;
    }
    // Fetch all sellers from the database
    const sellers = await prisma.user.findMany({
      where: { role: "SELLER" },
      select: { id: true, name: true, email: true, createdAt: true, Seller: true },
    });

    res.status(200).json({
      message: sellers.length > 0 ? "Sellers retrieved successfully" : "No sellers found",
      sellers,
    });
  } catch (error) {
    console.error("Error fetching sellers:", (error as Error).message || error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// get Seller by id

const getAllBuyers: RequestHandler = async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  try {
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if user has the right role to access buyers
    if (user.role !== "ADMIN" && user.role !== "SELLER") {
      res.status(403).json({ message: "Forbidden: Only admins and sellers can access this resource" });
      return;
    }

    // Fetch all buyers from the database
    const buyers = await prisma.user.findMany({
      where: { role: "BUYER" },
      select: { id: true, name: true, email: true, createdAt: true, Buyer: true },
    });

    res.status(200).json({
      message: buyers.length > 0 ? "Buyers retrieved successfully" : "No buyers found",
      buyers,
    });
  } catch (error) {
    console.error("Error fetching buyers:", (error as Error).message || error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resendVerificationEmail: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if the user is already verified
    if (user.isVerified) {
      res.status(400).json({ message: "Email is already verified" });
      return;
    }

    // Generate a new verification token
    const token = jwt.sign({ id: user.id }, process.env.JWT_KEY as string, { expiresIn: "1h" });

    const verificationLink = `http://localhost:5173/verify-email/${token}`;

    // Set up email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Email Verification Request",
      html: `<p>Click <a href="${verificationLink}">here</a> to verify your email. This link is valid for 1 hour.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Verification link sent to your email" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
};

const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  if (!token) {
    res.status(400).json({ message: "Token is required" });
    return;
  }

  try {
    // Decode and verify the token
    const decodedToken = jwt.verify(token, process.env.JWT_KEY as string) as JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: decodedToken.id } });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Extra security check: Ensure the token email matches the database email
    if (user.email !== decodedToken.email) {
      res.status(400).json({ message: "Invalid token: Email mismatch" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ message: "Email is already verified" });
      return;
    }

    // Update user verification status
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying email:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(400).json({ message: "Invalid or expired token" });
      return;
    }

    res.status(500).json({ message: "Internal server error" });
  }
};

const updateBuyerProfile = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    // Verify token and get user info
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.role !== "BUYER") {
      res.status(403).json({ message: "Forbidden: Only buyers can update their profile" });
      return;
    }

    const { name, phoneNumber, address, email, password } = req.body;

    if (!name && !phoneNumber && !address && !email && !password) {
      res.status(400).json({ message: "At least one field (name, phoneNumber, or address) is required" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name || user.name,
        phoneNumber: phoneNumber || user.phoneNumber,
        email: email || user.email,
        password: hashedPassword,
      },
      include: { Buyer: true },
    });

    if (address) {
      await prisma.buyer.update({
        where: { id: user.id },
        data: { address },
      });
    }

    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating buyer profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateSellerProfile = async (req: Request, res: Response): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.role !== "SELLER") {
      res.status(403).json({ message: "Forbidden: Only sellers can update their profile" });
      return;
    }

    const { storeName, aadharCard, panCard, gstNumber } = req.body;

    if (!storeName && !aadharCard && !panCard && !gstNumber) {
      res
        .status(400)
        .json({ message: "At least one field (storeName, aadharCard, panCard, or gstNumber) is required" });
      return;
    }

    const seller = await prisma.seller.findUnique({ where: { id: user.id } });

    if (!seller) {
      res.status(404).json({ message: "Seller not found" });
      return;
    }

    const updatedSeller = await prisma.seller.update({
      where: { id: user.id },
      data: {
        storeName: storeName || seller.storeName,
        aadharCard: aadharCard || seller.aadharCard,
        panCard: panCard || seller.panCard,
        gstNumber: gstNumber || seller.gstNumber,
      },
    });

    res.status(200).json({ message: "Profile updated successfully", seller: updatedSeller });
  } catch (error) {
    console.error("Error updating seller profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getSellerById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const seller = await prisma.seller.findUnique({ where: { id } });

    if (!seller) {
      res.status(404).json({ message: "Seller not found" });
      return;
    }

    res.status(200).json(seller);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
  }
};

const getBuyerById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const buyer = await prisma.buyer.findUnique({ where: { id } });

    if (!buyer) {
      res.status(404).json({ message: "Buyer not found" });
      return;
    }

    res.status(200).json({ message: "User Found", buyer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
  }
};

export {
  createAdmin,
  adminSignIn,
  registerUser,
  signinUser,
  updateUser,
  getUser,
  deleteUser,
  assignBuyer,
  assignSeller,
  verifySeller,
  logoutUser,
  refreshToken,
  passwordRequest,
  updatePassword,
  getUserProfile,
  getAllSellers,
  getAllBuyers,
  resendVerificationEmail,
  verifyEmail,
  updateBuyerProfile,
  updateSellerProfile,
  getSellerById,
  getBuyerById,
};

// banUsers
// unbanUser
// chnageRole: optional
// GetAdminStats
// rate Limit
