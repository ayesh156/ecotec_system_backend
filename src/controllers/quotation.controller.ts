import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma, QuotationStatus, QuotationItemType } from '@prisma/client';
import { getShopId } from '../lib/shopId';
import { AuthRequest } from '../types/express';

interface QuotationItemInput {
  itemType?: QuotationItemType;
  productId?: string | null;
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

// Generate QUO-YYYY-XXXX with uniqueness retry
const generateQuotationNumber = async (shopId: string): Promise<string> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.quotation.count({ where: { shopId } });
    const year = new Date().getFullYear();
    const sequence = (count + 1).toString().padStart(4, '0');
    const qNumber = `QUO-${year}-${sequence}`;
    const existing = await prisma.quotation.findUnique({
      where: { shopId_quotationNumber: { shopId, quotationNumber: qNumber } },
      select: { id: true },
    });
    if (!existing) return qNumber;
  }
  return `QUO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
};

const calculateTotals = (
  items: QuotationItemInput[],
  discountTotal = 0,
  taxTotal = 0
): { subtotal: number; grandTotal: number; itemTotals: number[] } => {
  const itemTotals = items.map(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const discount = item.discount || 0;
    return lineTotal * (1 - discount / 100);
  });
  const subtotal = itemTotals.reduce((sum, t) => sum + t, 0);
  return { subtotal, grandTotal: subtotal - discountTotal + taxTotal, itemTotals };
};

// GET /api/v1/quotations
export const getAllQuotations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { page = '1', limit = '10', status, customerId, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.QuotationWhereInput = { shopId };

    if (status && status !== 'all') where.status = (status as string).toUpperCase() as QuotationStatus;
    if (customerId && customerId !== 'all') where.customerId = customerId as string;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    if (search) {
      where.OR = [
        { quotationNumber: { contains: search as string } },
        { customer: { name: { contains: search as string } } },
        { customer: { phone: { contains: search as string } } },
      ];
    }

    const validSortFields = ['createdAt', 'updatedAt', 'grandTotal', 'status', 'quotationNumber', 'validityDate'];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const orderBy: Prisma.QuotationOrderByWithRelationInput = { [sortField]: (sortOrder as 'asc' | 'desc') || 'desc' };

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          items: { include: { product: { select: { id: true, name: true, price: true } } } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.quotation.count({ where }),
    ]);

    res.json({
      success: true,
      data: quotations,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/quotations/:id
// Supports lookup by database primary key (cuid) OR formatted quotationNumber (e.g. QUO-2026-0005)
export const getQuotationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = getShopId();

    const quotation = await prisma.quotation.findFirst({
      where: {
        shopId,
        OR: [
          { id },
          { quotationNumber: id },
        ],
      },
      include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!quotation) throw new AppError(`Quotation not found with ID: ${id}`, 404);

    res.json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/quotations
export const createQuotation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const userId = req.user?.id;
    const { customerId, items, status = 'DRAFT', discountTotal = 0, taxTotal = 0, validityDate, notes, terms } = req.body;

    if (!items || items.length === 0) throw new AppError('At least one item is required', 400);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError(`Customer not found with ID: ${customerId}`, 404);
    if (customer.shopId !== shopId) throw new AppError('Customer does not belong to your shop', 403);

    const validatedItems: QuotationItemInput[] = [];
    for (const item of items) {
      let validProductId: string | null = null;
      if (item.productId) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (product) validProductId = item.productId;
      }
      validatedItems.push({ ...item, itemType: (item.itemType || 'PRODUCT') as QuotationItemType, productId: validProductId });
    }

    const { subtotal, grandTotal, itemTotals } = calculateTotals(validatedItems, Number(discountTotal) || 0, Number(taxTotal) || 0);
    const quotationNumber = await generateQuotationNumber(shopId);

    const quotation = await prisma.$transaction(async (tx) => {
      return tx.quotation.create({
        data: {
          quotationNumber,
          shopId,
          customerId,
          status: status as QuotationStatus,
          subtotal,
          discountTotal: Number(discountTotal) || 0,
          taxTotal: Number(taxTotal) || 0,
          grandTotal,
          validityDate: validityDate ? new Date(validityDate) : undefined,
          notes,
          terms,
          createdById: userId || undefined,
          items: {
            create: validatedItems.map((item, index) => ({
              itemType: item.itemType || 'PRODUCT',
              productId: item.productId,
              serviceId: item.serviceId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: itemTotals[index],
            })),
          },
        },
        include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      });
    });

    res.status(201).json({ success: true, message: 'Quotation created successfully', data: quotation });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/quotations/:id
// Supports lookup by database primary key (cuid) OR formatted quotationNumber
export const updateQuotation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = getShopId();
    const { customerId, items, status, discountTotal, taxTotal, validityDate, notes, terms } = req.body;

    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        shopId,
        OR: [
          { id },
          { quotationNumber: id },
        ],
      },
      include: { items: true },
    });

    if (!existingQuotation) throw new AppError(`Quotation not found with ID: ${id}`, 404);
    if (existingQuotation.shopId !== shopId) throw new AppError('You do not have permission to modify this quotation', 403);

    if (customerId && customerId !== existingQuotation.customerId) {
      const newCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!newCustomer) throw new AppError(`Customer not found with ID: ${customerId}`, 404);
      if (newCustomer.shopId !== shopId) throw new AppError('New customer does not belong to your shop', 403);
    }

    const quotationId = existingQuotation.id;
    const newDiscountTotal = discountTotal !== undefined ? Number(discountTotal) : existingQuotation.discountTotal;
    const newTaxTotal = taxTotal !== undefined ? Number(taxTotal) : existingQuotation.taxTotal;

    let validatedItems: QuotationItemInput[] | null = null;
    let itemTotals: number[] = [];
    let subtotal = existingQuotation.subtotal;
    let grandTotal = existingQuotation.grandTotal;

    if (items && items.length > 0) {
      validatedItems = [];
      for (const item of items) {
        let validProductId: string | null = null;
        if (item.productId) {
          const product = await prisma.product.findUnique({ where: { id: item.productId } });
          if (product) validProductId = item.productId;
        }
        validatedItems.push({ ...item, itemType: (item.itemType || 'PRODUCT') as QuotationItemType, productId: validProductId });
      }
      const totals = calculateTotals(validatedItems, newDiscountTotal, newTaxTotal);
      subtotal = totals.subtotal;
      grandTotal = totals.grandTotal;
      itemTotals = totals.itemTotals;
    } else {
      grandTotal = subtotal - newDiscountTotal + newTaxTotal;
    }

    const quotation = await prisma.$transaction(async (tx) => {
      if (validatedItems) {
        await tx.quotationItem.deleteMany({ where: { quotationId } });
      }
      return tx.quotation.update({
        where: { id: quotationId },
        data: {
          ...(customerId && { customerId }),
          ...(status && { status: status as QuotationStatus }),
          subtotal,
          discountTotal: newDiscountTotal,
          taxTotal: newTaxTotal,
          grandTotal,
          ...(validityDate ? { validityDate: new Date(validityDate) } : {}),
          ...(notes !== undefined && { notes }),
          ...(terms !== undefined && { terms }),
          ...(validatedItems && {
            items: {
              create: validatedItems.map((item, index) => ({
                itemType: item.itemType || 'PRODUCT',
                productId: item.productId,
                serviceId: item.serviceId || null,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount || 0,
                total: itemTotals[index],
              })),
            },
          }),
        },
        include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      });
    });

    res.json({ success: true, message: 'Quotation updated successfully', data: quotation });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/quotations/:id
// Supports lookup by database primary key (cuid) OR formatted quotationNumber
export const deleteQuotation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = getShopId();

    const quotation = await prisma.quotation.findFirst({
      where: {
        shopId,
        OR: [
          { id },
          { quotationNumber: id },
        ],
      },
    });
    if (!quotation) throw new AppError(`Quotation not found with ID: ${id}`, 404);
    if (quotation.shopId !== shopId) throw new AppError('You do not have permission to delete this quotation', 403);

    await prisma.quotation.delete({ where: { id: quotation.id } });

    res.json({ success: true, message: 'Quotation deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/quotations/:id/convert-to-invoice
export const convertQuotationToInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = getShopId();
    const userId = req.user?.id;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, customer: true },
    });

    if (!quotation) throw new AppError(`Quotation not found with ID: ${id}`, 404);
    if (quotation.shopId !== shopId) throw new AppError('You do not have permission to convert this quotation', 403);
    if (quotation.status === 'CONVERTED') throw new AppError('This quotation has already been converted to an invoice', 400);
    if (quotation.status !== 'ACCEPTED') throw new AppError('Only accepted quotations can be converted to invoices', 400);

    const result = await prisma.$transaction(async (tx) => {
      let invoiceNumber = `${(Date.now() % 10000000).toString().padStart(7, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await tx.invoice.findUnique({
          where: { shopId_invoiceNumber: { shopId, invoiceNumber } },
          select: { id: true },
        });
        if (!existing) break;
        invoiceNumber = `${(Date.now() % 10000000).toString().padStart(7, '0')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          shopId,
          customerId: quotation.customerId,
          customerName: quotation.customer.name,
          subtotal: quotation.subtotal,
          tax: quotation.taxTotal,
          discount: quotation.discountTotal,
          total: quotation.grandTotal,
          paidAmount: 0,
          dueAmount: quotation.grandTotal,
          status: 'UNPAID',
          date: new Date(),
          dueDate,
          salesChannel: 'ON_SITE',
          notes: quotation.notes || `Converted from Quotation ${quotation.quotationNumber}`,
          createdById: userId || undefined,
          items: {
            create: quotation.items.map(item => ({
              productId: item.productId,
              productName: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              originalPrice: item.unitPrice,
              discount: item.discount,
              total: item.total,
            })),
          },
        },
        include: { customer: true, items: true },
      });

      const updatedQuotation = await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: 'CONVERTED' },
      });

      await tx.customer.update({
        where: { id: quotation.customerId },
        data: {
          totalOrders: { increment: 1 },
          lastPurchase: new Date(),
          creditBalance: { increment: quotation.grandTotal },
          creditStatus: 'ACTIVE',
        },
      });

      for (const item of quotation.items) {
        if (item.productId && item.product) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity }, totalSold: { increment: item.quantity } },
          });
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'INVOICE_OUT',
                quantity: -item.quantity,
                previousStock: product.stock + item.quantity,
                newStock: product.stock,
                referenceId: invoice.id,
                referenceNumber: invoiceNumber,
                referenceType: 'invoice',
                unitPrice: item.unitPrice,
                shopId,
                createdBy: userId,
              },
            });
          }
        }
      }

      return { invoice, quotation: updatedQuotation };
    });

    res.status(201).json({
      success: true,
      message: 'Quotation converted to invoice successfully',
      data: { invoice: result.invoice, quotation: result.quotation },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/quotations/stats
export const getQuotationStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();

    const [totalQuotations, statusCounts, revenueStats, recentQuotations] = await Promise.all([
      prisma.quotation.count({ where: { shopId } }),
      prisma.quotation.groupBy({
        by: ['status'],
        where: { shopId },
        _count: { status: true },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.aggregate({
        where: { shopId },
        _sum: { subtotal: true, discountTotal: true, taxTotal: true, grandTotal: true },
        _avg: { grandTotal: true },
      }),
      prisma.quotation.findMany({
        where: { shopId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalQuotations,
        statusStats: statusCounts,
        revenue: {
          subtotal: revenueStats._sum?.subtotal || 0,
          discountTotal: revenueStats._sum?.discountTotal || 0,
          taxTotal: revenueStats._sum?.taxTotal || 0,
          grandTotal: revenueStats._sum?.grandTotal || 0,
          averageQuotationValue: revenueStats._avg?.grandTotal || 0,
        },
        recentQuotations,
      },
    });
  } catch (error) {
    next(error);
  }
};
