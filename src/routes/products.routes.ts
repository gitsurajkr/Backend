import { Router } from "express";
import { authenticateUser, isAdmin, isAdminOrSeller } from "../middleware/auth.middleware";
import {
  addProduct,
  deleteProductById,
  getAllProducts,
  getProductByCategory,
  getProductById,
  getProductByName,
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

const productRoutes = Router();

// productRoutes.
productRoutes.post("/add-product", authenticateUser, isAdminOrSeller, addProduct);
productRoutes.delete("/delete-product", authenticateUser, isAdminOrSeller, deleteProductById);
productRoutes.patch("update-product/:id", authenticateUser, isAdminOrSeller, updateProductById);
productRoutes.get("get-all-prpducts", authenticateUser, getAllProducts);
productRoutes.get("get-products/:id", authenticateUser, getProductById);
productRoutes.get("get-product-by-seller/:id", authenticateUser, isAdminOrSeller, getProductBySellerId);
productRoutes.get("products-by-category/", authenticateUser, getProductByCategory);
// tested as GET /products-by-category?category=value
productRoutes.get("get-product-by-range", authenticateUser, getProductsByPriceRange);
productRoutes.get("/products-by-name", authenticateUser, getProductByName);
productRoutes.get("/product-by-pagination", authenticateUser, getProductByName);
productRoutes.get("/product-sort-by-rating", authenticateUser, productSortByPriceOrRating);
productRoutes.get("/discount-products", authenticateUser, discountProducts);
productRoutes.get("/verify-all-products", authenticateUser, isAdmin, verifyAllProducts);
productRoutes.get(
  "/get-all-products-left-for-verification",
  authenticateUser,
  isAdmin,
  getAllProductsLeftForVerification
);
productRoutes.post("/products/verify/:id", authenticateUser, verifyProductById);
productRoutes.get("/products/verify/:email", authenticateUser, isAdmin, verifyProductOfSellerEmailByAdmin);
productRoutes.get("/get-product-by-seller-with-status", authenticateUser, getProductBySellerWithStatus);
productRoutes.get("/bulk-upload-product", authenticateUser, isAdminOrSeller, bulkUploadProduct);
productRoutes.delete("/bulk-delete-products", authenticateUser, isAdminOrSeller, bulkDeleteProducts);

export default productRoutes;
