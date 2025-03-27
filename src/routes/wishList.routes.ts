import express from "express";
import {
  addToWishList,
  clearWishList,
  getWishList,
  getWishListCount,
  moveWishListToCart,
  removeFromWishList,
} from "../apis/controler/wishList.controller";
import { authenticateUser, isAdminBuyerOrSeller } from "../middleware/auth.middleware";
const wishListRouter = express.Router();

wishListRouter.post("/add-to-wishlist", authenticateUser, isAdminBuyerOrSeller, addToWishList);
wishListRouter.delete("/remove-from-wishlist", authenticateUser, isAdminBuyerOrSeller, removeFromWishList);
wishListRouter.get("/get-wishlist", authenticateUser, isAdminBuyerOrSeller, getWishList);
wishListRouter.post("/move-wishlist-to-cart", authenticateUser, isAdminBuyerOrSeller, moveWishListToCart);
wishListRouter.delete("/clear-wishlist", authenticateUser, isAdminBuyerOrSeller, clearWishList);
wishListRouter.get("/get-wishlist-count", authenticateUser, isAdminBuyerOrSeller, getWishListCount);

export default wishListRouter;
