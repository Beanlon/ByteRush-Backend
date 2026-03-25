import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

const brandSelect = {
  id: true,
  name: true,
  slug: true
} as const;

router.get("/", async (_req, res, next) => {
  try {
    const brands = await prisma.brand.findMany({
      select: brandSelect,
      orderBy: { name: "asc" }
    });

    return res.json(brands);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const brandId = asSingleParam(req.params.id);
    if (!brandId) {
      return res.status(400).json({ error: "Invalid brand id" });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: brandSelect
    });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    return res.json(brand);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, slug } = req.body as { name?: unknown; slug?: unknown };

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "slug is required" });
    }

    const created = await prisma.brand.create({
      data: {
        name: name.trim(),
        slug: slug.trim()
      },
      select: brandSelect
    });

    return res.status(201).json(created);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Brand slug already exists" });
    }

    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const brandId = asSingleParam(req.params.id);
    if (!brandId) {
      return res.status(400).json({ error: "Invalid brand id" });
    }

    const { name, slug } = req.body as { name?: unknown; slug?: unknown };

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    if (slug !== undefined && (typeof slug !== "string" || !slug.trim())) {
      return res.status(400).json({ error: "slug must be a non-empty string" });
    }

    const updated = await prisma.brand.update({
      where: { id: brandId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(slug !== undefined ? { slug: slug.trim() } : {})
      },
      select: brandSelect
    });

    return res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      return res.status(409).json({ error: "Brand slug already exists" });
    }

    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Brand not found" });
    }

    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const brandId = asSingleParam(req.params.id);
    if (!brandId) {
      return res.status(400).json({ error: "Invalid brand id" });
    }

    await prisma.brand.delete({ where: { id: brandId } });
    return res.status(204).send();
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Brand not found" });
    }

    if (prismaError?.code === "P2003") {
      return res.status(409).json({ error: "Cannot delete brand with existing products" });
    }

    next(err);
  }
});

export default router;
