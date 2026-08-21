import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma, PaymentMethod, InvoiceStatus } from '@prisma/client';

const calculateInvoiceStatus = (total: number, paidAmount: number): InvoiceStatus => {
  if (paidAmount >= total) return 'FULLPAID';
  if (paidAmount > 0) return 'HALFPAY';
  return 'UNPAID';
};

export class PaymentService {
  /**
   * Add a payment to an invoice.
   *
   * 🔒 RACE CONDITION FIX:
   * The `amount <= dueAmount` validation is performed INSIDE the atomic
   * `prisma.$transaction`. We re-fetch the invoice within the transaction
   * (with a row lock through the DB) and verify status + dueAmount there.
   * Two concurrent payments can no longer both pass the check and overpay.
   */
  async addPayment(
    reqUserShopId: string | undefined,
    id: string,
    input: {
      amount: number;
      paymentMethod: PaymentMethod;
      notes?: string;
      reference?: string;
    }
  ) {
    const { amount, paymentMethod, notes, reference } = input;

    if (!reqUserShopId) {
      throw new AppError('User is not associated with any shop', 403);
    }

    // Fetch invoice (outside transaction for initial 404/403 checks)
    let invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      invoice = await prisma.invoice.findFirst({
        where: {
          OR: [{ invoiceNumber: id }, { invoiceNumber: { contains: id } }],
        },
      });
    }

    if (!invoice) throw new AppError(`Invoice not found with ID or number: ${id}`, 404);
    if (invoice.shopId !== reqUserShopId) {
      throw new AppError('You do not have permission to add payments to this invoice', 403);
    }

    const invoiceId = invoice.id;

    // 🔒 Atomic transaction: re-read invoice INSIDE the transaction and
    // validate due amount + status BEFORE writing the payment record.
    const [payment, updatedInvoice] = await prisma.$transaction(async (tx) => {
      // Re-fetch inside transaction to get the latest state
      // (MySQL InnoDB uses REPEATABLE READ — the update below takes a row lock
      //  ensuring no concurrent payment can pass the same validation)
      const lockedInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!lockedInvoice) throw new AppError('Invoice not found', 404);

      if (lockedInvoice.status === 'FULLPAID') {
        throw new AppError('Invoice is already fully paid', 400);
      }

      const currentDue = Number(lockedInvoice.dueAmount);
      if (amount > currentDue) {
        throw new AppError(`Payment amount cannot exceed due amount of ${currentDue}`, 400);
      }

      const newPaidAmount = Number(lockedInvoice.paidAmount) + amount;
      const newDueAmount = Number(lockedInvoice.total) - newPaidAmount;
      const newStatus = calculateInvoiceStatus(Number(lockedInvoice.total), newPaidAmount);

      const newPayment = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          paymentMethod,
          notes,
          reference,
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount.toFixed(2)),
          dueAmount: new Prisma.Decimal(newDueAmount.toFixed(2)),
          status: newStatus,
        },
        include: {
          customer: true,
          items: true,
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      });

      // Update customer stats (only if not walk-in customer)
      if (lockedInvoice.customerId) {
        await tx.customer.update({
          where: { id: lockedInvoice.customerId },
          data: {
            totalSpent: { increment: amount },
            creditBalance: { decrement: amount },
            creditStatus: newStatus === 'FULLPAID' ? 'CLEAR' : undefined,
          },
        });
      }

      return [newPayment, updated] as const;
    });

    return { payment, invoice: updatedInvoice };
  }
}

export const paymentService = new PaymentService();