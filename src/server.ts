import express from "express";
import dotenv from "dotenv";
import router from "./routes/index";

dotenv.config();

const app = express();
const PORT = 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api", router);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
