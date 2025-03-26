import { Router } from "express";
import { authenticateUser } from "../middleware/auth.middleware";
import { addReviewsByBuyer, getAllReviews, getAllReviewsByProductId } from "../apis/controler/reviews.controller";
const reviewRoutes = Router();

// review routes

reviewRoutes.post("/add-review", authenticateUser, addReviewsByBuyer);
reviewRoutes.get("/get-review/:id", authenticateUser, addReviewsByBuyer);
reviewRoutes.get("get-all-reviews", authenticateUser, getAllReviews);
reviewRoutes.get("/get-review-buyer-id/:id", authenticateUser, addReviewsByBuyer);
reviewRoutes.delete("/delete-review/:id", authenticateUser, addReviewsByBuyer);
reviewRoutes.put("/update-review/:id", authenticateUser, addReviewsByBuyer);
reviewRoutes.get("get-review-by-product-id/:id", authenticateUser, getAllReviewsByProductId);
export default reviewRoutes;
