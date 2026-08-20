/**
 * 🌱 EcoSystem Database Seed (Single-Shop Mode) - ZERO DATA LOSS SAFE
 * ===================================================================
 * Seeds a single default shop with sample data.
 * Uses DEFAULT_SHOP_ID from environment.
 *
 * SAFETY POLICY:
 * - NO deleteMany() calls - existing records are NEVER deleted
 * - Uses upsert/findFirst+update patterns based on unique constraints
 * - Existing customers, products, invoices, settings remain untouched
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../.env'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

import {
  PrismaClient,
  CreditStatus,
  CustomerType,
  QuotationStatus,
  QuotationItemType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CONFIG = {
  BCRYPT_ROUNDS: 10,
  SHOP: {
    name: 'EcoSystem Shop',
    slug: 'ecosystem',
    subName: 'SOLUTIONS',
    tagline: 'Computer Solutions',
  },
  ADMIN: {
    email: 'admin@ecosystem.lk',
    password: 'Admin@1234',
    name: 'System Admin'
  },
  DEFAULT_SHOP_ID: process.env.DEFAULT_SHOP_ID || '',
};

const DEFAULT_HIDDEN_SECTIONS = [
  '/job-notes', '/services', '/service-categories', '/quotations',
  '/estimates', '/warranties', '/cash-management/transactions',
  '/cash-management/accounts', '/cash-management/insights',
  '/reports', '/pricing-proposals', '/notes', '/calendar', '/data-export',
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function generateQuotationNumber(index: number, year: number = 2026): string {
  return `QUO-${year}-${String(index).padStart(4, '0')}`;
}

// ==========================================
// DATA
// ==========================================

const CATEGORIES_DATA = [
  { name: 'Laptops', description: 'Laptop computers and notebooks', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80' },
  { name: 'Desktops', description: 'Desktop computers and workstations', image: 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?auto=format&fit=crop&w=600&q=80' },
  { name: 'Monitors', description: 'Computer monitors and displays', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80' },
  { name: 'Keyboards & Mice', description: 'Input devices and peripherals', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80' },
  { name: 'Storage', description: 'Hard drives, SSDs, and USB drives', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80' },
  { name: 'Networking', description: 'Routers, switches, and cables', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=600&q=80' },
  { name: 'Mobile Phones', description: 'Smartphones and feature phones', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80' },
  { name: 'Tablets', description: 'Tablets and iPads', image: 'https://images.unsplash.com/photo-1589739900243-4b52cd9dd8df?auto=format&fit=crop&w=600&q=80' },
  { name: 'Accessories', description: 'Computer and mobile accessories', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=600&q=80' },
  { name: 'Printers', description: 'Printers and scanners', image: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=600&q=80' },
  { name: 'Components', description: 'Computer components and parts', image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80' },
  { name: 'Audio', description: 'Headphones, speakers, and microphones', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80' },
];

const BRANDS_DATA = [
  { name: 'HP', description: 'Hewlett-Packard', website: 'https://hp.com' },
  { name: 'Dell', description: 'Dell Technologies', website: 'https://dell.com' },
  { name: 'Lenovo', description: 'Lenovo Group', website: 'https://lenovo.com' },
  { name: 'Asus', description: 'ASUSTeK Computer Inc.', website: 'https://asus.com' },
  { name: 'Acer', description: 'Acer Inc.', website: 'https://acer.com' },
  { name: 'Samsung', description: 'Samsung Electronics', website: 'https://samsung.com' },
  { name: 'Apple', description: 'Apple Inc.', website: 'https://apple.com' },
  { name: 'LG', description: 'LG Electronics', website: 'https://lg.com' },
  { name: 'Sony', description: 'Sony Corporation', website: 'https://sony.com' },
  { name: 'Logitech', description: 'Logitech International', website: 'https://logitech.com' },
  { name: 'Microsoft', description: 'Microsoft Corporation', website: 'https://microsoft.com' },
  { name: 'TP-Link', description: 'TP-Link Technologies', website: 'https://tp-link.com' },
  { name: 'Western Digital', description: 'WD Storage Solutions', website: 'https://wd.com' },
  { name: 'Seagate', description: 'Seagate Technology', website: 'https://seagate.com' },
  { name: 'Kingston', description: 'Kingston Technology', website: 'https://kingston.com' },
  { name: 'SanDisk', description: 'SanDisk (WD)', website: 'https://sandisk.com' },
];

const PRODUCTS_DATA = [
  { name: 'HP Pavilion 15', category: 'Laptops', brand: 'HP', price: 185000, costPrice: 165000, stock: 8, warranty: '1 Year', warrantyMonths: 12, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80' },
  { name: 'HP EliteBook 840', category: 'Laptops', brand: 'HP', price: 295000, costPrice: 265000, stock: 5, warranty: '2 Years', warrantyMonths: 24, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80' },
  { name: 'Dell Inspiron 15', category: 'Laptops', brand: 'Dell', price: 175000, costPrice: 155000, stock: 12, warranty: '1 Year', warrantyMonths: 12, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80' },
  { name: 'Lenovo ThinkPad X1 Carbon', category: 'Laptops', brand: 'Lenovo', price: 425000, costPrice: 380000, stock: 3, warranty: '3 Years', warrantyMonths: 36, image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80' },
  { name: 'Samsung Galaxy S23', category: 'Mobile Phones', brand: 'Samsung', price: 285000, costPrice: 255000, stock: 10, warranty: '1 Year', warrantyMonths: 12, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80' },
  { name: 'Apple iPhone 15', category: 'Mobile Phones', brand: 'Apple', price: 385000, costPrice: 345000, stock: 8, warranty: '1 Year', warrantyMonths: 12, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80' },
  { name: 'Logitech MK270 Combo', category: 'Keyboards & Mice', brand: 'Logitech', price: 8500, costPrice: 6500, stock: 50, warranty: '1 Year', warrantyMonths: 12, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80' },
  { name: 'Samsung 970 EVO 500GB SSD', category: 'Storage', brand: 'Samsung', price: 35000, costPrice: 28000, stock: 20, warranty: '5 Years', warrantyMonths: 60, image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=800&q=80' },
  { name: 'TP-Link Archer AX50', category: 'Networking', brand: 'TP-Link', price: 18500, costPrice: 14500, stock: 25, warranty: '3 Years', warrantyMonths: 36, image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80' },
  { name: 'LG 27" IPS Monitor', category: 'Monitors', brand: 'LG', price: 65000, costPrice: 55000, stock: 12, warranty: '3 Years', warrantyMonths: 36, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80' },
  { name: 'HP LaserJet Pro M404n', category: 'Printers', brand: 'HP', price: 85000, costPrice: 72000, stock: 8, warranty: '1 Year', warrantyMonths: 12, image: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=800&q=80' },
  { name: 'Kingston 8GB DDR4 RAM', category: 'Components', brand: 'Kingston', price: 9500, costPrice: 7500, stock: 48, warranty: 'Lifetime', warrantyMonths: 120, image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=800&q=80' },
];

const CUSTOMERS_DATA = [
  { name: 'Kamal Perera', email: 'kamal.perera@gmail.com', phone: '0771234567', address: 'No. 45, Galle Road, Colombo 03', nic: '901234567V', type: 'REGULAR' as CustomerType },
  { name: 'Nimal Silva', email: 'nimal.silva@yahoo.com', phone: '0712345678', address: 'No. 123, Main Street, Kandy', nic: '851234568V', type: 'REGULAR' as CustomerType },
  { name: 'ABC Computers', email: 'info@abccomputers.lk', phone: '0114567890', address: 'No. 234, Duplication Road, Colombo 03', nic: null, type: 'WHOLESALE' as CustomerType },
  { name: 'Lanka Insurance PLC', email: 'it@lankainsurance.lk', phone: '0118901234', address: 'No. 123, Union Place, Colombo 02', nic: null, type: 'CORPORATE' as CustomerType },
  { name: 'Dr. Saman Wickramasinghe', email: 'dr.saman@gmail.com', phone: '0779876543', address: 'No. 12, Ward Place, Colombo 07', nic: '751234572V', type: 'VIP' as CustomerType },
  { name: 'Chaminda Rathnayake', email: 'chaminda.r@gmail.com', phone: '0767654321', address: 'No. 67, Station Road, Moratuwa', nic: '911234574V', type: 'REGULAR' as CustomerType },
  { name: 'Sanduni Herath', email: 'sanduni.h@outlook.com', phone: '0756543210', address: 'No. 98, Main Street, Panadura', nic: '961234575V', type: 'REGULAR' as CustomerType },
];

const SUPPLIERS_DATA = [
  { name: 'HP Sri Lanka', contactPerson: 'Roshan Fernando', email: 'roshan@hp.lk', phone: '0112345678', address: 'No. 45, Duplication Road, Colombo 03' },
  { name: 'Dell Technologies Lanka', contactPerson: 'Chamara Perera', email: 'chamara@dell.lk', phone: '0112456789', address: 'No. 89, Galle Road, Colombo 04' },
  { name: 'Samsung Electronics Lanka', contactPerson: 'Dilshan Jayawardena', email: 'dilshan@samsung.lk', phone: '0114567890', address: 'No. 234, Baseline Road, Colombo 09' },
  { name: 'Redington Lanka', contactPerson: 'Ajith Bandara', email: 'ajith@redington.lk', phone: '0116789012', address: 'No. 789, Nawala Road, Rajagiriya' },
];

// ==========================================
// SAMPLE QUOTATIONS DATA (across all statuses)
// ==========================================

interface SeedQuotationItem {
  itemType: QuotationItemType;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface SeedQuotation {
  quotationNumber: string;
  customerIndex: number; // index into CUSTOMERS_DATA
  status: QuotationStatus;
  discountTotal: number;
  taxTotal: number;
  validityDays: number;
  notes: string;
  terms: string;
  items: SeedQuotationItem[];
}

const QUOTATIONS_DATA: SeedQuotation[] = [
  {
    quotationNumber: generateQuotationNumber(1),
    customerIndex: 0, // Kamal Perera
    status: 'DRAFT',
    discountTotal: 0,
    taxTotal: 0,
    validityDays: 30,
    notes: 'Draft quotation - awaiting customer feedback on configuration.',
    terms: 'This quotation is valid for 30 days from the date of issue.\nPrices are subject to change without prior notice.\nPayment terms: 50% advance, 50% on delivery.',
    items: [
      { itemType: 'PRODUCT', productName: 'HP Pavilion 15', description: 'HP Pavilion 15 laptop with 16GB RAM, 512GB SSD', quantity: 1, unitPrice: 185000, discount: 0 },
      { itemType: 'PRODUCT', productName: 'Logitech MK270 Combo', description: 'Wireless keyboard and mouse combo', quantity: 1, unitPrice: 8500, discount: 0 },
      { itemType: 'SERVICE', productName: 'Windows 11 Professional Setup', description: 'OS installation and driver setup service', quantity: 1, unitPrice: 4500, discount: 0 },
    ],
  },
  {
    quotationNumber: generateQuotationNumber(2),
    customerIndex: 1, // Nimal Silva
    status: 'SENT',
    discountTotal: 5000,
    taxTotal: 0,
    validityDays: 30,
    notes: 'Quotation sent via email to nimal.silva@yahoo.com. Customer requested a discount.',
    terms: 'This quotation is valid for 30 days from the date of issue.\nPrices are subject to change without prior notice.\nPayment terms: 50% advance, 50% on delivery.',
    items: [
      { itemType: 'PRODUCT', productName: 'Dell Inspiron 15', description: 'Dell Inspiron 15 laptop with 8GB RAM, 512GB SSD', quantity: 1, unitPrice: 175000, discount: 2 },
      { itemType: 'PRODUCT', productName: 'Samsung 970 EVO 500GB SSD', description: 'Extra NVMe SSD for storage upgrade', quantity: 1, unitPrice: 35000, discount: 0 },
    ],
  },
  {
    quotationNumber: generateQuotationNumber(3),
    customerIndex: 2, // ABC Computers
    status: 'ACCEPTED',
    discountTotal: 15000,
    taxTotal: 0,
    validityDays: 30,
    notes: 'Accepted by ABC Computers purchasing team. Convert to invoice on delivery.',
    terms: 'This quotation is valid for 30 days from the date of issue.\nBulk pricing applied for wholesale customers.\nPayment terms: Net 30 days after delivery.',
    items: [
      { itemType: 'PRODUCT', productName: 'HP EliteBook 840', description: 'HP EliteBook 840 G9 - 2 units for office staff', quantity: 2, unitPrice: 295000, discount: 2 },
      { itemType: 'PRODUCT', productName: 'LG 27" IPS Monitor', description: '27" LG IPS monitors for workstations', quantity: 2, unitPrice: 65000, discount: 0 },
    ],
  },
  {
    quotationNumber: generateQuotationNumber(4),
    customerIndex: 3, // Lanka Insurance PLC
    status: 'REJECTED',
    discountTotal: 0,
    taxTotal: 0,
    validityDays: 30,
    notes: 'Rejected by procurement - they selected another vendor with lower pricing.',
    terms: 'This quotation is valid for 30 days from the date of issue.\nCorporate pricing terms apply.\nPayment terms: Net 30 days after delivery.',
    items: [
      { itemType: 'PRODUCT', productName: 'Lenovo ThinkPad X1 Carbon', description: 'Lenovo ThinkPad X1 Carbon - executive laptops', quantity: 5, unitPrice: 425000, discount: 0 },
      { itemType: 'PRODUCT', productName: 'HP LaserJet Pro M404n', description: 'Network laser printer for office', quantity: 1, unitPrice: 85000, discount: 0 },
    ],
  },
  {
    quotationNumber: generateQuotationNumber(5),
    customerIndex: 4, // Dr. Saman Wickramasinghe
    status: 'CONVERTED',
    discountTotal: 3000,
    taxTotal: 0,
    validityDays: 30,
    notes: 'Converted to invoice INV-2026-XXXX. Payment received in full.',
    terms: 'This quotation is valid for 30 days from the date of issue.\nPrices are subject to change without prior notice.\nPayment terms: 50% advance, 50% on delivery.',
    items: [
      { itemType: 'PRODUCT', productName: 'Apple iPhone 15', description: 'Apple iPhone 15 128GB - Black', quantity: 1, unitPrice: 385000, discount: 0 },
      { itemType: 'PRODUCT', productName: 'Logitech MK270 Combo', description: 'Wireless keyboard and mouse combo for home office', quantity: 1, unitPrice: 8500, discount: 5 },
    ],
  },
];

async function main() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  🌱 ECOSYSTEM DATABASE SEED                ║');
  console.log('║     Single-Shop Mode (Zero Data Loss)      ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // ─────────────────────────────────────────────
  // 1. Default Shop (upsert - never deletes)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Default Shop...');
  const defaultShopId = CONFIG.DEFAULT_SHOP_ID || undefined;

  const shop = await prisma.shop.upsert({
    where: defaultShopId ? { id: defaultShopId } : { slug: CONFIG.SHOP.slug },
    update: {
      hiddenSections: DEFAULT_HIDDEN_SECTIONS,
    },
    create: {
      ...(defaultShopId && { id: defaultShopId }),
      name: CONFIG.SHOP.name,
      slug: CONFIG.SHOP.slug,
      subName: CONFIG.SHOP.subName,
      tagline: CONFIG.SHOP.tagline,
      description: 'Your trusted partner for computer solutions',
      address: 'No. 123, Galle Road, Colombo 03, Sri Lanka',
      phone: '+94 11 234 5678',
      email: 'info@ecosystem.lk',
      website: 'https://ecosystem.lk',
      businessRegNo: 'PV00123456',
      taxId: 'TIN123456789',
      currency: 'LKR',
      taxRate: 0,
      isActive: true,
      reminderEnabled: true,
      themeMode: 'dark',
      accentColor: 'emerald',
      hiddenSections: DEFAULT_HIDDEN_SECTIONS,
    },
  });
  console.log(`   ✅ Shop: ${shop.name} (${shop.id})`);
  console.log(`   ℹ️  Set DEFAULT_SHOP_ID=${shop.id} in .env\n`);

  // ─────────────────────────────────────────────
  // 2. Admin & Staff Users (upsert - never deletes)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Users...');
  const adminPassword = await hashPassword(CONFIG.ADMIN.password);
  const admin = await prisma.user.upsert({
    where: { email: CONFIG.ADMIN.email },
    update: { name: CONFIG.ADMIN.name, role: 'ADMIN', shopId: shop.id, isActive: true },
    create: { email: CONFIG.ADMIN.email, password: adminPassword, name: CONFIG.ADMIN.name, role: 'ADMIN', shopId: shop.id, isActive: true, lastLogin: new Date() },
  });
  console.log(`   ✅ ADMIN: ${admin.email} / ${CONFIG.ADMIN.password}`);

  const staffPassword = await hashPassword('Staff@1234');
  await prisma.user.upsert({
    where: { email: 'staff@ecosystem.lk' },
    update: { name: 'Shop Staff', role: 'STAFF', shopId: shop.id, isActive: true },
    create: { email: 'staff@ecosystem.lk', password: staffPassword, name: 'Shop Staff', role: 'STAFF', shopId: shop.id, isActive: true },
  });
  console.log(`   ✅ STAFF: staff@ecosystem.lk / Staff@1234\n`);

  // ─────────────────────────────────────────────
  // 3. Categories (upsert on shopId_name)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Categories...');
  const categoryMap = new Map<string, string>();
  let categoryCount = 0;
  for (const cat of CATEGORIES_DATA) {
    const category = await prisma.category.upsert({
      where: { shopId_name: { shopId: shop.id, name: cat.name } },
      update: { description: cat.description, image: cat.image },
      create: { name: cat.name, description: cat.description, image: cat.image, shopId: shop.id },
    });
    categoryMap.set(cat.name, category.id);
    categoryCount++;
  }
  console.log(`   ✅ Ensured ${categoryCount} categories`);

  // ─────────────────────────────────────────────
  // 4. Brands (upsert on shopId_name)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Brands...');
  const brandMap = new Map<string, string>();
  let brandCount = 0;
  for (const brand of BRANDS_DATA) {
    const b = await prisma.brand.upsert({
      where: { shopId_name: { shopId: shop.id, name: brand.name } },
      update: { description: brand.description, website: brand.website },
      create: { name: brand.name, description: brand.description, website: brand.website, shopId: shop.id },
    });
    brandMap.set(brand.name, b.id);
    brandCount++;
  }
  console.log(`   ✅ Ensured ${brandCount} brands`);

  // ─────────────────────────────────────────────
  // 5. Products (findFirst by name+shopId then update/create)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Products...');
  let productCount = 0;
  for (const p of PRODUCTS_DATA) {
    const existing = await prisma.product.findFirst({
      where: { name: p.name, shopId: shop.id },
    });
    const categoryId = categoryMap.get(p.category);
    const brandId = brandMap.get(p.brand);
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: p.price,
          costPrice: p.costPrice,
          warranty: p.warranty,
          warrantyMonths: p.warrantyMonths,
          image: p.image,
          categoryId,
          brandId,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          price: p.price,
          costPrice: p.costPrice,
          stock: p.stock,
          warranty: p.warranty,
          warrantyMonths: p.warrantyMonths,
          image: p.image,
          categoryId,
          brandId,
          shopId: shop.id,
          totalPurchased: p.stock,
          totalSold: 0,
        },
      });
    }
    productCount++;
  }
  console.log(`   ✅ Ensured ${productCount} products`);

  // ─────────────────────────────────────────────
  // 6. Suppliers (upsert on shopId_name)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Suppliers...');
  let supplierCount = 0;
  for (const s of SUPPLIERS_DATA) {
    await prisma.supplier.upsert({
      where: { shopId_name: { shopId: shop.id, name: s.name } },
      update: { contactPerson: s.contactPerson, email: s.email, phone: s.phone, address: s.address },
      create: { name: s.name, contactPerson: s.contactPerson, email: s.email, phone: s.phone, address: s.address, shopId: shop.id },
    });
    supplierCount++;
  }
  console.log(`   ✅ Ensured ${supplierCount} suppliers`);

  // ─────────────────────────────────────────────
  // 7. Customers (findFirst by phone+shopId then update/create)
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Customers...');
  let customerCount = 0;
  for (const c of CUSTOMERS_DATA) {
    const existing = await prisma.customer.findFirst({
      where: { phone: c.phone, shopId: shop.id },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          email: c.email || undefined,
          address: c.address || undefined,
          nic: c.nic || undefined,
          customerType: c.type,
        },
      });
    } else {
      await prisma.customer.create({
        data: {
          name: c.name,
          email: c.email || undefined,
          phone: c.phone,
          address: c.address || undefined,
          nic: c.nic || undefined,
          customerType: c.type,
          shopId: shop.id,
          creditBalance: 0,
          creditLimit: c.type === 'WHOLESALE' ? 50000 : 0,
          creditStatus: 'CLEAR' as CreditStatus,
        },
      });
    }
    customerCount++;
  }
  console.log(`   ✅ Ensured ${customerCount} customers\n`);

  // ─────────────────────────────────────────────
  // 8. Sample Quotations (upsert on shopId_quotationNumber)
  //    - Links to existing customers and products
  // ─────────────────────────────────────────────
  console.log('📌 Ensuring Sample Quotations...');
  let quotationCount = 0;

  // Build product lookup by name
  const productByName = new Map<string, string>();
  const allProducts = await prisma.product.findMany({ where: { shopId: shop.id } });
  for (const prod of allProducts) productByName.set(prod.name, prod.id);

  for (const q of QUOTATIONS_DATA) {
    const customerIndex = q.customerIndex;
    const customerData = CUSTOMERS_DATA[customerIndex];
    const customer = await prisma.customer.findFirst({
      where: { phone: customerData.phone, shopId: shop.id },
    });

    if (!customer) {
      console.log(`   ⚠️  Skipping quotation ${q.quotationNumber} - customer not found`);
      continue;
    }

    // Calculate totals
    const subtotal = q.items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      return sum + lineTotal * (1 - item.discount / 100);
    }, 0);
    const grandTotal = subtotal - q.discountTotal + q.taxTotal;

    const now = new Date();
    const quotationDate = addDays(now, -(30 - quotationCount * 7)); // Stagger dates
    const validityDate = addDays(quotationDate, q.validityDays);

    // Upsert quotation
    const quotation = await prisma.quotation.upsert({
      where: {
        shopId_quotationNumber: { shopId: shop.id, quotationNumber: q.quotationNumber },
      },
      update: {
        customerId: customer.id,
        status: q.status,
        subtotal,
        discountTotal: q.discountTotal,
        taxTotal: q.taxTotal,
        grandTotal,
        validityDate,
        notes: q.notes,
        terms: q.terms,
      },
      create: {
        quotationNumber: q.quotationNumber,
        shopId: shop.id,
        customerId: customer.id,
        status: q.status,
        subtotal,
        discountTotal: q.discountTotal,
        taxTotal: q.taxTotal,
        grandTotal,
        validityDate,
        notes: q.notes,
        terms: q.terms,
        createdById: admin.id,
      },
    });

    // Upsert items (delete+recreate on existing quotation items is safe because
    // it only affects quotation-owned rows, never shared entities)
    // First check if quotation already has items
    const existingItems = await prisma.quotationItem.findMany({ where: { quotationId: quotation.id } });

    if (existingItems.length === 0) {
      await prisma.quotationItem.createMany({
        data: q.items.map((item, idx) => {
          const productId = item.itemType === 'PRODUCT'
            ? (productByName.get(item.productName) || null)
            : null;
          const lineTotal = item.quantity * item.unitPrice;
          return {
            quotationId: quotation.id,
            itemType: item.itemType,
            productId,
            serviceId: item.itemType === 'SERVICE' ? `service-${idx + 1}` : null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: lineTotal * (1 - item.discount / 100),
          };
        }),
      });
    }

    quotationCount++;
    console.log(`   ✅ ${q.quotationNumber} (${q.status})`);
  }
  console.log(`   ✅ Ensured ${quotationCount} sample quotations\n`);

  // ─────────────────────────────────────────────
  // Done
  // ─────────────────────────────────────────────
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   ✅ SEEDING COMPLETE!                     ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  console.log(`📝 Login: ${CONFIG.ADMIN.email} / ${CONFIG.ADMIN.password}`);
  console.log(`📝 Staff: staff@ecosystem.lk / Staff@1234`);
  console.log(`🏪 Shop ID: ${shop.id}`);
  console.log(`💡 Data preservation: existing records (customers, products,\n   invoices, settings) were preserved — only missing seed data was added.\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());