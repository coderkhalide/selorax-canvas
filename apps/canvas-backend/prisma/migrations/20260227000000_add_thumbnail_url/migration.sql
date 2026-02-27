-- AlterTable
ALTER TABLE `pages` ADD COLUMN `thumbnail_updated_at` DATETIME(3) NULL,
    ADD COLUMN `thumbnail_url` VARCHAR(191) NULL;
