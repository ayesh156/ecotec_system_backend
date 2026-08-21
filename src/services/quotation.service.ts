import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma, QuotationStatus, QuotationItemType } from '@prisma/client';
import { generateUniqueDocumentNumber } from '../lib/documentNumber';

export interface QuotationItemInput {
  itemType?: QuotationItemType;
  productId?: string | null;
  serviceId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface QuotationQueryParams {
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

// Generate unique 10-digit quotation number with collision check
export const generateQuotationNumber = async (shopId: string): Promise<string> => {
  return generateUniqueDocumentNumber(shopId, async (number) => {
    const existing = await prisma.quotation.findUnique({
      where: { shopId_quotationNumber: { shopId, quotationNumber: number } },
      select: { id: true },
    });
    return !!existing;
  });
};

const calculateTotals = (
  items: QuotationItemInput[],
  discountTotal: number | Prisma.Decimal = 0,
  taxTotal: number | Prisma.Decimal = 0
): { subtotal: number; grandTotal: number; itemTotals: number[] } => {
  const itemTotals = items.map(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const discount = item.discount || 0;
    return lineTotal * (1 - discount / 100);
  });
  const subtotal = itemTotals.reduce((sum, t) => sum + t, 0);
  const discount = Number(discountTotal) || 0;
  const tax = Number(taxTotal) || 0;
  return { subtotal, grandTotal: subtotal - discount + tax, itemTotals };
};

export class QuotationService {
  async getAll(shopId: string, params: QuotationQueryParams) {
    const { page = 1, limit = 10, status, customerId, startDate, endDate, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.QuotationWhereInput = { shopId };

    if (status && status !== 'all') where.status = status.toUpperCase() as QuotationStatus;
    if (customerId && customerId !== 'all') where.customerId = customerId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { quotationNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const validSortFields = ['createdAt', 'updatedAt', 'grandTotal', 'status', 'quotationNumber', 'validityDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.QuotationOrderByWithRelationInput = { [sortField]: sortOrder || 'desc' };

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

    return { data: quotations, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }

  async getById(shopId: string, id: string) {
    const quotation = await prisma.quotation.findFirst({
      where: {
        shopId,
        OR: [{ id }, { quotationNumber: id }],
      },
      include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!quotation) throw new AppError(`Quotation not found with ID: ${id}`, 404);

    return quotation;
  }

  async create(shopId: string, userId: string | undefined, data: {
    customerId: string;
    items: QuotationItemInput[];
    status?: string;
    discountTotal?: number;
    taxTotal?: number;
    validityDate?: string;
    notes?: string;
    terms?: string;
    quotationNumber?: string;
  }) {
    const { customerId, items, status = 'DRAFT', discountTotal = 0, taxTotal = 0, validityDate, notes, terms, quotationNumber: clientQuotationNumber } = data;

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

    const validatedItems: QuotationItemInput[] = items.map(item => ({
      ...item,
      itemType: (item.itemType || 'PRODUCT') as QuotationItemType,
      productId: item.productId && productMap.has(item.productId) ? item.productId : null,
    }));

    const { subtotal, grandTotal, itemTotals } = calculateTotals(validatedItems, Number(discountTotal) || 0, Number(taxTotal) || 0);

    // 🔒 STRICT: If the client supplied a valid 10-digit document number, USE IT EXACTLY.
    // Only generate a fallback number when the payload did not supply one.
    let quotationNumber = '';
    if (clientQuotationNumber !== undefined && clientQuotationNumber !== null && clientQuotationNumber !== '') {
      if (typeof clientQuotationNumber !== 'string' || !/^\d{10}$/.test(clientQuotationNumber)) {
        throw new AppError('Quotation number must be a 10-digit numeric string', 400);
      }
      quotationNumber = clientQuotationNumber;
    } else {
      quotationNumber = await generateQuotationNumber(shopId);
    }

    const quotation = await prisma.$transaction(async (tx) => {
      return tx.quotation.create({
        data: {
          quotationNumber,
          shopId,
          customerId,
          status: status as QuotationStatus,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          discountTotal: new Prisma.Decimal((Number(discountTotal) || 0).toFixed(2)),
          taxTotal: new Prisma.Decimal((Number(taxTotal) || 0).toFixed(2)),
          grandTotal: new Prisma.Decimal(grandTotal.toFixed(2)),
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
              unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
              discount: new Prisma.Decimal((item.discount || 0).toFixed(2)),
              total: new Prisma.Decimal(itemTotals[index].toFixed(2)),
            })),
          },
        },
        include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      });
    });

    return quotation;
  }

  async update(shopId: string, id: string, data: {
    customerId?: string;
    items?: QuotationItemInput[];
    status?: string;
    discountTotal?: number;
    taxTotal?: number;
    validityDate?: string;
    notes?: string;
    terms?: string;
  }) {
    const { customerId, items, status, discountTotal, taxTotal, validityDate, notes, terms } = data;

    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        shopId,
        OR: [{ id }, { quotationNumber: id }],
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
    const newDiscountTotal = discountTotal !== undefined ? Number(discountTotal) : Number(existingQuotation.discountTotal);
    const newTaxTotal = taxTotal !== undefined ? Number(taxTotal) : Number(existingQuotation.taxTotal);

    let validatedItems: QuotationItemInput[] | null = null;
    let itemTotals: number[] = [];
    let subtotal = Number(existingQuotation.subtotal);
    let grandTotal = Number(existingQuotation.grandTotal);

    if (items && items.length > 0) {
      // Batch-fetch all products once (kills N+1)
      const productIds = items.filter(i => i.productId).map(i => i.productId as string);
      const products = productIds.length > 0
        ? await prisma.product.findMany({ where: { id: { in: productIds } } })
        : [];
      const productMap = new Map(products.map(p => [p.id, p]));

      validatedItems = items.map(item => ({
        ...item,
        itemType: (item.itemType || 'PRODUCT') as QuotationItemType,
        productId: item.productId && productMap.has(item.productId) ? item.productId : null,
      }));
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
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          discountTotal: new Prisma.Decimal(newDiscountTotal.toFixed(2)),
          taxTotal: new Prisma.Decimal(newTaxTotal.toFixed(2)),
          grandTotal: new Prisma.Decimal(grandTotal.toFixed(2)),
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
                unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
                discount: new Prisma.Decimal((item.discount || 0).toFixed(2)),
                total: new Prisma.Decimal(itemTotals[index].toFixed(2)),
              })),
            },
          }),
        },
        include: { customer: true, items: { include: { product: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      });
    });

    return quotation;
  }

  async remove(shopId: string, id: string) {
    const quotation = await prisma.quotation.findFirst({
      where: {
        shopId,
        OR: [{ id }, { quotationNumber: id }],
      },
    });
    if (!quotation) throw new AppError(`Quotation not found with ID: ${id}`, 404);
    if (quotation.shopId !== shopId) throw new AppError('You do not have permission to delete this quotation', 403);

    await prisma.quotation.delete({ where: { id: quotation.id } });
  }

  async convertToInvoice(shopId: string, userId: string | undefined, id: string) {
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
          subtotal: new Prisma.Decimal(quotation.subtotal.toString()),
          tax: new Prisma.Decimal(quotation.taxTotal.toString()),
          discount: new Prisma.Decimal(quotation.discountTotal.toString()),
          total: new Prisma.Decimal(quotation.grandTotal.toString()),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(quotation.grandTotal.toString()),
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
              unitPrice: new Prisma.Decimal(item.unitPrice.toString()),
              originalPrice: new Prisma.Decimal(item.unitPrice.toString()),
              discount: new Prisma.Decimal(item.discount.toString()),
              total: new Prisma.Decimal(item.total.toString()),
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

      // 🔒 NEGATIVE STOCK PREVENTION: Use conditional updateMany with stock >= qty guard
      for (const item of quotation.items) {
        if (item.productId && item.product) {
          const result = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity }, totalSold: { increment: item.quantity } },
          });

          if (result.count === 0) {
            throw new AppError(
              `Insufficient stock for product "${item.product.name}" (id: ${item.productId}). Available stock is below the requested quantity of ${item.quantity}.`,
              400
            );
          }

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
                unitPrice: new Prisma.Decimal(item.unitPrice.toString()),
                shopId,
                createdBy: userId,
              },
            });
          }
        }
      }

      return { invoice, quotation: updatedQuotation };
    });

    return result;
  }

  async getStats(shopId: string) {
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

    return {
      totalQuotations,
      statusStats: statusCounts,
      revenue: {
        subtotal: Number(revenueStats._sum?.subtotal || 0),
        discountTotal: Number(revenueStats._sum?.discountTotal || 0),
        taxTotal: Number(revenueStats._sum?.taxTotal || 0),
        grandTotal: Number(revenueStats._sum?.grandTotal || 0),
        averageQuotationValue: Number(revenueStats._avg?.grandTotal || 0),
      },
      recentQuotations,
    };
  }
}

export const quotationService = new QuotationService();