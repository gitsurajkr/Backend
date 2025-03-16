import { Request, Response } from "express";
import { ProductSchema, querySchema, reviewSchema } from "../../validators/product.validators";
import verifyTokenAndGetUser from "../../helper/getUser";
import { Prisma, PrismaClient, ProductCategory, ProductStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { z, ZodError } from "zod";
import { JwtPayload } from "jsonwebtoken";

const prisma = new PrismaClient();

const uuidSchema = z.string().uuid();
const ProductStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const addProduct = async (req: Request, res: Response) => {
  try {
    const user = req.user as JwtPayload;

    if (user.role !== "SELLER") {
      return res.status(403).json({ error: "Only sellers can add products" });
    }

    // Validate request body using Zod
    const validatedBody = ProductSchema.omit({ sellerId: true, status: true }).safeParse(req.body);

    if (!validatedBody.success) {
      return res.status(400).json({
        error: validatedBody.error.format(),
      });
    }

    // Create product in database
    const addedProduct = await prisma.product.create({
      data: {
        ...validatedBody.data,
        status: "PENDING",
        sellerId: user.id,
      },
    });

    return res.status(201).json({
      message: "Product added successfully",
      data: addedProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);

    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.format() });
    }

    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return res.status(400).json({ error: "A product with this title already exists." });
        case "P2003":
          return res.status(400).json({ error: "Invalid sellerId. The referenced seller does not exist." });
        default:
          return res.status(500).json({ error: "Database error occurred", details: error.message });
      }
    }

    return res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unexpected error",
    });
  }
};

