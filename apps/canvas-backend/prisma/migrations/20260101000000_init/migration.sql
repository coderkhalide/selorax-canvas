-- CreateTable
CREATE TABLE `ai_analysis_results` (
    `id` VARCHAR(191) NOT NULL,
    `experiment_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `triggered_by` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `recommendation` VARCHAR(191) NULL,
    `winner_variant_id` VARCHAR(191) NULL,
    `confidence_score` DOUBLE NULL,
    `reasoning` TEXT NULL,
    `insights_json` TEXT NULL,
    `next_action_json` TEXT NULL,
    `applied_at` DATETIME(3) NULL,
    `approved_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_analysis_results_experiment_id_idx`(`experiment_id` ASC),
    INDEX `ai_analysis_results_tenant_id_status_idx`(`tenant_id` ASC, `status` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `component_versions` (
    `id` VARCHAR(191) NOT NULL,
    `component_id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `source_code` LONGTEXT NOT NULL,
    `compiled_url` VARCHAR(191) NOT NULL,
    `change_summary` TEXT NULL,
    `ai_prompt` TEXT NULL,
    `is_stable` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `component_versions_component_id_idx`(`component_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `components` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `tags` TEXT NULL,
    `schema_json` TEXT NOT NULL,
    `current_version` VARCHAR(191) NOT NULL DEFAULT '1.0.0',
    `current_url` VARCHAR(191) NULL,
    `origin` VARCHAR(191) NOT NULL DEFAULT 'dev',
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `ai_prompt` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `components_tenant_id_idx`(`tenant_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversion_events` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `experiment_id` VARCHAR(191) NOT NULL,
    `variant_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `visitor_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `element_id` VARCHAR(191) NULL,
    `element_label` VARCHAR(191) NULL,
    `value` DOUBLE NULL,
    `metadata` TEXT NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversion_events_experiment_id_event_type_idx`(`experiment_id` ASC, `event_type` ASC),
    INDEX `conversion_events_experiment_id_idx`(`experiment_id` ASC),
    INDEX `conversion_events_tenant_id_occurred_at_idx`(`tenant_id` ASC, `occurred_at` ASC),
    INDEX `conversion_events_variant_id_idx`(`variant_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiment_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `experiment_id` VARCHAR(191) NOT NULL,
    `variant_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `snapshot_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `visitors` INTEGER NOT NULL DEFAULT 0,
    `page_views` INTEGER NOT NULL DEFAULT 0,
    `cta_clicks` INTEGER NOT NULL DEFAULT 0,
    `checkouts_started` INTEGER NOT NULL DEFAULT 0,
    `purchases` INTEGER NOT NULL DEFAULT 0,
    `revenue` DOUBLE NOT NULL DEFAULT 0,
    `cta_click_rate` DOUBLE NULL,
    `conversion_rate` DOUBLE NULL,
    `revenue_per_visitor` DOUBLE NULL,
    `scroll_25_rate` DOUBLE NULL,
    `scroll_50_rate` DOUBLE NULL,
    `scroll_75_rate` DOUBLE NULL,
    `scroll_100_rate` DOUBLE NULL,
    `period_start` DATETIME(3) NULL,
    `period_end` DATETIME(3) NULL,

    INDEX `experiment_snapshots_experiment_id_idx`(`experiment_id` ASC),
    INDEX `experiment_snapshots_variant_id_idx`(`variant_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiment_variants` (
    `id` VARCHAR(191) NOT NULL,
    `experiment_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `page_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `page_version_id` VARCHAR(191) NOT NULL,
    `traffic_weight` DOUBLE NOT NULL DEFAULT 0.5,
    `is_control` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `ai_generated` BOOLEAN NOT NULL DEFAULT false,
    `ai_change_summary` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `experiment_variants_experiment_id_idx`(`experiment_id` ASC),
    INDEX `experiment_variants_page_version_id_fkey`(`page_version_id` ASC),
    INDEX `experiment_variants_tenant_id_idx`(`tenant_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiments` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `page_id` VARCHAR(191) NOT NULL,
    `funnel_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `hypothesis` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `primary_metric` VARCHAR(191) NOT NULL DEFAULT 'conversion_rate',
    `traffic_mode` VARCHAR(191) NOT NULL DEFAULT 'sticky',
    `min_sample_size` INTEGER NOT NULL DEFAULT 500,
    `analysis_window_days` INTEGER NOT NULL DEFAULT 7,
    `confidence_threshold` DOUBLE NOT NULL DEFAULT 0.95,
    `winner_variant_id` VARCHAR(191) NULL,
    `winner_reason` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `scheduled_end_at` DATETIME(3) NULL,
    `ai_generated` BOOLEAN NOT NULL DEFAULT false,
    `ai_prompt` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `experiments_page_id_idx`(`page_id` ASC),
    INDEX `experiments_tenant_id_idx`(`tenant_id` ASC),
    INDEX `experiments_tenant_id_status_idx`(`tenant_id` ASC, `status` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funnel_steps` (
    `id` VARCHAR(191) NOT NULL,
    `funnel_id` VARCHAR(191) NOT NULL,
    `page_id` VARCHAR(191) NOT NULL,
    `step_order` INTEGER NOT NULL,
    `step_type` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `on_success` TEXT NOT NULL,
    `on_skip` TEXT NULL,

    INDEX `funnel_steps_funnel_id_idx`(`funnel_id` ASC),
    INDEX `funnel_steps_page_id_fkey`(`page_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funnels` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `goal` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `ai_generated` BOOLEAN NOT NULL DEFAULT false,
    `ai_prompt` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `published_at` DATETIME(3) NULL,

    INDEX `funnels_tenant_id_idx`(`tenant_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `page_versions` (
    `id` VARCHAR(191) NOT NULL,
    `page_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `tree` LONGTEXT NOT NULL,
    `tree_hash` VARCHAR(191) NULL,
    `published_by` VARCHAR(191) NULL,
    `published_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `page_versions_page_id_idx`(`page_id` ASC),
    INDEX `page_versions_page_id_tree_hash_idx`(`page_id` ASC, `tree_hash` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pages` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `page_type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `published_version_id` VARCHAR(191) NULL,
    `meta_title` VARCHAR(191) NULL,
    `meta_description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `published_at` DATETIME(3) NULL,

    INDEX `pages_tenant_id_idx`(`tenant_id` ASC),
    UNIQUE INDEX `pages_tenant_id_page_type_slug_key`(`tenant_id` ASC, `page_type` ASC, `slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visitor_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `experiment_id` VARCHAR(191) NOT NULL,
    `variant_id` VARCHAR(191) NOT NULL,
    `visitor_id` VARCHAR(191) NOT NULL,
    `device` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `referrer` VARCHAR(191) NULL,
    `utm_source` VARCHAR(191) NULL,
    `utm_medium` VARCHAR(191) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `landed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `converted_at` DATETIME(3) NULL,
    `conversion_value` DOUBLE NULL,

    INDEX `visitor_sessions_experiment_id_idx`(`experiment_id` ASC),
    INDEX `visitor_sessions_tenant_id_visitor_id_idx`(`tenant_id` ASC, `visitor_id` ASC),
    INDEX `visitor_sessions_variant_id_idx`(`variant_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_analysis_results` ADD CONSTRAINT `ai_analysis_results_experiment_id_fkey` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `component_versions` ADD CONSTRAINT `component_versions_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversion_events` ADD CONSTRAINT `conversion_events_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `experiment_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_snapshots` ADD CONSTRAINT `experiment_snapshots_experiment_id_fkey` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_snapshots` ADD CONSTRAINT `experiment_snapshots_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `experiment_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_variants` ADD CONSTRAINT `experiment_variants_experiment_id_fkey` FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiment_variants` ADD CONSTRAINT `experiment_variants_page_version_id_fkey` FOREIGN KEY (`page_version_id`) REFERENCES `page_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `experiments` ADD CONSTRAINT `experiments_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funnel_steps` ADD CONSTRAINT `funnel_steps_funnel_id_fkey` FOREIGN KEY (`funnel_id`) REFERENCES `funnels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funnel_steps` ADD CONSTRAINT `funnel_steps_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `page_versions` ADD CONSTRAINT `page_versions_page_id_fkey` FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visitor_sessions` ADD CONSTRAINT `visitor_sessions_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `experiment_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

