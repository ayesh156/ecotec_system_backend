-- CreateTable
CREATE TABLE `estimates` (
    `id` VARCHAR(191) NOT NULL,
    `estimateNumber` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discountTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `terms` TEXT NULL,
    `internalNotes` TEXT NULL,
    `validityDate` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `estimates_shopId_idx`(`shopId`),
    INDEX `estimates_customerId_idx`(`customerId`),
    INDEX `estimates_status_idx`(`status`),
    UNIQUE INDEX `estimates_shopId_estimateNumber_key`(`shopId`, `estimateNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `estimate_items` (
    `id` VARCHAR(191) NOT NULL,
    `estimateId` VARCHAR(191) NOT NULL,
    `itemType` ENUM('PRODUCT', 'SERVICE') NOT NULL DEFAULT 'PRODUCT',
    `productId` VARCHAR(191) NULL,
    `serviceId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `estimate_items_estimateId_idx`(`estimateId`),
    INDEX `estimate_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimate_items` ADD CONSTRAINT `estimate_items_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `estimates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `estimate_items` ADD CONSTRAINT `estimate_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
