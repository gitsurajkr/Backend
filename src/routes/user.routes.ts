import { Router } from "express";
import {
  registerUser,
  signinUser,
  updateUser,
  deleteUser,
  getUser,
  assignSeller,
  verifySeller,
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
  createAdmin,
  adminSignIn,
  assignBuyer,
} from "../apis/controler/auth.controller";
import {
  authenticateUser,
  isAdmin,
  isBuyerOrAdmin,
  validateBuyerUpdate,
  validateEmail,
  validatePassword,
  validateSellerUpdate,
  validateToken,
} from "../middleware/auth.middleware";

const userRouter = Router();

// manual auth routes
// Route to create an admin (Run once)
userRouter.post("/create-admin", createAdmin);
userRouter.post("/admin-signin", adminSignIn);

userRouter.post("/register", registerUser);
userRouter.post("/signin", signinUser);
userRouter.put("/update", authenticateUser, updateUser);
userRouter.get("/get-user", getUser);
userRouter.delete("/delete", authenticateUser, isAdmin, deleteUser);
userRouter.post("/assign-buyer", authenticateUser, assignBuyer);
userRouter.post("/assign-seller", authenticateUser, assignSeller);
userRouter.post("/admin/verify-seller", authenticateUser, isAdmin, verifySeller);
userRouter.post("/forgot-password", validateEmail, passwordRequest);
userRouter.post("/reset-password/:resetToken", validatePassword, updatePassword);
userRouter.get("/profile", authenticateUser, getUserProfile);
userRouter.get("/all-sellers", authenticateUser, isBuyerOrAdmin, getAllSellers);
userRouter.get("/all-buyers", authenticateUser, isAdmin, getAllBuyers);
userRouter.post("/resend-verification-email", authenticateUser, validateEmail, resendVerificationEmail);
userRouter.get("/verify-email/:token", validateToken, verifyEmail);
userRouter.put("/buyer/profile", authenticateUser, validateBuyerUpdate, updateBuyerProfile);
userRouter.put("/seller/profile", authenticateUser, validateSellerUpdate, updateSellerProfile);
userRouter.get("/seller/:id", authenticateUser, isBuyerOrAdmin, getSellerById);
userRouter.get("/buyer/:id", authenticateUser, isBuyerOrAdmin, getBuyerById);

export default userRouter;
