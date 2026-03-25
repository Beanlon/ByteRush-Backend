import type { Prisma } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true
} as const;

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload | string;
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }
    req.authUserId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireSameUser: RequestHandler = (req, res, next) => {
  const userId = asSingleParam(req.params.id);
  if (!userId || !req.authUserId || req.authUserId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: safeUserSelect
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.get("/:id", requireAuth, requireSameUser, async (req, res, next) => {
  try {
    const userId = asSingleParam(req.params.id);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { email, displayName } = req.body as { email?: unknown; displayName?: unknown };

    if (!isEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (displayName !== undefined && typeof displayName !== "string") {
      return res.status(400).json({ error: "displayName must be a string" });
    }

    const created = await prisma.user.create({
      data: { email, displayName },
      select: safeUserSelect
    });

    res.status(201).json(created);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Email already in use" });
    }
    next(err);
  }
});

router.patch("/:id", requireAuth, requireSameUser, async (req, res, next) => {
  try {
    const userId = asSingleParam(req.params.id);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const { email, displayName } = req.body as { email?: unknown; displayName?: unknown };

    if (email !== undefined && !isEmail(email)) {
      return res.status(400).json({ error: "email must be valid" });
    }

    if (displayName !== undefined && typeof displayName !== "string") {
      return res.status(400).json({ error: "displayName must be a string" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(email !== undefined ? { email } : {}),
        ...(displayName !== undefined ? { displayName } : {})
      },
      select: safeUserSelect
    });

    res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Email already in use" });
    }
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    next(err);
  }
});

export default router;