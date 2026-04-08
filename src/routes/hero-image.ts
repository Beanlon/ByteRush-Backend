import type { Prisma } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { heroImageDb } from "../lib/hero-image-db.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("Unsupported image type") as any, ok);
  },
});

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

const heroSelect = {
  id: true,
  linkUrl: true,
  alt: true,
  sortOrder: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  imageMimeType: true,
  imageFileName: true,
} as const;

function toImageUrl(req: any, id: string): string {
  return `${req.protocol}://${req.get("host")}/hero-images/${encodeURIComponent(id)}/file`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

router.get("/", async (req, res, next) => {
  try {
    const items = await heroImageDb.findMany({
      select: heroSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return res.json(
      items.map((row) => ({
        ...row,
        imageUrl: toImageUrl(req, row.id),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:id/file", async (req, res, next) => {
  try {
    const id = asSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid hero image id" });

    const row = await heroImageDb.findUnique({
      where: { id },
      select: { imageData: true, imageMimeType: true },
    });

    if (!row) return res.status(404).json({ error: "Hero image not found" });

    res.setHeader("Content-Type", row.imageMimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(Buffer.from(row.imageData));
  } catch (err) {
    next(err);
  }
});

router.post("/", upload.single("image"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "image file is required" });

    const altRaw = typeof req.body?.alt === "string" ? req.body.alt : "";
    const alt = altRaw.trim() || null;
    const linkUrlRaw = typeof req.body?.linkUrl === "string" ? req.body.linkUrl : "";
    const linkUrl = linkUrlRaw.trim() || null;

    if (linkUrl && !isValidHttpUrl(linkUrl)) {
      return res.status(400).json({ error: "linkUrl must be a valid URL" });
    }

    const created = await heroImageDb.create({
      data: {
        imageData: file.buffer,
        imageMimeType: file.mimetype,
        imageFileName: file.originalname,
        linkUrl,
        alt,
      },
      select: heroSelect,
    });

    return res.status(201).json({
      ...created,
      imageUrl: toImageUrl(req, created.id),
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = asSingleParam(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid hero image id" });

    const { alt, sortOrder, active, linkUrl } = (req.body ?? {}) as {
      alt?: unknown;
      sortOrder?: unknown;
      active?: unknown;
      linkUrl?: unknown;
    };

    const patch: {
      alt?: string | null;
      sortOrder?: number;
      active?: boolean;
      linkUrl?: string | null;
    } = {};

    if (alt !== undefined) {
      if (alt !== null && typeof alt !== "string") {
        return res.status(400).json({ error: "alt must be a string or null" });
      }
      patch.alt = typeof alt === "string" ? alt.trim() || null : null;
    }
    if (sortOrder !== undefined) {
      if (typeof sortOrder !== "number" || !Number.isFinite(sortOrder)) {
        return res.status(400).json({ error: "sortOrder must be a number" });
      }
      patch.sortOrder = Math.floor(sortOrder);
    }
    if (active !== undefined) {
      if (typeof active !== "boolean") {
        return res.status(400).json({ error: "active must be a boolean" });
      }
      patch.active = active;
    }
    if (linkUrl !== undefined) {
      if (linkUrl !== null && typeof linkUrl !== "string") {
        return res.status(400).json({ error: "linkUrl must be a string or null" });
      }
      const normalized = typeof linkUrl === "string" ? linkUrl.trim() : "";
      if (normalized && !isValidHttpUrl(normalized)) {
        return res.status(400).json({ error: "linkUrl must be a valid URL" });
      }
      patch.linkUrl = normalized || null;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updated = await heroImageDb.update({
      where: { id },
      data: patch,
      select: heroSelect,
    });

    return res.json({
      ...updated,
      imageUrl: toImageUrl(req, updated.id),
    });
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Hero image not found" });
    }
    next(err);
  }
});

export default router;