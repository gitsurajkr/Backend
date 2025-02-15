import express from "express";
import dotenv from "dotenv";
import router from "./routes/index";
import userRouter from "./routes/user.routes";

dotenv.config();

const app = express();
const PORT = 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/user", userRouter);

// routes
app.use("/api", router);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
