import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

import { getDB } from "../../config/db.js";
import { stripe } from "../../config/stripe.js";

// ============================================
// CREATE STRIPE REFUND
// ============================================

export const createRefund = async (refundData, admin) => {
  const db = getDB();

  const payments = db.collection("payments");
  const refunds = db.collection("refunds");

  const { paymentId, amountCents, reason, note } = refundData;

  // Validate payment ID
  if (!ObjectId.isValid(paymentId)) {
    throw new Error("Invalid payment ID");
  }

  // Find original payment
  const payment = await payments.findOne({
    _id: new ObjectId(paymentId),
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  // Only paid payments can be refunded
  if (!["paid", "partially_refunded"].includes(payment.status)) {
    throw new Error("This payment is not eligible for a refund");
  }

  // Stripe Payment Intent is required
  if (!payment.stripePaymentIntentId) {
    throw new Error("Stripe Payment Intent not found");
  }

  const originalAmount = Number(payment.amountCents);

  if (!Number.isSafeInteger(originalAmount) || originalAmount <= 0) {
    throw new Error("Invalid original payment amount");
  }

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid refund amount");
  }

  // Generate a unique idempotency key
  const requestId = randomUUID();

  // ============================================
  // RESERVE REFUNDABLE AMOUNT
  // ============================================

  // Atomic update prevents concurrent over-refunding
  const reservation = await payments.updateOne(
    {
      _id: payment._id,
      status: { $in: ["paid", "partially_refunded"] },
      $expr: {
        $lte: [
          {
            $add: [
              { $ifNull: ["$refundedAmountCents", 0] },
              { $ifNull: ["$refundReservedCents", 0] },
              amountCents,
            ],
          },
          "$amountCents",
        ],
      },
    },
    {
      $inc: {
        refundReservedCents: amountCents,
      },
      $set: {
        updatedAt: new Date(),
      },
    },
  );

  if (reservation.modifiedCount !== 1) {
    throw new Error("Refund amount exceeds the remaining refundable balance");
  }

  let refundRecord;

  try {
    // ============================================
    // SAVE PENDING REFUND REQUEST
    // ============================================

    const refundDocument = {
      paymentId: payment._id.toString(),
      bookingId: payment.bookingId,
      customerId: payment.customerId,
      ownerId: payment.ownerId,

      stripeRefundId: null,
      requestId,

      amountCents,
      currency: payment.currency || "usd",

      reason,
      note,

      status: "pending",
      adminId: admin.id,

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await refunds.insertOne(refundDocument);

    refundRecord = {
      ...refundDocument,
      _id: result.insertedId,
    };

    // ============================================
    // CREATE STRIPE REFUND
    // ============================================

    const stripeRefund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        amount: amountCents,
        reason,
        metadata: {
          paymentId: payment._id.toString(),
          bookingId: String(payment.bookingId),
          refundRequestId: requestId,
          adminId: String(admin.id),
        },
      },
      {
        idempotencyKey: requestId,
      },
    );

    // Save Stripe response
    // Save Stripe response
    await refunds.updateOne(
      { _id: refundRecord._id },
      {
        $set: {
          stripeRefundId: stripeRefund.id,
          stripeStatus: stripeRefund.status,
          updatedAt: new Date(),
        },
      },
    );

    // Release reservation only if Stripe reports failure
    if (
      stripeRefund.status === "failed" ||
      stripeRefund.status === "canceled"
    ) {
      await payments.updateOne(
        { _id: payment._id },
        {
          $inc: {
            refundReservedCents: -amountCents,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
      );
    }

    return {
      message: "Refund request submitted successfully",
      refund: {
        id: refundRecord._id,
        stripeRefundId: stripeRefund.id,
        amountCents,
        status: stripeRefund.status,
        currency: payment.currency || "usd",
      },
    };
  } catch (error) {
    // ============================================
    // HANDLE STRIPE OR DATABASE FAILURE
    // ============================================

    // Do not release the reservation if Stripe may
    // have accepted the request but its response was lost.
    if (!refundRecord) {
      await payments.updateOne(
        { _id: payment._id },
        {
          $inc: {
            refundReservedCents: -amountCents,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
      );
    } else {
      // Keep the reservation until the Stripe result
      // is reconciled if the Stripe outcome is uncertain.
      await refunds.updateOne(
        { _id: refundRecord._id },
        {
          $set: {
            errorMessage: error.message,
            updatedAt: new Date(),
          },
        },
      );
    }

    throw error;
  }
};
