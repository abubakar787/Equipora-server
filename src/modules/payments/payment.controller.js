import { ObjectId } from "mongodb";

import { client, getDB } from "../../config/db.js";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";

import { createCheckoutSession, getPaymentHistory } from "./payment.service.js";

import { calculateRentalCommission } from "./financial.service.js";

// ============================================
// 1. CREATE STRIPE CHECKOUT SESSION
// ============================================

export const createCheckoutSessionController = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const result = await createCheckoutSession(bookingId, req.user);

    return res.status(200).json({
      success: true,
      message: "Stripe Checkout Session created successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================
// 2. FIND INTERNAL REFUND RECORD
// ============================================

const findRefundRecord = async (db, stripeRefund, session) => {
  const refunds = db.collection("refunds");

  const requestId = stripeRefund.metadata?.refundRequestId;

  const query = requestId ? { requestId } : { stripeRefundId: stripeRefund.id };

  return refunds.findOne(query, { session });
};

// ============================================
// 3. PROCESS SUCCESSFUL REFUND
// ============================================

const processSuccessfulRefund = async (stripeRefund) => {
  const db = getDB();
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const refunds = db.collection("refunds");
      const payments = db.collection("payments");
      const bookings = db.collection("bookings");

      const refundRecord = await findRefundRecord(db, stripeRefund);

      if (!refundRecord) {
        throw new Error(`Refund record not found: ${stripeRefund.id}`);
      }

      // Already processed: do not apply the refund twice.
      if (refundRecord.status === "succeeded") {
        return;
      }

      if (["failed", "canceled"].includes(refundRecord.status)) {
        throw new Error("A failed or canceled refund cannot succeed");
      }

      if (!ObjectId.isValid(refundRecord.paymentId)) {
        throw new Error("Invalid original payment reference");
      }

      const payment = await payments.findOne(
        { _id: new ObjectId(refundRecord.paymentId) },
        { session },
      );

      if (!payment) {
        throw new Error("Original payment not found");
      }

      const refundAmountCents = Number(stripeRefund.amount);
      const originalAmountCents = Number(payment.amountCents);

      const originalCommissionCents = Number(payment.commissionCents);

      const originalOwnerEarningsCents = Number(payment.ownerEarningsCents);

      if (
        !Number.isSafeInteger(refundAmountCents) ||
        refundAmountCents <= 0 ||
        refundAmountCents !== Number(refundRecord.amountCents) ||
        !Number.isSafeInteger(originalAmountCents) ||
        originalAmountCents <= 0 ||
        !Number.isSafeInteger(originalCommissionCents) ||
        !Number.isSafeInteger(originalOwnerEarningsCents)
      ) {
        throw new Error("Invalid refund or payment amounts");
      }

      const previousRefundedAmount = Number(payment.refundedAmountCents || 0);

      const previousRefundedCommission = Number(
        payment.refundedCommissionCents || 0,
      );

      const previousRefundedOwnerEarnings = Number(
        payment.refundedOwnerEarningsCents || 0,
      );

      const previousReservedAmount = Number(payment.refundReservedCents || 0);

      if (previousReservedAmount < refundAmountCents) {
        throw new Error("Refund reservation is missing or insufficient");
      }

      const newRefundedAmount = previousRefundedAmount + refundAmountCents;

      if (newRefundedAmount > originalAmountCents) {
        throw new Error("Refund exceeds original payment amount");
      }

      // Calculate cumulative proportional adjustments.
      const newRefundedCommission =
        newRefundedAmount === originalAmountCents
          ? originalCommissionCents
          : Math.round(
              (originalCommissionCents * newRefundedAmount) /
                originalAmountCents,
            );

      const newRefundedOwnerEarnings =
        newRefundedAmount === originalAmountCents
          ? originalOwnerEarningsCents
          : Math.round(
              (originalOwnerEarningsCents * newRefundedAmount) /
                originalAmountCents,
            );

      const isFullyRefunded = newRefundedAmount === originalAmountCents;

      // Conditional update protects against concurrent processing.
      const paymentUpdate = await payments.updateOne(
        {
          _id: payment._id,
          $expr: {
            $eq: [
              { $ifNull: ["$refundedAmountCents", 0] },
              previousRefundedAmount,
            ],
          },
        },
        {
          $set: {
            refundedAmountCents: newRefundedAmount,
            refundedCommissionCents: newRefundedCommission,
            refundedOwnerEarningsCents: newRefundedOwnerEarnings,
            refundReservedCents: previousReservedAmount - refundAmountCents,
            refundStatus: isFullyRefunded ? "full" : "partial",
            status: isFullyRefunded ? "refunded" : "partially_refunded",
            updatedAt: new Date(),
          },
        },
        { session },
      );

      if (paymentUpdate.modifiedCount !== 1) {
        throw new Error("Concurrent payment refund update detected");
      }

      // Update booking payment status.
      const bookingUpdate = await bookings.updateOne(
        { _id: payment.bookingId },
        {
          $set: {
            paymentStatus: isFullyRefunded ? "refunded" : "partially_refunded",
            refundedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { session },
      );

      if (bookingUpdate.matchedCount !== 1) {
        throw new Error("Original booking not found for refund");
      }

      // Finalize the refund record in the same transaction.
      const refundUpdate = await refunds.updateOne(
        {
          _id: refundRecord._id,
          status: { $nin: ["succeeded", "failed", "canceled"] },
        },
        {
          $set: {
            status: "succeeded",
            stripeStatus: "succeeded",
            stripeRefundId: stripeRefund.id,
            updatedAt: new Date(),
          },
        },
        { session },
      );

      if (refundUpdate.modifiedCount !== 1) {
        throw new Error("Refund record could not be finalized");
      }
    });

    console.log("Stripe refund processed:", stripeRefund.id);
  } finally {
    await session.endSession();
  }
};

// ============================================
// 4. PROCESS FAILED OR CANCELED REFUND
// ============================================

const processFailedRefund = async (stripeRefund) => {
  const db = getDB();
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const refunds = db.collection("refunds");
      const payments = db.collection("payments");

      const refundRecord = await findRefundRecord(db, stripeRefund);

      if (!refundRecord) {
        throw new Error(`Refund record not found: ${stripeRefund.id}`);
      }

      if (["succeeded", "failed", "canceled"].includes(refundRecord.status)) {
        return;
      }

      if (!ObjectId.isValid(refundRecord.paymentId)) {
        throw new Error("Invalid original payment reference");
      }

      const payment = await payments.findOne(
        { _id: new ObjectId(refundRecord.paymentId) },
        { session },
      );

      if (!payment) {
        throw new Error("Original payment not found");
      }

      const reservedAmount = Number(payment.refundReservedCents || 0);

      const refundAmount = Number(refundRecord.amountCents);

      if (
        !Number.isSafeInteger(refundAmount) ||
        refundAmount <= 0 ||
        reservedAmount < refundAmount
      ) {
        throw new Error("Invalid refund reservation");
      }

      const paymentUpdate = await payments.updateOne(
        {
          _id: payment._id,
          $expr: {
            $gte: [{ $ifNull: ["$refundReservedCents", 0] }, refundAmount],
          },
        },
        {
          $set: {
            refundReservedCents: reservedAmount - refundAmount,
            updatedAt: new Date(),
          },
        },
        { session },
      );

      if (paymentUpdate.modifiedCount !== 1) {
        throw new Error("Could not release refund reservation");
      }

      const refundUpdate = await refunds.updateOne(
        {
          _id: refundRecord._id,
          status: { $nin: ["succeeded", "failed", "canceled"] },
        },
        {
          $set: {
            status: stripeRefund.status,
            stripeStatus: stripeRefund.status,
            stripeRefundId: stripeRefund.id,
            updatedAt: new Date(),
          },
        },
        { session },
      );

      if (refundUpdate.modifiedCount !== 1) {
        throw new Error("Could not update failed refund record");
      }
    });

    console.log("Stripe refund failure processed:", stripeRefund.id);
  } finally {
    await session.endSession();
  }
};

