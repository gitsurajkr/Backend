import { Router } from "express";
import { authenticateUser, authorizeRole } from "../middleware/auth.middleware";

const productRoutes = Router();

productRoutes.post("/add-product", authenticateUser, authorizeRole("seller"), addProduct);

export default productRoutes;
