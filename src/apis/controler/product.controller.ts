import { Request, Response } from "express";
import { ProductSchema } from "../../validators/product.validators";
import verifyTokenAndGetUser from "../../helper/getUser";
import { PrismaClient, ProductStatus } from "@prisma/client";
const prisma = new PrismaClient();
import { z } from "zod";
const uuidSchema = z.string().uuid();

// const addProduct = async (req: Request, res: Response) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader?.startsWith("Bearer ")) {
//       return res.status(401).json({
//         error: "Unauthorized: No token provided",
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     const user = await verifyTokenAndGetUser(token);

//     if (!user || user.role !== "SELLER") {
//       return res.status(403).json({ error: "Only sellers can add products" });
//     }

//     const validatedBody = ProductSchema.omit({ sellerId: true, status: true }).safeParse(req.body);

//     if (!validatedBody.success) {
//       return res.status(400).json({
//         error: validatedBody.error.errors[0].message,
//       });
//     }

//     // Add product to database

//     const addedProduct = await prisma.product.create({
//       data: {
//         ...validatedBody.data,
//         status: "PENDING",
//         sellerId: user.id,
//       },
//     });

//     // migrate prisma and remove
//     return res.status(201).json({
//       message: "Product added successfully",
//       data: addedProduct,
//     });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({
//       message: "Internal Server Error",
//       error: error instanceof Error ? error.message : "Internal Server Error",
//     });
//   }
// };

const deleteProductById = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // verify user
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({
        error: "Unauthorized: Invalid token",
      });
    }

    const { productId } = req.params;

    // check if product exists

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    // check if user is seller of the product or admin

    if (user.role !== "ADMIN" && product.sellerId !== user.id) {
      return res.status(403).json({ error: "Unauthorized: You cannot delete this product" });
    }

    // delete product

    const deletedProduct = await prisma.product.delete({
      where: { id: productId },
    });

    console.log("Deleted product:", deletedProduct);
    return res.status(200).json({
      message: "Product deleted Successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "internal server error" });
  }
};

const updateProductById = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const { productId } = req.params;

    // Validate productId format if it's a UUID
    if (!uuidSchema.safeParse(productId).success) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (user.role !== "ADMIN" && product.sellerId !== user.id) {
      return res.status(403).json({ error: "Unauthorized: You cannot update this product" });
    }

    // Validate request body
    const validatedBody = ProductSchema.partial().omit({ status: true }).safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({ error: validatedBody.error.errors[0].message });
    }

    // Prepare update data
    const updateData: Partial<typeof validatedBody.data> & { updatedAt: Date; status?: ProductStatus } = {
      ...validatedBody.data,
      updatedAt: new Date(),
    };

    // Only Admin can update `status`
    if (user.role === "ADMIN" && req.body.status) {
      if (!["PENDING", "APPROVED", "REJECTED"].includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      updateData.status = req.body.status as ProductStatus;
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    return res.status(200).json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error in updating product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllProducts = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Unauthorized: You cannot view all products" });
    }

    // Fetch products with selected fields

    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discount: true,
        category: true,
        stock: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message: "All products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductById = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized: No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized: Invalid token",
      });
    }

    const { productId } = req.params;

    // Validate productId format if it's a UUID
    if (!uuidSchema.safeParse(productId).success) {
      return res.status(400).json({
        error: "Invalid product ID format",
      });
    }

    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

const getProductBySellerId = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const { sellerId } = req.params;

    // Validate sellerId format if it's a UUID
    if (!uuidSchema.safeParse(sellerId).success) {
      return res.status(400).json({ error: "Invalid seller ID format" });
    }

    // 🔒 Restrict Access: Only the seller or an ADMIN can fetch products
    if (user.role !== "ADMIN" && user.id !== sellerId) {
      return res.status(403).json({ error: "Unauthorized: You cannot access these products" });
    }

    // Check if seller exists
    const seller = await prisma.user.findUnique({ where: { id: sellerId } });
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    // Fetch products by sellerId
    const products = await prisma.product.findMany({
      where: { sellerId },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discount: true,
        category: true,
        stock: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "All products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductByCategory = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const { category } = req.params;

    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }

    // Fetch products by category

    const products = await prisma.product.findMany({
      where: { category },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discount: true,
        category: true,
        stock: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "All products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by category:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductsByPriceRange = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const minPrice = Number(req.query.minPrice);
    const maxPrice = Number(req.query.maxPrice);

    // Validate price inputs
    if (isNaN(minPrice) || isNaN(maxPrice)) {
      return res.status(400).json({ error: "Min and Max price must be valid numbers" });
    }
    if (minPrice < 0 || maxPrice < 0) {
      return res.status(400).json({ error: "Prices cannot be negative" });
    }
    if (minPrice > maxPrice) {
      return res.status(400).json({ error: "Min price cannot be greater than Max price" });
    }

    // Fetch products within the price range
    const products = await prisma.product.findMany({
      where: {
        price: { gte: minPrice, lte: maxPrice },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discount: true,
        category: true,
        stock: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by price range:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductByName = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const name = req.params.name?.trim();

    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }

    // Fetch products by name (case-insensitive search for better UX)
    const products = await prisma.product.findMany({
      where: {
        title: { contains: name, mode: "insensitive" },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discount: true,
        category: true,
        stock: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (products.length === 0) {
      return res.status(404).json({ error: "No products found with the given name" });
    }

    return res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by name:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductsByPagination = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const { page, limit } = req.query;

    // Default values if not provided
    const pageNumber = parseInt(page as string, 10) || 1;
    const limitNumber = parseInt(limit as string, 10) || 10;

    if (pageNumber < 1 || limitNumber < 1) {
      return res.status(400).json({ error: "Page and limit must be positive numbers" });
    }

    // Fetch total product count for pagination metadata
    const totalProducts = await prisma.product.count();

    // Fetch products with pagination
    const products = await prisma.product.findMany({
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        discount: true,
        category: true,
        stock: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "Products fetched successfully",
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProducts / limitNumber),
      totalProducts,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by pagination:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// add product -> Done
// delete Product by id -> done
// update Product by id -> done
// get all product -> done
// get product by id -> done
// get product by seller id -> done
// get product by category -> done
// get products by price range -> done
// get product by name(search) -> done
// Get Products with Pagination -> done
// get products sortedbby price or ratings
// get discounted products
// Get Products by Availability (In Stock / Out of Stock)
// Get Products by Seller with Status
// Bulk Upload Product
// Bulk Delete Products
// Get Product Reviews
// Add Review for Product
// Get Related Products
// Add Product to Wishlist
// Get All Wishlist Products
// get all product which is left for verification
// verify all product
// verify product of seller email by admin
// verify product by product

export {
  // addProduct,
  deleteProductById,
  updateProductById,
  getAllProducts,
  getProductById,
  getProductBySellerId,
  getProductByCategory,
  getProductsByPriceRange,
  getProductByName,
  getProductsByPagination,
  // productSortByPriceOrRating,
};
