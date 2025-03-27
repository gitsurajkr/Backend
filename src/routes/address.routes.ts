import express from "express";
import {
  addBuyerAddress,
  updateBuyerAddress,
  deleteBuyerAddress,
  getBuyerAddresses,
  getBuyerAddressForSeller,
  getDefaultAddress,
} from "../apis/controler/address.controller";
import { authenticateUser } from "../middleware/auth.middleware"; // Assuming you have authentication middleware

const addressRouter = express.Router();

addressRouter.post("/add", authenticateUser, addBuyerAddress);
addressRouter.put("/update/:addressId", authenticateUser, updateBuyerAddress);
addressRouter.delete("/delete/:addressId", authenticateUser, deleteBuyerAddress);
addressRouter.get("/all", authenticateUser, getBuyerAddresses);
addressRouter.get("/default", authenticateUser, getDefaultAddress);
addressRouter.get("/order/:orderId", authenticateUser, getBuyerAddressForSeller);

export default addressRouter;
