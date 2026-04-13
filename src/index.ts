import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./routes/auth.js";
import brandRoutes from "./routes/brand.js";
import categoryRoutes from "./routes/category.js";
import heroImageRoutes from "./routes/hero-image.js";
import itemTypeRoutes from "./routes/item-type.js";
import productRoutes from "./routes/product.js";
import userRoutes from "./routes/user.js";


const app = express();
const PORT = Number(process.env.PORT) || 4000;

const corsOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins?.length ? corsOrigins : true,
  }),
);

app.use(express.json());
// Express 5 can leave `req.body` undefined; destructuring it throws → 500.
app.use((req, _res, next) => {
  if (req.body === undefined) {
    req.body = {};
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/brands", brandRoutes);
app.use("/categories", categoryRoutes);
app.use("/item-types", itemTypeRoutes);
app.use("/hero-images", heroImageRoutes);
app.use("/products", productRoutes);
app.use("/users", userRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const debug =
    process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
  res.status(500).json({
    error: "Internal server error",
    ...(debug && { debug }),
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