// ============================================
// 5. STRIPE WEBHOOK
// ============================================

export const stripeWebhookController = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;

  // Verify Stripe webhook signature.
  try {
    if (!signature || !env.stripeWebhookSecret) {
      return res.status(400).send("Webhook configuration is missing");
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripeWebhookSecret,
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    const db = getDB();

    const bookings = db.collection("bookings");
    const payments = db.collection("payments");

    // ============================================
    // 5A. SUCCESSFUL PAYMENT
    // ============================================

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const stripeSession = event.data.object;

      if (stripeSession.payment_status !== "paid") {
        return res.status(200).json({ received: true });
      }

      const bookingId = stripeSession.metadata?.bookingId;
      const customerId = stripeSession.metadata?.customerId;

      if (!ObjectId.isValid(bookingId || "") || !customerId) {
        return res.status(400).send("Invalid booking reference");
      }

      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
        customerId,
        checkoutSessionId: stripeSession.id,
      });

      if (!booking) {
        return res.status(400).send("Matching booking was not found");
      }

      const financialBreakdown = await calculateRentalCommission(
        Number(booking.totalAmount),
      );

      const rentalAmountCents = financialBreakdown.rentalAmountCents;

      if (
        !Number.isSafeInteger(rentalAmountCents) ||
        rentalAmountCents <= 0 ||
        stripeSession.currency !== "usd" ||
        stripeSession.amount_total !== rentalAmountCents
      ) {
        return res.status(400).send("Payment amount verification failed");
      }

      // Atomically confirm booking and create payment record.
      const paymentSession = client.startSession();

      try {
        await paymentSession.withTransaction(async () => {
          const currentBooking = await bookings.findOne(
            {
              _id: booking._id,
              checkoutSessionId: stripeSession.id,
            },
            { session: paymentSession },
          );

          if (!currentBooking) {
            throw new Error("Booking not found during payment processing");
          }

          // Duplicate webhook: payment already recorded.
          const existingPayment = await payments.findOne(
            { stripeSessionId: stripeSession.id },
            { session: paymentSession },
          );

          if (existingPayment) {
            return;
          }

          if (
            currentBooking.paymentStatus !== "unpaid" ||
            currentBooking.status !== "approved_for_payment"
          ) {
            throw new Error("Booking is not eligible for payment confirmation");
          }

          await bookings.updateOne(
            { _id: booking._id },
            {
              $set: {
                status: "confirmed",
                paymentStatus: "paid",
                paidAt: new Date(),
                currency: financialBreakdown.currency,
                commissionRate: financialBreakdown.commissionRate,
                commissionCents: financialBreakdown.commissionCents,
                ownerEarningsCents: financialBreakdown.ownerEarningsCents,
                updatedAt: new Date(),
              },
            },
            { session: paymentSession },
          );

          await payments.insertOne(
            {
              bookingId: booking._id,
              customerId,
              ownerId: booking.ownerId,

              stripeSessionId: stripeSession.id,
              stripePaymentIntentId:
                typeof stripeSession.payment_intent === "string"
                  ? stripeSession.payment_intent
                  : stripeSession.payment_intent?.id || null,

              amountCents: financialBreakdown.rentalAmountCents,

              commissionRate: financialBreakdown.commissionRate,
              commissionCents: financialBreakdown.commissionCents,
              ownerEarningsCents: financialBreakdown.ownerEarningsCents,

              refundedAmountCents: 0,
              refundedCommissionCents: 0,
              refundedOwnerEarningsCents: 0,
              refundReservedCents: 0,
              refundStatus: "none",

              currency: financialBreakdown.currency,
              status: "paid",
              paymentMethod: "card",
              createdAt: new Date(),
            },
            { session: paymentSession },
          );
        });
      } finally {
        await paymentSession.endSession();
      }
    }

    // ============================================
    // 5B. ASYNCHRONOUS PAYMENT FAILURE
    // ============================================

    if (event.type === "checkout.session.async_payment_failed") {
      const stripeSession = event.data.object;

      await bookings.updateOne(
        {
          checkoutSessionId: stripeSession.id,
          paymentStatus: "unpaid",
        },
        {
          $set: {
            lastPaymentAttemptStatus: "failed",
            updatedAt: new Date(),
          },
        },
      );
    }

    // ============================================
    // 5C. EXPIRED CHECKOUT SESSION
    // ============================================

    if (event.type === "checkout.session.expired") {
      const stripeSession = event.data.object;

      await bookings.updateOne(
        {
          checkoutSessionId: stripeSession.id,
          paymentStatus: "unpaid",
          status: "approved_for_payment",
        },
        {
          $set: {
            status: "expired",
            updatedAt: new Date(),
          },
        },
      );
    }

    // ============================================
    // 5D. REFUND CREATED / UPDATED
    // ============================================

    if (event.type === "refund.created" || event.type === "refund.updated") {
      const stripeRefund = event.data.object;

      if (stripeRefund.status === "succeeded") {
        await processSuccessfulRefund(stripeRefund);
      } else if (
        stripeRefund.status === "failed" ||
        stripeRefund.status === "canceled"
      ) {
        await processFailedRefund(stripeRefund);
      }
    }

    // ============================================
    // 5E. REFUND FAILED
    // ============================================

    if (event.type === "refund.failed") {
      await processFailedRefund(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    // A 500 response allows Stripe to retry the webhook.
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// ============================================
// 6. PAYMENT HISTORY
// ============================================

export const getPaymentHistoryController = async (req, res, next) => {
  try {
    const result = await getPaymentHistory(req.user);

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
