import { Request, RequestHandler, Response } from "express";
import { ProductSchema, querySchema } from "../../validators/product.validators";
import verifyTokenAndGetUser from "../../helper/getUser";
import { Prisma, PrismaClient, ProductCategory, ProductStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { z, ZodError } from "zod";
import { JwtPayload } from "jsonwebtoken";

const prisma = new PrismaClient();

const uuidSchema = z.string().uuid();
const ProductStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const addProduct: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as JwtPayload;

    if (user.role !== "SELLER") {
      res.status(403).json({ error: "Only sellers can add products" });
      return;
    }

    // Validate request body using Zod
    const validatedBody = ProductSchema.omit({ sellerId: true, status: true }).safeParse(req.body);

    if (!validatedBody.success) {
      res.status(400).json({
        error: validatedBody.error.format(),
      });
      return;
    }

    // Create product in database
    const addedProduct = await prisma.product.create({
      data: {
        ...validatedBody.data,
        status: "PENDING",
        sellerId: user.id,
      },
    });

    res.status(201).json({
      message: "Product added successfully",
      data: addedProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);

    if (error instanceof ZodError) {
      res.status(400).json({ error: error.format() });
      return;
    }

    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          res.status(400).json({ error: "A product with this title already exists." });
          return;
        case "P2003":
          res.status(400).json({ error: "Invalid sellerId. The referenced seller does not exist." });
          return;
        default:
          res.status(500).json({ error: "Database error occurred", details: error.message });
          return;
      }
    }

    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unexpected error",
    });
  }
};

const deleteProductById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as JwtPayload;

    const { productId } = req.params;

    // Validate Product ID format
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      res.status(400).json({ error: "Invalid Product ID format" });
      return;
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    if (user.role !== "ADMIN" && product.sellerId !== user.id) {
      res.status(403).json({ error: "Unauthorized: You cannot delete this product" });
      return;
    }

    // Delete product
    await prisma.product.delete({ where: { id: productId } });

    res.status(200).json({ message: "Product deleted successfully" });
    return;
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Product not found or already deleted" });
      return;
    }

    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
};

const updateProductById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as JwtPayload;
    const { productId } = req.params;

    // Validate Product ID format
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      res.status(400).json({ error: "Invalid product ID format" });
      return;
    }

    // Fetch product
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if user is authorized (Seller of the product or Admin)
    if (user.role !== "ADMIN" && product.sellerId !== user.id) {
      res.status(403).json({ error: "Unauthorized: You cannot update this product" });
      return;
    }

    // Validate request body
    const validatedBody = ProductSchema.partial().omit({ status: true }).safeParse(req.body);
    if (!validatedBody.success) {
      res.status(400).json({ error: validatedBody.error.format() });
      return;
    }

    const updateData: Partial<typeof validatedBody.data & { status?: ProductStatus }> = { ...validatedBody.data };

    // Only Admin can update `status`
    if (user.role === "ADMIN" && req.body.status) {
      const statusValidation = ProductStatusEnum.safeParse(req.body.status);
      if (!statusValidation.success) {
        res.status(400).json({ error: "Invalid status value" });
        return;
      }
      updateData.status = statusValidation.data as ProductStatus;
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    res.status(200).json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
    return;
  } catch (error) {
    console.error("Error in updating product:", error);

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Product not found or already deleted" });
      return;
    }

    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
};

