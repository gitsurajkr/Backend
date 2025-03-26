import express from "express";
import { authenticateUser, isAdminBuyerOrSeller } from "../middleware/auth.middleware";
import {
  addToCart,
  applyCartDiscount,
  checkoutCart,
  clearCart,
  createOrder,
  deleteFromCart,
  getCart,
  getCartItems,
  getItemsCount,
  removeItemFromCart,
  updateCart,
  validateCart,
} from "../apis/controler/cart.controller";

const cartRrouter = express.Router();

cartRrouter.post("/add-to-cart", authenticateUser, isAdminBuyerOrSeller, addToCart);
cartRrouter.put("/update-cart", authenticateUser, isAdminBuyerOrSeller, updateCart);
cartRrouter.delete("/clear-cart", authenticateUser, isAdminBuyerOrSeller, clearCart);
cartRrouter.delete("/remove-item-from-cart", authenticateUser, isAdminBuyerOrSeller, removeItemFromCart);
cartRrouter.get("/get-items-count/:id", authenticateUser, isAdminBuyerOrSeller, getItemsCount);
cartRrouter.get("/get-cart", authenticateUser, isAdminBuyerOrSeller, getCart);
cartRrouter.get("/get-cart-items/:id", authenticateUser, isAdminBuyerOrSeller, getCartItems);
cartRrouter.get("/validate-cart", authenticateUser, isAdminBuyerOrSeller, validateCart);
cartRrouter.get("/delete-from-cart/:userId/:productId", authenticateUser, isAdminBuyerOrSeller, deleteFromCart);
cartRrouter.get("/apply-cart-discount", authenticateUser, isAdminBuyerOrSeller, applyCartDiscount);
cartRrouter.get("/checkout-cart", authenticateUser, isAdminBuyerOrSeller, checkoutCart);
cartRrouter.get("/create-order", authenticateUser, isAdminBuyerOrSeller, createOrder);
export default cartRrouter;
