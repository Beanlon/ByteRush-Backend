import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { normalizeJwtSecret } from "../lib/jwt-secret.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
const JWT_SECRET = normalizeJwtSecret(process.env.JWT_SECRET);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const safeUserSelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  role: true,
} as const;

const loginUserSelect = {
  ...safeUserSelect,
  passwordHash: true,
} as const;

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, displayName } = (req.body ?? {}) as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, displayName, passwordHash },
      select: safeUserSelect
    });

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email }, select: loginUserSelect });
    if (!user?.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice("Bearer ".length);
  let userId: string;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload | string;
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

export const authRoutes = router;
export default router;