import { Router } from "express";

import { ProductSchema } from "../validators/product.validators";

import {
  addProduct,
  deleteProductById,
  getAllProducts,
  getProductByCategory,
  getProductById,
  getProductByName,
  getProductsByPagination,
  getProductBySellerId,
  getProductsByPriceRange,
  productSortByPriceOrRating,
  updateProductById,
  discountProducts,
  verifyAllProducts,
  getAllProductsLeftForVerification,
  verifyProductById,
  verifyProductOfSellerEmailByAdmin,
  getProductBySellerWithStatus,
  bulkUploadProduct,
  bulkDeleteProducts,
} from "../apis/controler/product.controller";
import { authenticateUser, isAdmin, isAdminOrSeller } from "../middleware/auth.middleware";
import { isSeller, validate, validateProductQuery, validateUUID } from "../middleware/product.middleware";

const productRoutes = Router();

// productRoutes.
productRoutes.post(
  "/products",
  authenticateUser,
  isSeller,
  validate(ProductSchema.omit({ sellerId: true, status: true })),
  addProduct
);

productRoutes.delete("/products/:productId", authenticateUser, validateUUID("productId"), deleteProductById);

productRoutes.patch(
  "/products/:productId",
  authenticateUser,
  validateUUID("productId"),
  validate(ProductSchema.partial()),
  updateProductById
);

productRoutes.get("/products", authenticateUser, validateProductQuery, getAllProducts);

productRoutes.get("/products/:productId", authenticateUser, validateUUID("productId"), getProductById);

productRoutes.get("/products/seller/:sellerId", authenticateUser, validateUUID("sellerId"), getProductBySellerId);

productRoutes.get("/products/category", authenticateUser, getProductByCategory); // Uses query param: `/products/category?category=value`

productRoutes.get("/products/price-range", authenticateUser, getProductsByPriceRange); // Uses query param: `/products/price-range?min=10&max=100`

productRoutes.get("/products/name", authenticateUser, getProductByName); // Uses query param: `/products/name?name=value`

productRoutes.get("/products/paginated", authenticateUser, getProductsByPagination);

productRoutes.get("/products/sorted-by-rating", authenticateUser, productSortByPriceOrRating);

productRoutes.get("/products/discounted", authenticateUser, discountProducts);

productRoutes.put("/products/verify-all", authenticateUser, isAdmin, verifyAllProducts);

productRoutes.get("/products/pending-verification", authenticateUser, isAdmin, getAllProductsLeftForVerification);

productRoutes.put("/products/verify/:id", authenticateUser, validateUUID("id"), verifyProductById);

productRoutes.get("/products/verify/seller/:email", authenticateUser, isAdmin, verifyProductOfSellerEmailByAdmin);

productRoutes.get("/products/seller/:sellerId/status/:status", authenticateUser, getProductBySellerWithStatus);

productRoutes.post("/products/bulk-upload", authenticateUser, isAdminOrSeller, bulkUploadProduct);

productRoutes.delete("/products/bulk-delete", authenticateUser, isAdminOrSeller, bulkDeleteProducts);

export default productRoutes;
