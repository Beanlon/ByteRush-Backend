/*
  Warnings:

  - Added the required column `imageData` to the `HeroImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `HeroImage` ADD COLUMN `imageData` LONGBLOB NOT NULL;