const deleteProductById = async (req: Request, res: Response) => {
  try {
    const user = req.user as JwtPayload;

    const { productId } = req.params;

    // Validate Product ID format
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid Product ID format" });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (user.role !== "ADMIN" && product.sellerId !== user.id) {
      return res.status(403).json({ error: "Unauthorized: You cannot delete this product" });
    }

    // Delete product
    await prisma.product.delete({ where: { id: productId } });

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Product not found or already deleted" });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateProductById = async (req: Request, res: Response) => {
  try {
    const user = req.user as JwtPayload;
    const { productId } = req.params;

    // Validate Product ID format
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    // Fetch product
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if user is authorized (Seller of the product or Admin)
    if (user.role !== "ADMIN" && product.sellerId !== user.id) {
      return res.status(403).json({ error: "Unauthorized: You cannot update this product" });
    }

    // Validate request body
    const validatedBody = ProductSchema.partial().omit({ status: true }).safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({ error: validatedBody.error.format() });
    }

    const updateData: Partial<typeof validatedBody.data & { status?: ProductStatus }> = { ...validatedBody.data };

    // Only Admin can update `status`
    if (user.role === "ADMIN" && req.body.status) {
      const statusValidation = ProductStatusEnum.safeParse(req.body.status);
      if (!statusValidation.success) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      updateData.status = statusValidation.data as ProductStatus;
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

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      return res.status(404).json({ error: "Product not found or already deleted" });
    }

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllProducts = async (req: Request, res: Response) => {
  try {
    // Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Validate and parse query parameters
    const validatedQuery = querySchema.safeParse(req.query);
    if (!validatedQuery.success) {
      return res.status(400).json({ error: validatedQuery.error.errors[0].message });
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
    else if (user.role !== "ADMIN") return res.status(403).json({ error: "Unauthorized: You cannot view products" });

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

    return res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      totalProducts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProducts / limitNumber),
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
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const { productId } = req.params;

    // Validate productId format
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid product ID format" });
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
      return res.status(404).json({ error: "Product not found" });
    }

    if (user.role !== "ADMIN" && product.seller?.sellerId !== user.id) {
      return res.status(403).json({ error: "Unauthorized: You cannot view this product" });
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
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

    if (!uuidSchema.safeParse(sellerId).success) {
      return res.status(400).json({ error: "Invalid seller ID format" });
    }

    const seller = await prisma.seller.findUnique({
      where: { sellerId },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    if (user.role !== "ADMIN" && user.id !== seller.sellerId) {
      return res.status(403).json({ error: "Unauthorized: You cannot access these products" });
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

    // Ensure user is verified before allowing access
    if (!user.isVerified) {
      return res.status(403).json({ error: "Unauthorized: User not verified" });
    }

    const { category } = req.params;

    if (!Object.values(ProductCategory).includes(category as ProductCategory)) {
      return res.status(400).json({ error: "Invalid category provided" });
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

    if (!user.isVerified) {
      return res.status(403).json({ error: "Unauthorized: User not verified" });
    }

    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : 0;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : Infinity;

    if (isNaN(minPrice) || isNaN(maxPrice)) {
      return res.status(400).json({ error: "Min and Max price must be valid numbers" });
    }
    if (minPrice < 0 || maxPrice < 0) {
      return res.status(400).json({ error: "Prices cannot be negative" });
    }
    if (minPrice > maxPrice) {
      return res.status(400).json({ error: "Min price cannot be greater than Max price" });
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

    if (!user.isVerified) {
      return res.status(403).json({ error: "Unauthorized: User not verified" });
    }

    const name = req.params.name?.trim();

    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
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

const productSortByPriceOrRating = async (req: Request, res: Response) => {
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

    const { sortBy, order } = req.query;

    // Validate sorting field
    const validSortFields = ["price", "rating"];
    if (!sortBy || !validSortFields.includes(sortBy as string)) {
      return res.status(400).json({ error: "Invalid sortBy value. Allowed: 'price' or 'rating'" });
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

    return res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error sorting products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const discountProducts = async (req: Request, res: Response) => {
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

    return res.status(200).json({
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

const verifyAllProducts = async (req: Request, res: Response) => {
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
      return res.status(403).json({ error: "Forbidden: You cannot access this resource" });
    }

    const pendingProducts = await prisma.product.findMany({
      where: { status: "PENDING" },
      select: { id: true, title: true },
    });

    if (pendingProducts.length === 0) {
      return res.status(400).json({ error: "No pending products to verify" });
    }

    const updateResult = await prisma.$transaction([
      prisma.product.updateMany({
        where: { status: "PENDING" },
        data: { status: "APPROVED" },
      }),
    ]);

    console.log(`Verified ${updateResult[0].count} products`);

    return res.status(200).json({
      message: "All pending products verified successfully",
      verifiedCount: updateResult[0].count,
      verifiedProducts: pendingProducts,
    });
  } catch (error) {
    console.error("Error verifying all products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllProductsLeftForVerification = async (req: Request, res: Response) => {
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
      return res.status(403).json({ error: "Forbidden: You cannot access this resource" });
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
      return res.status(400).json({ error: `Invalid sortBy value. Use one of: ${validSortFields.join(", ")}` });
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

    return res.status(200).json({
      message: "Pending products fetched successfully",
      page,
      limit,
      totalPending,
      totalPages: Math.ceil(totalPending / limit),
      data: products,
    });
  } catch (error) {
    console.error("Error fetching pending products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyProductById = async (req: Request, res: Response) => {
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
      return res.status(403).json({ error: "Forbidden: You cannot access this resource" });
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.status !== "PENDING") {
      return res.status(400).json({ error: "Product is already verified" });
    }

    await prisma.product.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    return res.status(200).json({ message: "Product verified successfully" });
  } catch (error) {
    console.error("Error verifying product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyProductOfSellerEmailByAdmin = async (req: Request, res: Response) => {
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
      return res.status(401).json({ message: "Unaauthorised: Invalid Token" });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden: You cannot access this resource" });
    }

    const { email } = req.params;

    const seller = await prisma.user.findUnique({
      where: { email },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const pendingProducts = await prisma.product.findMany({
      where: { sellerId: seller.id, status: "PENDING" },
      select: { id: true, title: true },
    });

    if (pendingProducts.length === 0) {
      return res.status(404).json({ error: "No pending products found for this seller" });
    }

    const { count } = await prisma.product.updateMany({
      where: { sellerId: seller.id, status: "PENDING" },
      data: { status: "APPROVED" },
    });
    return res.status(200).json({
      message: "All pending products of this seller verified successfully",
      totalVerified: count,
      verifiedProducts: pendingProducts,
    });
  } catch (error) {
    console.error("Error verifying product of seller email by admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getProductBySellerWithStatus = async (req: Request, res: Response) => {
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

    const { sellerId, status } = req.params;

    // Validate sellerId format
    if (!sellerId || !uuidSchema.safeParse(sellerId).success) {
      return res.status(400).json({ error: "Invalid seller ID format" });
    }

    // Validate status
    if (!status || !Object.values(ProductStatus).includes(status as ProductStatus)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Find seller
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    if (user.role !== "ADMIN" && user.id !== sellerId) {
      return res.status(403).json({ error: "Forbidden: You cannot view this seller's products" });
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

    return res.status(200).json({
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error fetching products by seller with status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const bulkUploadProduct = async (req: Request, res: Response) => {
  try {
    // Extract and validate auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Role-based access control
    const allowedRoles = new Set(["ADMIN", "SELLER"]);
    if (!allowedRoles.has(user.role)) {
      return res.status(403).json({ error: "Forbidden: You cannot access this resource" });
    }

    // Validate request body
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "Invalid request format: Expected an array of products." });
    }

    const ProductArraySchema = z.array(ProductSchema.omit({ sellerId: true, status: true }));
    const validatedBody = ProductArraySchema.safeParse(req.body);

    if (!validatedBody.success) {
      return res.status(400).json({
        error: "Invalid product data",
        details: validatedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
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

    return res.status(201).json({
      message: "Products added successfully",
      data: addedProducts,
    });
  } catch (error) {
    console.error("Error adding product:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(400).json({
          error: "A product with this title already exists. Please use a different title.",
        });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          error: "Invalid sellerId. The referenced seller does not exist.",
        });
      }
      return res.status(500).json({ error: "Database error occurred", details: error.message });
    }

    return res.status(500).json({
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
};

const bulkDeleteProducts = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized : No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden: You cannot access this resource" });
    }

    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ error: "Invalid request format: Expected an array of product IDs." });
    }

    const validProductIds = productIds.every((id) => uuidSchema.safeParse(id).success);

    if (!validProductIds) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const deleteResult = await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });

    return res.status(200).json({
      message: "Products deleted successfully",
      count: deleteResult.count,
    });
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Product not found or already deleted" });
      }
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};

const addReviewsByBuyer = async (req: Request, res: Response) => {
  try {
    const validatedBody = reviewSchema.safeParse(req.body);

    if (!validatedBody.success) {
      return res.status(400).json({
        error: "Invalid product data",
        details: validatedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { productId, rating, review } = validatedBody.data;

    // check buyer id

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    const buyer = await prisma.buyer.findUnique({
      where: { BuyerId: user.id },
    });

    if (!buyer) {
      return res.status(404).json({ error: "Buyer not found" });
    }

    // check product id

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // check if buyer has already reviewed the product

    const existingReview = await prisma.review.findFirst({
      where: { productId, buyerId: buyer.id },
    });

    if (existingReview) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    // add review

    const newReview = await prisma.review.create({
      data: {
        productId,
        buyerId: buyer.id,
        rating,
        review,
        userId: user.id,
        sellerId: product.sellerId,
      },
    });
    console.log("Review added successfully", newReview);

    return res.status(201).json({
      message: "Review added successfully",
      data: newReview,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getReviewsByProductId = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Validate Product ID
    const { productId } = req.params;
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid Product ID format" });
    }

    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: {
        id: true,
        rating: true,
        review: true,
        buyer: {
          select: {
            id: true,
            user: {
              select: {
                name: true, // Include buyer's username
              },
            },
          },
        },
      },
    });

    // Return Reviews
    return res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getReviewsByBuyerId = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Fetch Buyer ID
    const buyerId = user.id;

    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      where: { buyerId },
      select: {
        id: true,
        rating: true,
        review: true,
        productId: true,
        product: {
          select: {
            title: true,
            sellerId: true,
          },
        },
      },
    });

    if (reviews.length === 0) {
      return res.status(200).json({ message: "No reviews found", data: [] });
    }

    // Return Reviews
    return res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteReviewById = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Fetch Review ID
    const { reviewId } = req.params;
    const validReviewId = uuidSchema.safeParse(reviewId);
    if (!validReviewId.success) {
      return res.status(400).json({ error: "Invalid Review ID format" });
    }

    // Fetch Review from Database
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if the review belongs to the user
    if (review.buyerId !== user.id) {
      return res.status(403).json({ error: "Forbidden: You cannot delete this review" });
    }

    // Delete Review
    await prisma.review.delete({
      where: { id: reviewId },
    });

    return res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error deleting review:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateReviewById = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Fetch Review ID
    const { reviewId } = req.params;
    const validReviewId = uuidSchema.safeParse(reviewId);
    if (!validReviewId.success) {
      return res.status(400).json({ error: "Invalid Review ID format" });
    }

    // Fetch Review from Database
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Check if the review belongs to the user
    if (review.buyerId !== user.id) {
      return res.status(403).json({ error: "Forbidden: You cannot update this review" });
    }

    // Validate Request Body
    const validatedBody = reviewSchema.safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({
        error: "Invalid review data",
        details: validatedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    // Update Review
    await prisma.review.update({
      where: { id: reviewId },
      data: validatedBody.data,
    });

    return res.status(200).json({ message: "Review updated successfully" });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error updating review:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllReviews = async (req: Request, res: Response) => {
  try {
    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      select: {
        id: true,
        rating: true,
        review: true,
        buyer: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            title: true,
            sellerId: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: reviews.length ? "Reviews fetched successfully" : "No reviews found",
      data: reviews,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllReviewsByProductId = async (req: Request, res: Response) => {
  try {
    // Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Verify Token
    const token = authHeader.split(" ")[1];
    const user = await verifyTokenAndGetUser(token);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid Token" });
    }

    // Validate Product ID
    const { productId } = req.params;
    const validProductId = uuidSchema.safeParse(productId);
    if (!validProductId.success) {
      return res.status(400).json({ error: "Invalid Product ID format" });
    }

    // Fetch Reviews from Database
    const reviews = await prisma.review.findMany({
      where: { productId },
      select: {
        id: true,
        rating: true,
        review: true,
        buyer: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Return Reviews
    return res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      return res.status(400).json({ error: "Database error", details: error.message });
    }
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

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
  getReviewsByProductId,
  addReviewsByBuyer,
  getReviewsByBuyerId,
  deleteReviewById,
  updateReviewById,
  getAllReviews,
  getAllReviewsByProductId,
};
