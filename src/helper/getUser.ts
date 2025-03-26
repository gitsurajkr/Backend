import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const JWT_KEY = process.env.JWT_SECRET as string;
const prisma = new PrismaClient();

const verifyTokenAndGetUser = async (token: string) => {
  try {
    if (!token) throw new Error("Unauthorized: No token provided");

    const decodedToken = jwt.verify(token, JWT_KEY) as JwtPayload;
    if (!decodedToken.email) throw new Error("Invalid token");

    const user = await prisma.user.findUnique({ where: { email: decodedToken.email } });
    if (!user) throw new Error("User not found");

    return user;
  } catch (error) {
    throw new Error((error as Error).message);
  }
};

export default verifyTokenAndGetUser;
