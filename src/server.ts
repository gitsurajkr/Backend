import express from "express";
import dotenv from "dotenv";
import router from "./routes/index";
import { PrismaClient } from "@prisma/client";
// import userRouter from "./routes/user.routes";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use("/api/user", userRouter);

async function testDB() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully!");
  } catch (error) {
    console.error("Database connection failed:", error);
  }
}
testDB();

// routes
app.use("/api", router);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
