import { Request, Response, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";
import { wishlistSchema } from "../../validators/product.validators";

const prisma = new PrismaClient();

const addToWishList: RequestHandler = (req: Request, res: Response): Promise<void> => {};

// add to wishlist
// remove from wishlist
// get wishlist
// move to cart
// clear wishlist
// get wishlist count
