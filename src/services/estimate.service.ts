import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma, EstimateStatus, EstimateItemType } from '@prisma/client';
import { generateUniqueDocumentNumber } from '../lib/documentNumber';

export interface EstimateItemInput {
  itemType?: EstimateItemType;
  productId?: string | null;
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface EstimateQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Generate unique 10-digit estimate number with collision check
export const generateEstimateNumber = async (shopId: string): Promise<string> => {
  return generateUniqueDocumentNumber(shopId, async (number) => {
    const existing = await prisma.estimate.findUnique({
      where: { shopId_estimateNumber: { shopId, estimateNumber: number } },
      select: { id: true },
    });
    return !!existing;
  });
};

const calculateTotals = (
  items: EstimateItemInput[],
  discountTotal: number | Prisma.Decimal = 0,
  taxTotal: number | Prisma.Decimal = 0
): { subtotal: number; grandTotal: number; itemTotals: number[] } => {
  const itemTotals = items.map(item => {
    const lineTotal = Number(item.quantity) * Number(item.unitPrice);
    const discount = Number(item.discount) || 0;
    return lineTotal * (1 - discount / 100);
  });
  const subtotal = itemTotals.reduce((sum, t) => sum + t, 0);
  const discount = Number(discountTotal) || 0;
  const tax = Number(taxTotal) || 0;
  return { subtotal, grandTotal: subtotal - discount + tax, itemTotals };
};

export class EstimateService {
  async getAll(shopId: string, params: EstimateQueryParams) {
    const { page = 1, limit = 10, status, customerId, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.EstimateWhereInput = { shopId };

    if (status && status !== 'all') where.status = status.toUpperCase() as EstimateStatus;
    if (customerId && customerId !== 'all') where.customerId = customerId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { estimateNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const validSortFields = ['createdAt', 'updatedAt', 'grandTotal', 'status', 'estimateNumber', 'validityDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.EstimateOrderByWithRelationInput = { [sortField]: sortOrder || 'desc' };

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
          items: { include: { product: { select: { id: true, name: true, price: true } } } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.estimate.count({ where }),
    ]);

    return { data: estimates, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const estimate = await prisma.estimate.findFirst({
      where: {
        shopId,
        OR: [{ id }, { estimateNumber: id }],
      },
      include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!estimate) throw new AppError(`Estimate not found with ID: ${id}`, 404);

    return estimate;
  }

  async create(shopId: string, userId: string | undefined, data: {
    customerId: string;
    items: EstimateItemInput[];
    status?: string;
    discountTotal?: number;
    taxTotal?: number;
    validityDate?: string;
    notes?: string;
    terms?: string;
    internalNotes?: string;
    estimateNumber?: string;
  }) {
    const { customerId, items, status = 'DRAFT', discountTotal = 0, taxTotal = 0, validityDate, notes, terms, internalNotes, estimateNumber: clientEstimateNumber } = data;

    if (!items || items.length === 0) throw new AppError('At least one item is required', 400);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new AppError(`Customer not found with ID: ${customerId}`, 404);
    if (customer.shopId !== shopId) throw new AppError('Customer does not belong to your shop', 403);

    // Batch-fetch all products once (kills N+1)
    const productIds = items.filter(i => i.productId).map(i => i.productId as string);
    const products = productIds.length > 0
      ? await prisma.product.findMany({ where: { id: { in: productIds } } })
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    const validatedItems: EstimateItemInput[] = items.map(item => ({
      ...item,
      itemType: (item.itemType || 'PRODUCT') as EstimateItemType,
      productId: item.productId && productMap.has(item.productId) ? item.productId : null,
    }));

    const { subtotal, grandTotal, itemTotals } = calculateTotals(validatedItems, Number(discountTotal) || 0, Number(taxTotal) || 0);

    // 🔒 STRICT: If the client supplied a valid 10-digit document number, USE IT EXACTLY.
    // Only generate a fallback number when the payload did not supply one.
    let estimateNumber = '';
    if (clientEstimateNumber !== undefined && clientEstimateNumber !== null && clientEstimateNumber !== '') {
      if (typeof clientEstimateNumber !== 'string' || !/^\d{10}$/.test(clientEstimateNumber)) {
        throw new AppError('Estimate number must be a 10-digit numeric string', 400);
      }
      estimateNumber = clientEstimateNumber;
    } else {
      estimateNumber = await generateEstimateNumber(shopId);
    }

    const estimate = await prisma.$transaction(async (tx) => {
      return tx.estimate.create({
        data: {
          estimateNumber,
          shopId,
          customerId,
          status: status as EstimateStatus,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          discountTotal: new Prisma.Decimal((Number(discountTotal) || 0).toFixed(2)),
          taxTotal: new Prisma.Decimal((Number(taxTotal) || 0).toFixed(2)),
          grandTotal: new Prisma.Decimal(grandTotal.toFixed(2)),
          validityDate: validityDate ? new Date(validityDate) : undefined,
          notes,
          terms,
          internalNotes,
          createdById: userId || undefined,
          items: {
            create: validatedItems.map((item, index) => ({
              itemType: item.itemType || 'PRODUCT',
              productId: item.productId,
              serviceId: item.serviceId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(Number(item.unitPrice).toFixed(2)),
              discount: new Prisma.Decimal((Number(item.discount) || 0).toFixed(2)),
              total: new Prisma.Decimal(itemTotals[index].toFixed(2)),
            })),
          },
        },
        include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      });
    });

    return estimate;
  }

  async update(shopId: string, id: string, data: {
    customerId?: string;
    items?: EstimateItemInput[];
    status?: string;
    discountTotal?: number;
    taxTotal?: number;
    validityDate?: string;
    notes?: string;
    terms?: string;
    internalNotes?: string;
  }) {
    const { customerId, items, status, discountTotal, taxTotal, validityDate, notes, terms, internalNotes } = data;

    const existingEstimate = await prisma.estimate.findFirst({
      where: {
        shopId,
        OR: [{ id }, { estimateNumber: id }],
      },
      include: { items: true },
    });

    if (!existingEstimate) throw new AppError(`Estimate not found with ID: ${id}`, 404);
    if (existingEstimate.shopId !== shopId) throw new AppError('You do not have permission to modify this estimate', 403);

    if (customerId && customerId !== existingEstimate.customerId) {
      const newCustomer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!newCustomer) throw new AppError(`Customer not found with ID: ${customerId}`, 404);
      if (newCustomer.shopId !== shopId) throw new AppError('New customer does not belong to your shop', 403);
    }

    const estimateId = existingEstimate.id;
    const newDiscountTotal = discountTotal !== undefined ? Number(discountTotal) : Number(existingEstimate.discountTotal);
    const newTaxTotal = taxTotal !== undefined ? Number(taxTotal) : Number(existingEstimate.taxTotal);

    let validatedItems: EstimateItemInput[] | null = null;
    let itemTotals: number[] = [];
    let subtotal = Number(existingEstimate.subtotal);
    let grandTotal = Number(existingEstimate.grandTotal);

    if (items && items.length > 0) {
      // Batch-fetch all products once (kills N+1)
      const productIds = items.filter(i => i.productId).map(i => i.productId as string);
      const products = productIds.length > 0
        ? await prisma.product.findMany({ where: { id: { in: productIds } } })
        : [];
      const productMap = new Map(products.map(p => [p.id, p]));

      validatedItems = items.map(item => ({
        ...item,
        itemType: (item.itemType || 'PRODUCT') as EstimateItemType,
        productId: item.productId && productMap.has(item.productId) ? item.productId : null,
      }));
      const totals = calculateTotals(validatedItems, newDiscountTotal, newTaxTotal);
      subtotal = totals.subtotal;
      grandTotal = totals.grandTotal;
      itemTotals = totals.itemTotals;
    } else {
      grandTotal = subtotal - newDiscountTotal + newTaxTotal;
    }

    const estimate = await prisma.$transaction(async (tx) => {
      if (validatedItems) {
        await tx.estimateItem.deleteMany({ where: { estimateId } });
      }
      return tx.estimate.update({
        where: { id: estimateId },
        data: {
          ...(customerId && { customerId }),
          ...(status && { status: status as EstimateStatus }),
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          discountTotal: new Prisma.Decimal(newDiscountTotal.toFixed(2)),
          taxTotal: new Prisma.Decimal(newTaxTotal.toFixed(2)),
          grandTotal: new Prisma.Decimal(grandTotal.toFixed(2)),
          ...(validityDate ? { validityDate: new Date(validityDate) } : {}),
          ...(notes !== undefined && { notes }),
          ...(terms !== undefined && { terms }),
          ...(internalNotes !== undefined && { internalNotes }),
          ...(validatedItems && {
            items: {
              create: validatedItems.map((item, index) => ({
                itemType: item.itemType || 'PRODUCT',
                productId: item.productId,
                serviceId: item.serviceId || null,
                description: item.description,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(Number(item.unitPrice).toFixed(2)),
                discount: new Prisma.Decimal((Number(item.discount) || 0).toFixed(2)),
                total: new Prisma.Decimal(itemTotals[index].toFixed(2)),
              })),
            },
          }),
        },
        include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      });
    });

    return estimate;
  }

  async remove(shopId: string, id: string) {
    const estimate = await prisma.estimate.findFirst({
      where: {
        shopId,
        OR: [{ id }, { estimateNumber: id }],
      },
    });
    if (!estimate) throw new AppError(`Estimate not found with ID: ${id}`, 404);
    if (estimate.shopId !== shopId) throw new AppError('You do not have permission to delete this estimate', 403);

    await prisma.estimate.delete({ where: { id: estimate.id } });
  }

  async convertToQuotation(shopId: string, userId: string | undefined, id: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, customer: true },
    });

    if (!estimate) throw new AppError(`Estimate not found with ID: ${id}`, 404);
    if (estimate.shopId !== shopId) throw new AppError('You do not have permission to convert this estimate', 403);
    if (estimate.status === 'CONVERTED') throw new AppError('This estimate has already been converted', 400);
    if (estimate.status !== 'ACCEPTED') throw new AppError('Only accepted estimates can be converted', 400);

    const quotationNumber = await prisma.quotation.count({ where: { shopId } })
      .then(count => `QUO-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`);

    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber,
          shopId,
          customerId: estimate.customerId,
          status: 'CONVERTED',
          subtotal: new Prisma.Decimal(estimate.subtotal.toString()),
          discountTotal: new Prisma.Decimal(estimate.discountTotal.toString()),
          taxTotal: new Prisma.Decimal(estimate.taxTotal.toString()),
          grandTotal: new Prisma.Decimal(estimate.grandTotal.toString()),
          validityDate: estimate.validityDate,
          notes: estimate.notes || `Converted from Estimate ${estimate.estimateNumber}`,
          terms: estimate.terms,
          createdById: userId || undefined,
          items: {
            create: estimate.items.map(item => ({
              itemType: 'PRODUCT' as const,
              productId: item.productId,
              serviceId: item.serviceId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice.toString()),
              discount: new Prisma.Decimal(item.discount.toString()),
              total: new Prisma.Decimal(item.total.toString()),
            })),
          },
        },
        include: { customer: true, items: true },
      });

      const updatedEstimate = await tx.estimate.update({
        where: { id: estimate.id },
        data: { status: 'CONVERTED' },
      });

      return { quotation, estimate: updatedEstimate };
    });

    return result;
  }

  async convertToInvoice(shopId: string, userId: string | undefined, id: string) {
    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, customer: true },
    });

    if (!estimate) throw new AppError(`Estimate not found with ID: ${id}`, 404);
    if (estimate.shopId !== shopId) throw new AppError('You do not have permission to convert this estimate', 403);
    if (estimate.status === 'CONVERTED') throw new AppError('This estimate has already been converted', 400);
    if (estimate.status !== 'ACCEPTED') throw new AppError('Only accepted estimates can be converted', 400);

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
          customerId: estimate.customerId,
          customerName: estimate.customer.name,
          subtotal: new Prisma.Decimal(estimate.subtotal.toString()),
          tax: new Prisma.Decimal(estimate.taxTotal.toString()),
          discount: new Prisma.Decimal(estimate.discountTotal.toString()),
          total: new Prisma.Decimal(estimate.grandTotal.toString()),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(estimate.grandTotal.toString()),
          status: 'UNPAID',
          date: new Date(),
          dueDate,
          salesChannel: 'ON_SITE',
          notes: estimate.notes || `Converted from Estimate ${estimate.estimateNumber}`,
          createdById: userId || undefined,
          items: {
            create: estimate.items.map(item => ({
              productId: item.productId,
              productName: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice.toString()),
              originalPrice: new Prisma.Decimal(item.unitPrice.toString()),
              discount: new Prisma.Decimal(item.discount.toString()),
              total: new Prisma.Decimal(item.total.toString()),
            })),
          },
        },
        include: { customer: true, items: true },
      });

      const updatedEstimate = await tx.estimate.update({
        where: { id: estimate.id },
        data: { status: 'CONVERTED' },
      });

      return { invoice, estimate: updatedEstimate };
    });

    return result;
  }

  async getStats(shopId: string) {
    const [totalEstimates, statusCounts, revenueStats, recentEstimates] = await Promise.all([
      prisma.estimate.count({ where: { shopId } }),
      prisma.estimate.groupBy({
        by: ['status'],
        where: { shopId },
        _count: { status: true },
        _sum: { grandTotal: true },
      }),
      prisma.estimate.aggregate({
        where: { shopId },
        _sum: { subtotal: true, discountTotal: true, taxTotal: true, grandTotal: true },
        _avg: { grandTotal: true },
      }),
      prisma.estimate.findMany({
        where: { shopId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    return {
      totalEstimates,
      statusStats: statusCounts,
      revenue: {
        subtotal: Number(revenueStats._sum?.subtotal || 0),
        discountTotal: Number(revenueStats._sum?.discountTotal || 0),
        taxTotal: Number(revenueStats._sum?.taxTotal || 0),
        grandTotal: Number(revenueStats._sum?.grandTotal || 0),
        averageEstimateValue: Number(revenueStats._avg?.grandTotal || 0),
      },
      recentEstimates,
    };
  }
}

export const estimateService = new EstimateService();