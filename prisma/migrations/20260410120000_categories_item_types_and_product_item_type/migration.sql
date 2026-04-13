/*
  Target schema: Category @@map("category"), ItemType (empty until you add rows), Product @@map("products") + optional item_type_id.

  Expects the legacy state from prior migrations:
  - Table `Category` (id, name, slug, parentId) with FK `Category_parentId_fkey`
  - Table `Product` with FK `Product_categoryId_fkey` -> Category

  Steps:
  1. Reshape `Category` -> rename to `category`.
  2. Create empty `item_types` (no seed — define types via POST /item-types).
  3. Add nullable `Product.item_type_id` + FK, rename `Product` -> `products`.
*/

-- 1) Reshape legacy Category in place, then rename to match @@map("category")
ALTER TABLE `Category` DROP FOREIGN KEY `Category_parentId_fkey`;

ALTER TABLE `Category` DROP COLUMN `parentId`;

ALTER TABLE `Category`
ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0,
ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

RENAME TABLE `Category` TO `category`;

-- 2) item_types (empty; FK -> category)
CREATE TABLE `item_types` (
    `id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `item_types_category_id_slug_key`(`category_id`, `slug`),
    INDEX `item_types_category_id_idx`(`category_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `item_types_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) Optional item_type_id on Product, then rename to products
ALTER TABLE `Product` ADD COLUMN `item_type_id` VARCHAR(191) NULL;

ALTER TABLE `Product`
ADD CONSTRAINT `Product_item_type_id_fkey` FOREIGN KEY (`item_type_id`) REFERENCES `item_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

RENAME TABLE `Product` TO `products`;
