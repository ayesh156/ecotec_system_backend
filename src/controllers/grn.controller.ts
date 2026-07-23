import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from '../types/express';
import { StockMovementType, GRNStatus, PaymentStatus, PriceChangeType } from '@prisma/client';
import { sendGRNWithPDF, GRNEmailData } from '../services/emailService';
import { generateGRNPDF, GRNPDFData } from '../services/pdfService';
import { getShopId } from '../lib/shopId';

// Helper to generate GRN Number
const generateGRNNumber = async (shopId: string): Promise<string> => {
  const count = await prisma.gRN.count({ where: { shopId } });
  const dateStr = new Date().getFullYear().toString();
  return `GRN-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;
};

// Create a new GRN with full stock/price effects
export const createGRN = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const userId = req.user?.id;

    const {
      supplierId, referenceNo, date, expectedDate, deliveryNote, vehicleNumber,
      receivedBy, receivedDate, items, discount = 0,
      tax = 0, notes, status: rawStatus = 'PENDING', paymentStatus: rawPaymentStatus = 'UNPAID',
    } = req.body;

    // Normalize enum values to uppercase for Prisma
    const status = (rawStatus as string).toUpperCase();
    const paymentStatus = (rawPaymentStatus as string).toUpperCase();

    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Supplier and items are required' });
    }

    // Validate supplier
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || supplier.shopId !== shopId) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    let subtotal = 0;
    const itemDetails: Array<{
      productId: string; quantity: number; costPrice: number;
      sellingPrice?: number; totalCost: number;
    }> = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.shopId !== shopId) {
        return res.status(404).json({ success: false, message: `Product ${item.productId} not found` });
      }
      const unitCost = item.costPrice || 0;
      const lineTotal = item.quantity * unitCost;
      subtotal += lineTotal;
      itemDetails.push({
        productId: item.productId, quantity: item.quantity,
        costPrice: unitCost, sellingPrice: item.sellingPrice, totalCost: lineTotal,
      });
    }

    const totalAmount = subtotal + tax - discount;
    const grnNumber = await generateGRNNumber(shopId);

    const grn = await prisma.$transaction(async (tx) => {
      const newGRN = await tx.gRN.create({
        data: {
          grnNumber, shopId, supplierId, referenceNo, discount, tax, subtotal,
          totalAmount, paidAmount: 0, status: status as GRNStatus,
          paymentStatus: paymentStatus as PaymentStatus, notes,
          date: date ? new Date(date) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : undefined,
          receivedDate: receivedDate ? new Date(receivedDate) : undefined,
          deliveryNote, vehicleNumber, receivedBy, createdById: userId || undefined,
          items: {
            create: itemDetails.map(item => ({
              productId: item.productId, quantity: item.quantity,
              costPrice: item.costPrice, sellingPrice: item.sellingPrice,
              totalCost: item.totalCost,
            })),
          },
        },
        include: { items: { include: { product: true } }, supplier: true },
      });

      // Update product stock/cost
      for (const item of itemDetails) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const updateData: any = {
          stock: { increment: item.quantity },
          totalPurchased: { increment: item.quantity },
          lastGRNDate: new Date(),
          lastGRNId: newGRN.id,
        };

        if (item.costPrice > 0) {
          updateData.lastCostPrice = product.costPrice;
          updateData.costPrice = item.costPrice;
          if (item.sellingPrice) updateData.price = item.sellingPrice;
        }

        await tx.product.update({ where: { id: item.productId }, data: updateData });

        // Stock movement record
        await tx.stockMovement.create({
          data: {
            productId: item.productId, type: 'GRN_IN', quantity: item.quantity,
            previousStock: product.stock, newStock: product.stock + item.quantity,
            referenceId: newGRN.id, referenceNumber: grnNumber, referenceType: 'grn',
            unitPrice: item.costPrice, shopId, createdBy: userId,
          },
        });

        // Price history record
        if (item.costPrice > 0 && (item.costPrice !== product.costPrice || item.sellingPrice !== product.price)) {
          await tx.priceHistory.create({
            data: {
              productId: item.productId, changeType: item.sellingPrice ? 'BOTH' : 'COST_UPDATE',
              previousCostPrice: product.costPrice, newCostPrice: item.costPrice,
              previousSellingPrice: product.price, newSellingPrice: item.sellingPrice || product.price,
              reason: 'grn_purchase', referenceId: newGRN.id, createdBy: userId, shopId,
            },
          });
        }
      }

      return newGRN;
    });

    res.status(201).json({ success: true, data: grn });
  } catch (error) { next(error); }
};

// Get all GRNs for the shop
export const getGRNs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { status: rawStatus, paymentStatus: rawPaymentStatus, supplierId, search, page = '1', limit = '20' } = req.query;

    // Normalize enum query params to uppercase for Prisma
    const status = rawStatus ? (rawStatus as string).toUpperCase() : undefined;
    const paymentStatus = rawPaymentStatus ? (rawPaymentStatus as string).toUpperCase() : undefined;

    const where: any = { shopId };
    if (status && status !== 'ALL') where.status = status;
    if (paymentStatus && paymentStatus !== 'ALL') where.paymentStatus = paymentStatus;
    if (supplierId && supplierId !== 'all') where.supplierId = supplierId;
    if (search) {
      where.OR = [
        { grnNumber: { contains: search as string } },
        { referenceNo: { contains: search as string } },
        { supplier: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [grns, total] = await Promise.all([
      prisma.gRN.findMany({
        where, orderBy: { date: 'desc' }, skip, take: limitNum,
        include: { supplier: { select: { id: true, name: true, phone: true } }, items: true, payments: true, _count: { select: { reminders: true } } },
      }),
      prisma.gRN.count({ where }),
    ]);

    res.json({ success: true, data: grns, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) { next(error); }
};

// Get GRN by ID
export const getGRNById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    let grn = await prisma.gRN.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { product: true } }, payments: { orderBy: { sentAt: 'desc' } }, reminders: { orderBy: { sentAt: 'desc' } } },
    });

    if (!grn) {
      grn = await prisma.gRN.findFirst({
        where: { OR: [{ grnNumber: id }, { grnNumber: { contains: id } }] },
        include: { supplier: true, items: { include: { product: true } }, payments: { orderBy: { sentAt: 'desc' } }, reminders: { orderBy: { sentAt: 'desc' } } },
      });
    }

    if (!grn) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (grn.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: grn });
  } catch (error) { next(error); }
};

// Update GRN
export const updateGRN = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const { status: rawStatus, paymentStatus: rawPaymentStatus, notes, paidAmount } = req.body;

    // Normalize enum values to uppercase for Prisma
    const status = rawStatus ? (rawStatus as string).toUpperCase() : undefined;
    const paymentStatus = rawPaymentStatus ? (rawPaymentStatus as string).toUpperCase() : undefined;

    const existing = await prisma.gRN.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    const updateData: any = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (paidAmount !== undefined) updateData.paidAmount = paidAmount;

    const grn = await prisma.gRN.update({ where: { id }, data: updateData });
    res.json({ success: true, data: grn });
  } catch (error) { next(error); }
};

// Delete GRN
export const deleteGRN = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.gRN.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity }, totalPurchased: { decrement: item.quantity } } });
      }
      await tx.gRN.delete({ where: { id: existing.id } });
    });

    res.json({ success: true, message: 'GRN deleted successfully' });
  } catch (error) { next(error); }
};

// Add payment to GRN
export const addGRNPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const { amount, paymentMethod, notes } = req.body;

    const existing = await prisma.gRN.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    const newPaidAmount = existing.paidAmount + amount;
    const newPaymentStatus = newPaidAmount >= existing.totalAmount ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    const [payment] = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.gRNPayment.create({
        data: { grnId: id, amount, paymentMethod, notes, shopId, recordedById: req.user?.id || undefined },
      });
      await tx.gRN.update({ where: { id }, data: { paidAmount: newPaidAmount, paymentStatus: newPaymentStatus as PaymentStatus } });
      return [newPayment];
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) { next(error); }
};

// Get GRN reminders
export const getGRNReminders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const existing = await prisma.gRN.findUnique({ where: { id }, select: { id: true, shopId: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    const reminders = await prisma.gRNReminder.findMany({ where: { grnId: id }, orderBy: { sentAt: 'desc' } });
    res.json({ success: true, data: reminders });
  } catch (error) { next(error); }
};

// Create GRN reminder
export const createGRNReminder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const { type, channel, message, supplierPhone, supplierName } = req.body;

    const existing = await prisma.gRN.findUnique({ where: { id }, select: { id: true, shopId: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (existing.shopId !== shopId) return res.status(403).json({ success: false, message: 'Access denied' });

    const reminder = await prisma.gRNReminder.create({
      data: { grnId: id, shopId, type: (type || 'PAYMENT').toUpperCase(), channel: channel || 'whatsapp', message, supplierPhone, supplierName },
    });

    res.status(201).json({ success: true, data: reminder });
  } catch (error) { next(error); }
};

// Send GRN email
export const sendGRNEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;
    const { pdfBase64, includeAttachment } = req.body;

    const grn = await prisma.gRN.findFirst({
      where: { OR: [{ id }, { grnNumber: id }, { grnNumber: { contains: id } }], shopId },
      include: { supplier: true, shop: true, items: { include: { product: true } } },
    });

    if (!grn) return res.status(404).json({ success: false, message: 'GRN not found' });
    if (!grn.supplier?.email) return res.status(400).json({ success: false, message: 'Supplier does not have an email address' });

    const grnItems = grn.items.map(item => ({
      productName: item.product?.name || 'Unknown Product',
      quantity: item.quantity,
      costPrice: Number(item.costPrice),
      total: Number(item.totalCost),
    }));

    const emailData: GRNEmailData = {
      email: grn.supplier.email, supplierName: grn.supplier.name, grnNumber: grn.grnNumber,
      date: grn.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      items: grnItems, subtotal: Number(grn.subtotal), tax: Number(grn.tax),
      discount: Number(grn.discount), totalAmount: Number(grn.totalAmount),
      paidAmount: Number(grn.paidAmount), balanceDue: Number(grn.totalAmount - grn.paidAmount),
      paymentStatus: grn.paymentStatus,
      shopName: grn.shop?.name || 'Our Store', shopPhone: grn.shop?.phone || undefined,
      shopEmail: grn.shop?.email || undefined, shopAddress: grn.shop?.address || undefined,
      shopWebsite: grn.shop?.website || undefined, notes: grn.notes || undefined,
    };

    const shouldIncludePdf = includeAttachment !== false && !!pdfBase64;
    const result = await sendGRNWithPDF(emailData, shouldIncludePdf ? pdfBase64 : undefined);

    if (!result.success) {
      return res.status(500).json({ success: false, message: `Failed to send email: ${result.error || 'Unknown error'}` });
    }

    res.status(200).json({ success: true, message: 'GRN email sent successfully', data: { messageId: result.messageId, sentTo: grn.supplier.email, grnNumber: grn.grnNumber } });
  } catch (error) { next(error); }
};

// Download GRN PDF
export const downloadGRNPDF = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId();
    const { id } = req.params;

    const grn = await prisma.gRN.findFirst({
      where: { OR: [{ id }, { grnNumber: id }, { grnNumber: { contains: id } }], shopId },
      include: { supplier: true, shop: true, items: { include: { product: true } } },
    });

    if (!grn) return res.status(404).json({ success: false, message: 'GRN not found' });

    const totalQuantity = grn.items.reduce((sum, item) => sum + item.quantity, 0);

    const pdfData: GRNPDFData = {
      grnNumber: grn.grnNumber, supplierName: grn.supplier.name, supplierPhone: grn.supplier.phone || undefined,
      orderDate: grn.date.toISOString(),
      expectedDeliveryDate: grn.expectedDate?.toISOString() || '',
      receivedDate: grn.receivedDate?.toISOString() || '',
      deliveryNote: grn.deliveryNote || undefined,
      receivedBy: grn.receivedBy || undefined,
      vehicleNumber: grn.vehicleNumber || undefined,
      status: grn.status.toLowerCase() as 'completed' | 'partial' | 'pending' | 'rejected',
      paymentStatus: grn.paymentStatus.toLowerCase() as 'paid' | 'unpaid' | 'partial',
      items: grn.items.map(item => ({
        productName: item.product?.name || 'Unknown Product',
        unitPrice: Number(item.costPrice),
        orderedQuantity: item.quantity,
        receivedQuantity: item.quantity,
        acceptedQuantity: item.quantity,
        rejectedQuantity: 0,
        totalAmount: Number(item.totalCost),
      })),
      totalOrderedQuantity: totalQuantity,
      totalReceivedQuantity: totalQuantity,
      totalAcceptedQuantity: totalQuantity,
      totalRejectedQuantity: 0,
      subtotal: Number(grn.subtotal), discountAmount: Number(grn.discount),
      taxAmount: Number(grn.tax), totalAmount: Number(grn.totalAmount),
      paidAmount: Number(grn.paidAmount),
      notes: grn.notes || undefined,
      shopName: grn.shop?.name || 'Shop', shopSubName: grn.shop?.subName || undefined,
      shopAddress: grn.shop?.address || undefined, shopPhone: grn.shop?.phone || undefined,
      shopEmail: grn.shop?.email || undefined, shopLogo: grn.shop?.logo || undefined,
    };

    const pdfBuffer = await generateGRNPDF(pdfData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="GRN-${grn.grnNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
};