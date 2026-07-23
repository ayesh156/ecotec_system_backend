import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../types/express';
import { getShopId } from '../lib/shopId';

// Get shop by ID
export const getShopById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch (error) { next(error); }
};

// Update shop settings
export const updateShop = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;

    const updateData: any = {};
    const { name, subName, tagline, description, logo, address, phone, email, website, businessRegNo, taxId, currency, taxRate, hiddenSections, adminHiddenSections, themeMode, accentColor } = req.body;

    if (name !== undefined) updateData.name = name;
    if (subName !== undefined) updateData.subName = subName;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (description !== undefined) updateData.description = description;
    if (logo !== undefined) updateData.logo = logo;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (businessRegNo !== undefined) updateData.businessRegNo = businessRegNo;
    if (taxId !== undefined) updateData.taxId = taxId;
    if (currency !== undefined) updateData.currency = currency;
    if (taxRate !== undefined) updateData.taxRate = taxRate;
    if (themeMode !== undefined) updateData.themeMode = themeMode;
    if (accentColor !== undefined) updateData.accentColor = accentColor;

    // Section visibility - only ADMIN can modify adminHiddenSections
    if (adminHiddenSections !== undefined) {
      if (userRole !== 'ADMIN') return res.status(403).json({ success: false, error: 'Only Admin can update section visibility' });
      if (!Array.isArray(adminHiddenSections)) return res.status(400).json({ success: false, error: 'adminHiddenSections must be an array' });
      updateData.adminHiddenSections = adminHiddenSections;
    }

    const updatedShop = await prisma.shop.update({ where: { id }, data: updateData });
    res.json({ success: true, message: 'Shop updated successfully', data: updatedShop });
  } catch (error) { next(error); }
};

// Get all users for a shop
export const getShopUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const users = await prisma.user.findMany({
      where: { shopId: id },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
};

// Add a new user to shop
export const addShopUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: shopId } = req.params;
    const { email, name, password, role } = req.body;

    if (!email || !name || !password) return res.status(400).json({ success: false, error: 'Email, name, and password are required' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ success: false, error: 'A user with this email already exists' });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, name, password: hashedPassword, role: role || 'STAFF', shopId, isActive: true },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    res.status(201).json({ success: true, message: 'User added successfully', data: user });
  } catch (error) { next(error); }
};

// Update user role
export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: shopId, userId } = req.params;
    const { role, isActive } = req.body;

    const user = await prisma.user.findFirst({ where: { id: userId, shopId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found in this shop' });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role ?? undefined, isActive: isActive ?? undefined },
      select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
    });

    res.json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) { next(error); }
};

// Get shop statistics
export const getShopStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: shopId } = req.params;

    const [usersCount, customersCount, productsCount, categoriesCount, brandsCount, invoicesCount, totalRevenue] = await Promise.all([
      prisma.user.count({ where: { shopId } }),
      prisma.customer.count({ where: { shopId } }),
      prisma.product.count({ where: { shopId } }),
      prisma.category.count({ where: { shopId } }),
      prisma.brand.count({ where: { shopId } }),
      prisma.invoice.count({ where: { shopId } }),
      prisma.invoice.aggregate({ where: { shopId }, _sum: { paidAmount: true } }),
    ]);

    res.json({
      success: true,
      data: { users: usersCount, customers: customersCount, products: productsCount, categories: categoriesCount, brands: brandsCount, invoices: invoicesCount, totalRevenue: totalRevenue._sum.paidAmount || 0 },
    });
  } catch (error) { next(error); }
};

// ==========================================
// SECTION VISIBILITY MANAGEMENT
// ==========================================

// Get hidden sections for a shop
export const getShopSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shop = await prisma.shop.findUnique({
      where: { id },
      select: { id: true, hiddenSections: true, adminHiddenSections: true },
    });

    if (!shop) return res.status(404).json({ success: false, error: 'Shop not found' });

    res.json({ success: true, hiddenSections: shop.hiddenSections || [], adminHiddenSections: shop.adminHiddenSections || [] });
  } catch (error) { next(error); }
};

// Update hidden sections for a shop
export const updateShopSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { adminHiddenSections } = req.body;
    const authReq = req as AuthRequest;
    const userRole = authReq.user?.role;

    const existingShop = await prisma.shop.findUnique({ where: { id } });
    if (!existingShop) return res.status(404).json({ success: false, error: 'Shop not found' });

    const updateData: { adminHiddenSections?: string[] } = {};

    if ((userRole === 'ADMIN') && adminHiddenSections !== undefined) {
      if (!Array.isArray(adminHiddenSections)) return res.status(400).json({ success: false, error: 'adminHiddenSections must be an array of strings' });
      updateData.adminHiddenSections = adminHiddenSections;
    }

    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: 'No valid section data to update' });

    const updatedShop = await prisma.shop.update({
      where: { id },
      data: updateData,
      select: { id: true, hiddenSections: true, adminHiddenSections: true },
    });

    res.json({ success: true, message: 'Section visibility updated successfully', ...updatedShop });
  } catch (error) { next(error); }
};

// Debug shop sections
export const debugShopSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shop = await prisma.shop.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, hiddenSections: true, adminHiddenSections: true },
    });

    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found', shopId: id });

    res.json({
      success: true,
      message: 'Shop sections diagnostic',
      timestamp: new Date().toISOString(),
      shop: {
        id: shop.id, name: shop.name, slug: shop.slug,
        hiddenSections: shop.hiddenSections,
        adminHiddenSections: shop.adminHiddenSections,
      },
    });
  } catch (error) { next(error); }
};