const getAllProducts: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    // Validate and parse query parameters
    const validatedQuery = querySchema.safeParse(req.query);
    if (!validatedQuery.success) {
      res.status(400).json({ error: validatedQuery.error.errors[0].message });
      return;
    }

    const { page, limit, category, status } = validatedQuery.data;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    // Construct `where` filter
    const where: { category?: ProductCategory; status?: ProductStatus; sellerId?: string } = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (user.role === "SELLER") where.sellerId = user.id;
    else if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Unauthorized: You cannot view products" });
      return;
    }

    // Fetch products and total count in a single query
    const [products, totalProducts] = await prisma.$transaction([
      prisma.product.findMany({
        where,
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNumber,
      }),
      prisma.product.count({ where }),
    ]);

    res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      totalProducts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProducts / limitNumber),
      data: products,
    });
    return;
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    const { productId } = req.params;

    // Validate productId format
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      res.status(400).json({ error: "Invalid product ID format" });
      return;
    }

    // Fetch product with seller details
    const product = await prisma.product.findUnique({
      where: { id: productId },
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
        seller: {
          select: { sellerId: true },
        },
      },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    if (user.role !== "ADMIN" && product.seller?.sellerId !== user.id) {
      res.status(403).json({ error: "Unauthorized: You cannot view this product" });
      return;
    }

    res.status(200).json({
      message: "Product fetched successfully",
      data: product,
    });
    return;
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductBySellerId: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    const { sellerId } = req.params;

    if (!uuidSchema.safeParse(sellerId).success) {
      res.status(400).json({ error: "Invalid seller ID format" });
      return;
    }

    const seller = await prisma.seller.findUnique({
      where: { sellerId },
    });

    if (!seller) {
      res.status(404).json({ error: "Seller not found" });
      return;
    }

    if (user.role !== "ADMIN" && user.id !== seller.sellerId) {
      res.status(403).json({ error: "Unauthorized: You cannot access these products" });
      return;
    }

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

    res.status(200).json({
      message: "All products fetched successfully",
      count: products.length,
      data: products,
    });
    return;
  } catch (error) {
    console.error("Error fetching products:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductByCategory: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    // Ensure user is verified before allowing access
    if (!user.isVerified) {
      res.status(403).json({ error: "Unauthorized: User not verified" });
      return;
    }

    const { category } = req.query;

    if (!Object.values(ProductCategory).includes(category as ProductCategory)) {
      res.status(400).json({ error: "Invalid category provided" });
      return;
    }

    // Fetch products by category
    const products = await prisma.product.findMany({
      where: { category: category as ProductCategory },
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

    res.status(200).json({
      message: "All products fetched successfully",
      count: products.length,
      data: products,
    });
    return;
  } catch (error) {
    console.error("Error fetching products by category:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductsByPriceRange: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ error: "Unauthorized: User not verified" });
      return;
    }

    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : 0;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : Infinity;

    if (isNaN(minPrice) || isNaN(maxPrice)) {
      res.status(400).json({ error: "Min and Max price must be valid numbers" });
      return;
    }
    if (minPrice < 0 || maxPrice < 0) {
      res.status(400).json({ error: "Prices cannot be negative" });
      return;
    }
    if (minPrice > maxPrice) {
      res.status(400).json({ error: "Min price cannot be greater than Max price" });
      return;
    }

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

    res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by price range:", (error as Error).message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductByName: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ error: "Unauthorized: User not verified" });
      return;
    }

    const name = req.query.name?.toString().trim();

    if (!name) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    // Fetch products by name (case-insensitive search)
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
        seller: {
          select: {
            storeName: true,
          },
        },
        images: {
          select: {
            url: true,
          },
        },
      },
    });

    if (products.length === 0) {
      res.status(404).json({ error: "No products found with the given name" });
      return;
    }

    res.status(200).json({
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

    const pageNumber = Number.isNaN(Number(req.query.page)) ? 1 : parseInt(req.query.page as string, 10);
    const limitNumber = Number.isNaN(Number(req.query.limit)) ? 10 : parseInt(req.query.limit as string, 10);

    if (pageNumber < 1 || limitNumber < 1) {
      return res.status(400).json({ error: "Page and limit must be positive numbers" });
    }

    const [totalProducts, products] = await prisma.$transaction([
      prisma.product.count({ where: { status: "APPROVED" } }),
      prisma.product.findMany({
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
        where: { status: "APPROVED" },
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
          seller: {
            select: {
              storeName: true,
              rating: true,
            },
          },
          sellerId: true,
        },
      }),
    ]);

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

const productSortByPriceOrRating: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    const { sortBy, order } = req.query;

    // Validate sorting field
    const validSortFields = ["price", "rating"];
    if (!sortBy || !validSortFields.includes(sortBy as string)) {
      res.status(400).json({ error: "Invalid sortBy value. Allowed: 'price' or 'rating'" });
      return;
    }

    // Validate order direction
    const sortOrder = order === "desc" ? "desc" : "asc";

    let products;

    if (sortBy === "price") {
      products = await prisma.product.findMany({
        where: { status: "APPROVED" },
        orderBy: { price: sortOrder },
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
    } else {
      products = await prisma.product.findMany({
        where: { status: "APPROVED" },
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
          // _avg: { rating: true },
        },
        // orderBy: {
        //   reviews: { _avg: { rating: sortOrder } }, // Sorting by avg rating
        // },
      });
    }

    res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error sorting products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const discountProducts: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const products = await prisma.product.findMany({
      where: {
        discount: { gt: 0 },
        status: "APPROVED",
      },
      orderBy: { discount: "desc" },
      take: limit,
      skip: skip,
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

    const totalProducts = await prisma.product.count({
      where: { discount: { gt: 0 }, status: "APPROVED" },
    });

    res.status(200).json({
      message: "Products with discounts fetched successfully",
      count: products.length,
      total: totalProducts,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      data: products,
    });
  } catch (error) {
    console.error("Error fetching discounted products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyAllProducts: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden: You cannot access this resource" });
      return;
    }

    const pendingProducts = await prisma.product.findMany({
      where: { status: "PENDING" },
      select: { id: true, title: true },
    });

    if (pendingProducts.length === 0) {
      res.status(400).json({ error: "No pending products to verify" });
      return;
    }

    const updateResult = await prisma.$transaction([
      prisma.product.updateMany({
        where: { status: "PENDING" },
        data: { status: "APPROVED" },
      }),
    ]);

    console.log(`Verified ${updateResult[0].count} products`);

    res.status(200).json({
      message: "All pending products verified successfully",
      verifiedCount: updateResult[0].count,
      verifiedProducts: pendingProducts,
    });
    return;
  } catch (error) {
    console.error("Error verifying all products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllProductsLeftForVerification: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden: You cannot access this resource" });
      return;
    }

    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string, 10) || 10, 1);
    const skip = (page - 1) * limit;

    // Get category from query
    const category = req.query.category as string | undefined;

    const isValidCategory = category && Object.values(ProductCategory).includes(category as ProductCategory);

    const filters: Prisma.ProductWhereInput = {
      status: "PENDING",
      ...(isValidCategory ? { category: category as ProductCategory } : {}),
    };

    const validSortFields = ["price", "rating", "createdAt"];
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order: "asc" | "desc" = (req.query.order as string)?.toLowerCase() === "desc" ? "desc" : "asc";

    if (!validSortFields.includes(sortBy)) {
      res.status(400).json({ error: `Invalid sortBy value. Use one of: ${validSortFields.join(", ")}` });
      return;
    }

    const products = await prisma.product.findMany({
      where: filters,
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
        [sortBy]: order,
      },
      skip,
      take: limit,
    });

    const totalPending = await prisma.product.count({ where: filters });

    res.status(200).json({
      message: "Pending products fetched successfully",
      page,
      limit,
      totalPending,
      totalPages: Math.ceil(totalPending / limit),
      data: products,
    });
    return;
  } catch (error) {
    console.error("Error fetching pending products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyProductById: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    if (user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden: You cannot access this resource" });
      return;
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    if (product.status !== "PENDING") {
      res.status(400).json({ error: "Product is already verified" });
      return;
    }

    await prisma.product.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    res.status(200).json({ message: "Product verified successfully" });
  } catch (error) {
    console.error("Error verifying product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyProductOfSellerEmailByAdmin: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized: No token provided",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ message: "Unaauthorised: Invalid Token" });
      return;
    }

    if (user.role !== "ADMIN") {
      res.status(403).json({ message: "Forbidden: You cannot access this resource" });
      return;
    }

    const { email } = req.params;

    const seller = await prisma.user.findUnique({
      where: { email },
    });

    if (!seller) {
      res.status(404).json({ error: "Seller not found" });
      return;
    }

    const pendingProducts = await prisma.product.findMany({
      where: { sellerId: seller.id, status: "PENDING" },
      select: { id: true, title: true },
    });

    if (pendingProducts.length === 0) {
      res.status(404).json({ error: "No pending products found for this seller" });
      return;
    }

    const { count } = await prisma.product.updateMany({
      where: { sellerId: seller.id, status: "PENDING" },
      data: { status: "APPROVED" },
    });
    res.status(200).json({
      message: "All pending products of this seller verified successfully",
      totalVerified: count,
      verifiedProducts: pendingProducts,
    });
  } catch (error) {
    console.error("Error verifying product of seller email by admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductBySellerWithStatus: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    const { sellerId, status } = req.params;

    // Validate sellerId format
    if (!sellerId || !uuidSchema.safeParse(sellerId).success) {
      res.status(400).json({ error: "Invalid seller ID format" });
      return;
    }

    // Validate status
    if (!status || !Object.values(ProductStatus).includes(status as ProductStatus)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    // Find seller
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      res.status(404).json({ error: "Seller not found" });
      return;
    }

    if (user.role !== "ADMIN" && user.id !== sellerId) {
      res.status(403).json({ error: "Forbidden: You cannot view this seller's products" });
      return;
    }

    // Fetch products
    const products = await prisma.product.findMany({
      where: { sellerId, status: status as ProductStatus },
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

    res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by seller with status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const bulkUploadProduct: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract and validate auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    // Role-based access control
    const allowedRoles = new Set(["ADMIN", "SELLER"]);
    if (!allowedRoles.has(user.role)) {
      res.status(403).json({ error: "Forbidden: You cannot access this resource" });
      return;
    }

    // Validate request body
    if (!Array.isArray(req.body)) {
      res.status(400).json({ error: "Invalid request format: Expected an array of products." });
      return;
    }

    const ProductArraySchema = z.array(ProductSchema.omit({ sellerId: true, status: true }));
    const validatedBody = ProductArraySchema.safeParse(req.body);

    if (!validatedBody.success) {
      res.status(400).json({
        error: "Invalid product data",
        details: validatedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    // Attach sellerId and status
    const products = validatedBody.data.map((product) => ({
      ...product,
      sellerId: user.id,
      status: "PENDING" as ProductStatus,
    }));

    // Insert products in a transaction and return actual inserted data
    const addedProducts = await prisma.$transaction(
      products.map((product) => prisma.product.create({ data: product }))
    );

    res.status(201).json({
      message: "Products added successfully",
      data: addedProducts,
    });
  } catch (error) {
    console.error("Error adding product:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        res.status(400).json({
          error: "A product with this title already exists. Please use a different title.",
        });
        return;
      }
      if (error.code === "P2003") {
        res.status(400).json({
          error: "Invalid sellerId. The referenced seller does not exist.",
        });
        return;
      } else {
        res.status(500).json({ error: "Database error occurred", details: error.message });
        return;
      }
    }

    res.status(500).json({
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unexpected error",
    });
    return;
  }
};

const bulkDeleteProducts: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized : No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      res.status(400).json({ error: "Invalid request format: Expected an array of product IDs." });
      return;
    }

    const validProductIds = productIds.every((id) => uuidSchema.safeParse(id).success);

    if (!validProductIds) {
      res.status(400).json({ error: "Invalid product ID format" });
      return;
    }

    const deleteResult = await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });

    res.status(200).json({
      message: "Products deleted successfully",
      count: deleteResult.count,
    });
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        res.status(404).json({ error: "Product not found or already deleted" });
        return;
      }
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};

// filter Products

export {
  addProduct,
  deleteProductById,
  updateProductById,
  getAllProducts,
  getProductById,
  getProductBySellerId,
  getProductByCategory,
  getProductsByPriceRange,
  getProductByName,
  getProductsByPagination,
  productSortByPriceOrRating,
  discountProducts,
  getAllProductsLeftForVerification,
  verifyAllProducts,
  verifyProductById,
  getProductBySellerWithStatus,
  bulkUploadProduct,
  bulkDeleteProducts,
  verifyProductOfSellerEmailByAdmin,
  // filtered Products

  //  check image
};
