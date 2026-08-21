-- AlterTable
ALTER TABLE `customer_payments` MODIFY `amount` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `customers` MODIFY `totalSpent` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `creditBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `creditLimit` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `grn_items` MODIFY `costPrice` DECIMAL(12, 2) NOT NULL,
    MODIFY `sellingPrice` DECIMAL(12, 2) NULL,
    MODIFY `totalCost` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `grn_payments` MODIFY `amount` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `grns` MODIFY `subtotal` DECIMAL(12, 2) NOT NULL,
    MODIFY `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `totalAmount` DECIMAL(12, 2) NOT NULL,
    MODIFY `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `invoice_item_history` MODIFY `unitPrice` DECIMAL(12, 2) NOT NULL,
    MODIFY `amountChange` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `invoice_items` MODIFY `unitPrice` DECIMAL(12, 2) NOT NULL,
    MODIFY `originalPrice` DECIMAL(12, 2) NULL,
    MODIFY `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `total` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `invoice_payments` MODIFY `amount` DECIMAL(12, 2) NOT NULL;

-- AlterTable
ALTER TABLE `invoices` MODIFY `subtotal` DECIMAL(12, 2) NOT NULL,
    MODIFY `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `total` DECIMAL(12, 2) NOT NULL,
    MODIFY `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `dueAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `price_history` MODIFY `previousCostPrice` DECIMAL(12, 2) NULL,
    MODIFY `newCostPrice` DECIMAL(12, 2) NULL,
    MODIFY `previousSellingPrice` DECIMAL(12, 2) NULL,
    MODIFY `newSellingPrice` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `products` MODIFY `price` DECIMAL(12, 2) NOT NULL,
    MODIFY `costPrice` DECIMAL(12, 2) NULL,
    MODIFY `lastCostPrice` DECIMAL(12, 2) NULL,
    MODIFY `profitMargin` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `shops` MODIFY `logo` LONGTEXT NULL,
    MODIFY `taxRate` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `stock_movements` MODIFY `unitPrice` DECIMAL(12, 2) NULL;

-- CreateTable
CREATE TABLE `quotations` (
    `id` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discountTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `terms` TEXT NULL,
    `validityDate` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `quotations_shopId_idx`(`shopId`),
    INDEX `quotations_customerId_idx`(`customerId`),
    INDEX `quotations_status_idx`(`status`),
    UNIQUE INDEX `quotations_shopId_quotationNumber_key`(`shopId`, `quotationNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `id` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `itemType` ENUM('PRODUCT', 'SERVICE') NOT NULL DEFAULT 'PRODUCT',
    `productId` VARCHAR(191) NULL,
    `serviceId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quotation_items_quotationId_idx`(`quotationId`),
    INDEX `quotation_items_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `quotations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
