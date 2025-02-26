import dotenv from "dotenv";
dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables");
}
const JWT_KEY = process.env.JWT_SECRET as string;
export default JWT_KEY;
