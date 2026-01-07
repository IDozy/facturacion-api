import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ origin, credentials: true }));

app.get("/health", (_, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
