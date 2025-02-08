// write all routes of controller here
// make a proper file structure and write route for your project routes folder.

// routes/index.ts
// routes/user.route.ts
// routes/product.route.ts
// make a proper file structure and write route for your project routes folder.

import express from "express";
import userRoutes from "./user.routes";

const router = express.Router();

//user routes
router.use("/user", userRoutes);

export default router;
