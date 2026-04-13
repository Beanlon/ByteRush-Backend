import type { Prisma } from "@prisma/client";
import { ProductStatus } from "@prisma/client";
import { Router } from "express";
import { prisma, prismaItemType } from "../lib/prisma.js";

const router = Router();

function asSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asOptionalNonNegativeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function asOptionalNonNegativeInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

function asOptionalStatus(value: unknown): ProductStatus | undefined {
  if (value === undefined) return undefined;
  return value === ProductStatus.DRAFT || value === ProductStatus.ACTIVE ? value : undefined;
}

function asOptionalJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return undefined;
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/** Optional SKU on create: omit if missing/empty; invalid type → undefined for caller to reject. */
function asOptionalSkuForCreate(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t === "" ? undefined : t;
}

/** Patch SKU: undefined = no change; null or "" = clear; string = set trimmed (null if empty). */
function asPatchSku(value: unknown): "omit" | "clear" | string | "invalid" {
  if (value === undefined) return "omit";
  if (value === null || value === "") return "clear";
  if (typeof value !== "string") return "invalid";
  const t = value.trim();
  return t === "" ? "clear" : t;
}

function uniqueViolationField(err: Prisma.PrismaClientKnownRequestError): string | undefined {
  const target = err.meta?.target;
  return Array.isArray(target) && typeof target[0] === "string" ? target[0] : undefined;
}

/** PATCH itemTypeId: undefined = omit; null / "" = clear; string = set trimmed. */
function asPatchItemTypeId(value: unknown): "omit" | "clear" | string | "invalid" {
  if (value === undefined) return "omit";
  if (value === null || value === "") return "clear";
  if (typeof value !== "string") return "invalid";
  const t = value.trim();
  return t === "" ? "clear" : t;
}

async function assertItemTypeMatchesCategory(
  categoryId: string,
  itemTypeId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (itemTypeId === null) {
    return { ok: true };
  }
  const itemType = await prismaItemType.findUnique({
    where: { id: itemTypeId },
    select: { categoryId: true },
  });
  if (!itemType) {
    return { ok: false, error: "Invalid itemTypeId" };
  }
  if (itemType.categoryId !== categoryId) {
    return { ok: false, error: "itemTypeId does not belong to this categoryId" };
  }
  return { ok: true };
}

const productSelect = {
  id: true,
  categoryId: true,
  brandId: true,
  itemTypeId: true,
  sku: true,
  lowStockAlert: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  stockQty: true,
  specs: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true
    }
  },
  itemType: {
    select: {
      id: true,
      slug: true,
      name: true,
      categoryId: true
    }
  }
} as const;

