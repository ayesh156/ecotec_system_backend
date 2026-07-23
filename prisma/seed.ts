/**
 * 🌱 EcoSystem Database Seed (Single-Shop Mode)
 * ==============================================
 * Seeds a single default shop with sample data.
 * Uses DEFAULT_SHOP_ID from environment.
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
  InvoiceStatus, 
  PaymentMethod, 
  CreditStatus, 
  SalesChannel, 
  CustomerType,
  StockMovementType,
  GRNStatus,
  PaymentStatus,
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

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateInvoiceNumber(index: number, year: number = 2026): string {
  return `INV-${year}-${String(index).padStart(4, '0')}`;
}

function generateGRNNumber(index: number, year: number = 2026): string {
  return `GRN-${year}-${String(index).padStart(4, '0')}`;
}

function getWarrantyDueDate(warrantyMonths: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + warrantyMonths);
  return date;
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

async function main() {
  console.log('\n╔═══════════════════════════════════╗');
  console.log('║  🌱 ECOSYSTEM DATABASE SEED        ║');
  console.log('║     Single-Shop Mode               ║');
  console.log('╚═══════════════════════════════════╝\n');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.invoiceReminder.deleteMany();
  await prisma.gRNReminder.deleteMany();
  await prisma.invoiceItemHistory.deleteMany();
  await prisma.invoicePayment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.gRNPayment.deleteMany();
  await prisma.gRNItem.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.customerPaymentRecord.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.gRN.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();
  console.log('   ✅ Database cleaned\n');

  // Create Default Shop
  console.log('📌 Creating Default Shop...');
  const defaultShopId = CONFIG.DEFAULT_SHOP_ID || undefined;
  
  const shop = await prisma.shop.upsert({
    where: defaultShopId ? { id: defaultShopId } : { slug: CONFIG.SHOP.slug },
    update: { hiddenSections: DEFAULT_HIDDEN_SECTIONS },
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

  // Create Admin User
  console.log('📌 Creating Admin User...');
  const adminPassword = await hashPassword(CONFIG.ADMIN.password);
  const admin = await prisma.user.upsert({
    where: { email: CONFIG.ADMIN.email },
    update: { name: CONFIG.ADMIN.name, password: adminPassword, role: 'ADMIN', shopId: shop.id },
    create: { email: CONFIG.ADMIN.email, password: adminPassword, name: CONFIG.ADMIN.name, role: 'ADMIN', shopId: shop.id, isActive: true, lastLogin: new Date() },
  });
  console.log(`   ✅ ADMIN: ${admin.email} / ${CONFIG.ADMIN.password}`);

  // Create additional users
  const staffPassword = await hashPassword('Staff@1234');
  await prisma.user.upsert({
    where: { email: 'staff@ecosystem.lk' },
    update: { name: 'Shop Staff', password: staffPassword, role: 'STAFF', shopId: shop.id },
    create: { email: 'staff@ecosystem.lk', password: staffPassword, name: 'Shop Staff', role: 'STAFF', shopId: shop.id, isActive: true },
  });
  console.log(`   ✅ STAFF: staff@ecosystem.lk / Staff@1234\n`);

  // Seed data
  const allCategories = await Promise.all(CATEGORIES_DATA.map(cat => 
    prisma.category.create({ data: { name: cat.name, description: cat.description, image: cat.image, shopId: shop.id } })
  ));
  const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));
  console.log(`   ✅ Created ${allCategories.length} categories`);

  const allBrands = await Promise.all(BRANDS_DATA.map(brand =>
    prisma.brand.create({ data: { name: brand.name, description: brand.description, website: brand.website, shopId: shop.id } })
  ));
  const brandMap = new Map(allBrands.map(b => [b.name, b.id]));
  console.log(`   ✅ Created ${allBrands.length} brands`);

  const products = await Promise.all(PRODUCTS_DATA.map(p =>
    prisma.product.create({
      data: {
        name: p.name, price: p.price, costPrice: p.costPrice, stock: p.stock,
        warranty: p.warranty, warrantyMonths: p.warrantyMonths,
        image: p.image,
        categoryId: categoryMap.get(p.category), brandId: brandMap.get(p.brand), shopId: shop.id,
        totalPurchased: p.stock, totalSold: 0,
      },
    })
  ));
  console.log(`   ✅ Created ${products.length} products`);

  const suppliers = await Promise.all(SUPPLIERS_DATA.map(s =>
    prisma.supplier.create({ data: { name: s.name, contactPerson: s.contactPerson, email: s.email, phone: s.phone, address: s.address, shopId: shop.id } })
  ));
  console.log(`   ✅ Created ${suppliers.length} suppliers`);

  const customers = await Promise.all(CUSTOMERS_DATA.map(c =>
    prisma.customer.create({
      data: {
        name: c.name, email: c.email, phone: c.phone, address: c.address, nic: c.nic,
        customerType: c.type, shopId: shop.id,
        creditBalance: 0, creditLimit: c.type === 'WHOLESALE' ? 50000 : 0,
      },
    })
  ));
  console.log(`   ✅ Created ${customers.length} customers\n`);

  console.log('╔═══════════════════════════════════╗');
  console.log('║   ✅ SEEDING COMPLETE!             ║');
  console.log('╚═══════════════════════════════════╝\n');
  console.log(`📝 Login: ${CONFIG.ADMIN.email} / ${CONFIG.ADMIN.password}`);
  console.log(`📝 Staff: staff@ecosystem.lk / Staff@1234`);
  console.log(`🏪 Shop ID: ${shop.id}\n`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());