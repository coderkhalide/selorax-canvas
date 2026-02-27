-- AlterTable
ALTER TABLE `conversion_events` ADD COLUMN `funnel_id` VARCHAR(191) NULL,
    ADD COLUMN `funnel_step_order` INTEGER NULL,
    ADD COLUMN `page_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `conversion_events_tenant_id_page_id_idx` ON `conversion_events`(`tenant_id`, `page_id`);

-- CreateIndex
CREATE INDEX `conversion_events_tenant_id_funnel_id_idx` ON `conversion_events`(`tenant_id`, `funnel_id`);