router.get("/", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      select: productSelect,
      orderBy: { createdAt: "desc" }
    });

    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const productId = asSingleParam(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: productSelect
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(product);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { categoryId, brandId, itemTypeId, sku, lowStockAlert, name, slug, description, price, stockQty, specs, status } =
      req.body as {
        categoryId?: unknown;
        brandId?: unknown;
        itemTypeId?: unknown;
        sku?: unknown;
        lowStockAlert?: unknown;
        name?: unknown;
        slug?: unknown;
        description?: unknown;
        price?: unknown;
        stockQty?: unknown;
        specs?: unknown;
        status?: unknown;
      };

    if (typeof categoryId !== "string" || !categoryId.trim()) {
      return res.status(400).json({ error: "categoryId is required" });
    }

    if (typeof brandId !== "string" || !brandId.trim()) {
      return res.status(400).json({ error: "brandId is required" });
    }

    const catTrim = categoryId.trim();
    let resolvedItemTypeId: string | null | undefined;
    if (itemTypeId === undefined || itemTypeId === null || itemTypeId === "") {
      resolvedItemTypeId = undefined;
    } else if (typeof itemTypeId !== "string") {
      return res.status(400).json({ error: "itemTypeId must be a string, null, or omitted" });
    } else {
      const t = itemTypeId.trim();
      resolvedItemTypeId = t === "" ? undefined : t;
    }

    if (resolvedItemTypeId !== undefined) {
      const match = await assertItemTypeMatchesCategory(catTrim, resolvedItemTypeId);
      if (!match.ok) {
        return res.status(400).json({ error: match.error });
      }
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    if (typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "slug is required" });
    }

    const parsedPrice = asOptionalNonNegativeNumber(price);
    if (price !== undefined && parsedPrice === undefined) {
      return res.status(400).json({ error: "price must be a non-negative number" });
    }

    const parsedStockQty = asOptionalNonNegativeInt(stockQty);
    if (stockQty !== undefined && parsedStockQty === undefined) {
      return res.status(400).json({ error: "stockQty must be a non-negative integer" });
    }

    const parsedStatus = asOptionalStatus(status);
    if (status !== undefined && parsedStatus === undefined) {
      return res.status(400).json({ error: "status must be DRAFT or ACTIVE" });
    }

    const parsedSpecs = asOptionalJsonValue(specs);
    if (specs !== undefined && parsedSpecs === undefined) {
      return res.status(400).json({ error: "specs must be valid JSON" });
    }

    const parsedSku = asOptionalSkuForCreate(sku);
    if (parsedSku === null) {
      return res.status(400).json({ error: "sku must be a string" });
    }

    const parsedLowStockAlert = asOptionalNonNegativeInt(lowStockAlert);
    if (lowStockAlert !== undefined && parsedLowStockAlert === undefined) {
      return res.status(400).json({ error: "lowStockAlert must be a non-negative integer" });
    }

    const createData: Prisma.ProductUncheckedCreateInput = {
      categoryId: catTrim,
      brandId: brandId.trim(),
      name: name.trim(),
      slug: slug.trim(),
      ...(resolvedItemTypeId !== undefined ? { itemTypeId: resolvedItemTypeId } : {}),
      ...(parsedSku !== undefined ? { sku: parsedSku } : {}),
      ...(parsedLowStockAlert !== undefined ? { lowStockAlert: parsedLowStockAlert } : {}),
      ...(asOptionalString(description) !== undefined ? { description: asOptionalString(description) } : {}),
      ...(parsedPrice !== undefined ? { price: parsedPrice } : {}),
      ...(parsedStockQty !== undefined ? { stockQty: parsedStockQty } : {}),
      ...(parsedSpecs !== undefined ? { specs: parsedSpecs } : {}),
      ...(parsedStatus !== undefined ? { status: parsedStatus } : {})
    };

    const created = await prisma.product.create({
      data: createData,
      select: productSelect
    });

    return res.status(201).json(created);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      const field = uniqueViolationField(prismaError);
      if (field === "sku") {
        return res.status(409).json({ error: "Product SKU already exists" });
      }
      return res.status(409).json({ error: "Product slug already exists" });
    }

    if (prismaError?.code === "P2003") {
      return res.status(400).json({ error: "Invalid categoryId, brandId, or itemTypeId" });
    }

    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const productId = asSingleParam(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const { categoryId, brandId, itemTypeId, sku, lowStockAlert, name, slug, description, price, stockQty, specs, status } =
      req.body as {
        categoryId?: unknown;
        brandId?: unknown;
        itemTypeId?: unknown;
        sku?: unknown;
        lowStockAlert?: unknown;
        name?: unknown;
        slug?: unknown;
        description?: unknown;
        price?: unknown;
        stockQty?: unknown;
        specs?: unknown;
        status?: unknown;
      };

    if (categoryId !== undefined && (typeof categoryId !== "string" || !categoryId.trim())) {
      return res.status(400).json({ error: "categoryId must be a non-empty string" });
    }

    if (brandId !== undefined && (typeof brandId !== "string" || !brandId.trim())) {
      return res.status(400).json({ error: "brandId must be a non-empty string" });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    if (slug !== undefined && (typeof slug !== "string" || !slug.trim())) {
      return res.status(400).json({ error: "slug must be a non-empty string" });
    }

    if (description !== undefined && description !== null && typeof description !== "string") {
      return res.status(400).json({ error: "description must be a string or null" });
    }

    const parsedPrice = asOptionalNonNegativeNumber(price);
    if (price !== undefined && parsedPrice === undefined) {
      return res.status(400).json({ error: "price must be a non-negative number" });
    }

    const parsedStockQty = asOptionalNonNegativeInt(stockQty);
    if (stockQty !== undefined && parsedStockQty === undefined) {
      return res.status(400).json({ error: "stockQty must be a non-negative integer" });
    }

    const parsedStatus = asOptionalStatus(status);
    if (status !== undefined && parsedStatus === undefined) {
      return res.status(400).json({ error: "status must be DRAFT or ACTIVE" });
    }

    const parsedSpecs = asOptionalJsonValue(specs);
    if (specs !== undefined && parsedSpecs === undefined) {
      return res.status(400).json({ error: "specs must be valid JSON" });
    }

    const patchSkuResult = asPatchSku(sku);
    if (patchSkuResult === "invalid") {
      return res.status(400).json({ error: "sku must be a string, null, or empty string to clear" });
    }

    const patchItemTypeResult = asPatchItemTypeId(itemTypeId);
    if (patchItemTypeResult === "invalid") {
      return res.status(400).json({ error: "itemTypeId must be a string, null, or empty string to clear" });
    }

    const existingRow = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, itemTypeId: true } as unknown as Prisma.ProductSelect,
    });
    const existing = existingRow as unknown as
      | { categoryId: string; itemTypeId: string | null }
      | null;
    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    const nextCategory = categoryId !== undefined ? categoryId.trim() : existing.categoryId;
    const nextItemTypeId: string | null =
      patchItemTypeResult === "omit"
        ? (existing.itemTypeId ?? null)
        : patchItemTypeResult === "clear"
          ? null
          : patchItemTypeResult;

    const typeCheck = await assertItemTypeMatchesCategory(nextCategory, nextItemTypeId);
    if (!typeCheck.ok) {
      return res.status(400).json({ error: typeCheck.error });
    }

    const parsedLowStockAlertPatch = asOptionalNonNegativeInt(lowStockAlert);
    if (lowStockAlert !== undefined && parsedLowStockAlertPatch === undefined) {
      return res.status(400).json({ error: "lowStockAlert must be a non-negative integer" });
    }

    const skuUpdate: { sku?: string | null } =
      patchSkuResult === "omit"
        ? {}
        : patchSkuResult === "clear"
          ? { sku: null }
          : { sku: patchSkuResult };

    const itemTypeUpdate: { itemTypeId?: string | null } =
      patchItemTypeResult === "omit" ? {} : { itemTypeId: nextItemTypeId };

    const updateData: Prisma.ProductUncheckedUpdateInput = {
      ...(categoryId !== undefined ? { categoryId: categoryId.trim() } : {}),
      ...(brandId !== undefined ? { brandId: brandId.trim() } : {}),
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(slug !== undefined ? { slug: slug.trim() } : {}),
      ...(description !== undefined ? { description: description ?? "" } : {}),
      ...(price !== undefined ? { price: parsedPrice } : {}),
      ...(stockQty !== undefined ? { stockQty: parsedStockQty } : {}),
      ...(specs !== undefined ? { specs: parsedSpecs } : {}),
      ...(status !== undefined ? { status: parsedStatus } : {}),
      ...skuUpdate,
      ...itemTypeUpdate,
      ...(parsedLowStockAlertPatch !== undefined ? { lowStockAlert: parsedLowStockAlertPatch } : {})
    };

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: productSelect
    });

    return res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2002") {
      const field = uniqueViolationField(prismaError);
      if (field === "sku") {
        return res.status(409).json({ error: "Product SKU already exists" });
      }
      return res.status(409).json({ error: "Product slug already exists" });
    }

    if (prismaError?.code === "P2003") {
      return res.status(400).json({ error: "Invalid categoryId, brandId, or itemTypeId" });
    }

    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }

    next(err);
  }
});

router.patch("/:id/stock", async (req, res, next) => {
  try {
    const productId = asSingleParam(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const { stockQty } = req.body as { stockQty?: unknown };
    const parsedStockQty = asOptionalNonNegativeInt(stockQty);

    if (parsedStockQty === undefined) {
      return res.status(400).json({ error: "stockQty must be a non-negative integer" });
    }

    const updateData: Prisma.ProductUncheckedUpdateInput = {};
    (updateData as Record<string, unknown>).stockQty = parsedStockQty;

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: productSelect
    });

    return res.json(updated);
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const productId = asSingleParam(req.params.id);
    if (!productId) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    await prisma.product.delete({ where: { id: productId } });
    return res.status(204).send();
  } catch (err: unknown) {
    const prismaError = err as Prisma.PrismaClientKnownRequestError;
    if (prismaError?.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    next(err);
  }
});

export default router;
