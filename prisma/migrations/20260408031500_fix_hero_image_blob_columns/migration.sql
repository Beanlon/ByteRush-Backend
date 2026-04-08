-- Align HeroImage table with blob-based schema used by API routes.
ALTER TABLE `HeroImage`
  ADD COLUMN `imageMimeType` VARCHAR(191) NULL,
  ADD COLUMN `imageFileName` VARCHAR(191) NULL;

-- Backfill legacy rows so NOT NULL can be enforced.
UPDATE `HeroImage`
SET
  `imageMimeType` = COALESCE(`imageMimeType`, 'application/octet-stream'),
  `active` = false
WHERE `imageMimeType` IS NULL;

ALTER TABLE `HeroImage`
  MODIFY `imageMimeType` VARCHAR(191) NOT NULL;

ALTER TABLE `HeroImage`
  DROP COLUMN `imageUrl`;
