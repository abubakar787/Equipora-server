
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";

const getBookingCollection = () =>
  getDB().collection("bookings");

const PAYMENT_RESERVATION_MINUTES = 31;

// ============================================
// HELPER: SAVE PAYMENT DEADLINE
// ============================================

const savePaymentDeadline = async (
  bookings,
  bookingId,
  sessionId,
  paymentExpiresAt
) => {
  const result = await bookings.updateOne(
    {
      _id: bookingId,
      status: "approved_for_payment",
      paymentStatus: "unpaid",
    },
    {
      $set: {
        checkoutSessionId: sessionId,
        paymentExpiresAt,
        expiresAt: paymentExpiresAt,
        updatedAt: new Date(),
      },
    }
  );

  if (result.matchedCount === 0) {
    throw new Error(
      "Booking status changed before payment session could be saved"
    );
  }
};

// ============================================
// CREATE STRIPE CHECKOUT SESSION
// ============================================

export const createCheckoutSession = async (
  bookingId,
  customer
) => {
  if (!ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const bookings = getBookingCollection();
  const bookingObjectId = new ObjectId(bookingId);
  const now = new Date();

  // 1. Find an approved, unpaid booking.
  const booking = await bookings.findOne({
    _id: bookingObjectId,
    customerId: customer.id,
    status: "approved_for_payment",
    paymentStatus: "unpaid",

    $or: [
      {
        paymentExpiresAt: { $gt: now },
      },
      {
        paymentExpiresAt: { $exists: false },
        expiresAt: { $gt: now },
      },
    ],
  });

  if (!booking) {
    throw new Error(
      "Booking not found, not approved, already paid, or payment deadline expired"
    );
  }

  // 2. Reuse an existing open Stripe Checkout Session.
  if (booking.checkoutSessionId) {
    const existingSession =
      await stripe.checkout.sessions.retrieve(
        booking.checkoutSessionId
      );

    if (
      existingSession.status === "open" &&
      existingSession.url
    ) {
      const existingExpiry = existingSession.expires_at
        ? new Date(existingSession.expires_at * 1000)
        : null;

      if (
        existingExpiry &&
        existingExpiry.getTime() > Date.now()
      ) {
        await savePaymentDeadline(
          bookings,
          booking._id,
          existingSession.id,
          existingExpiry
        );

        return {
          checkoutUrl: existingSession.url,
          sessionId: existingSession.id,
        };
      }
    }

    // Prevent duplicate sessions while completed
    // payment is being processed.
    if (existingSession.status === "complete") {
      throw new Error(
        "This payment session has already been completed. Please refresh your bookings."
      );
    }
  }

  // 3. Calculate amount from trusted database data.
  const amountInCents = Math.round(
    Number(booking.totalAmount) * 100
  );

  if (
    !Number.isSafeInteger(amountInCents) ||
    amountInCents <= 0
  ) {
    throw new Error("Invalid booking payment amount");
  }

  // 4. Create Stripe Checkout expiry.
  // Stripe requires at least 30 minutes for custom expiry.
  const expiresAtSeconds =
    Math.floor(Date.now() / 1000) +
    PAYMENT_RESERVATION_MINUTES * 60;

  const paymentExpiresAt = new Date(
    expiresAtSeconds * 1000
  );

  // 5. Create Stripe Checkout Session.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",

    // Updated for the current Stripe API version.
 
managed_payments: {
  enabled: false,
},
    line_items: [
      {
        price_data: {
          currency: "usd",

          product_data: {
            name: booking.equipmentTitle,

            description: `EQUIPORA equipment rental - ${booking.rentalUnits} ${booking.rentalType} unit(s)`,
          },

          unit_amount: amountInCents,
        },

        quantity: 1,
      },
    ],

    metadata: {
      bookingId: booking._id.toString(),
      customerId: customer.id,
    },

    client_reference_id: booking._id.toString(),

    success_url: `${env.clientUrl}/dashboard/bookings?payment=success&session_id={CHECKOUT_SESSION_ID}`,

    cancel_url: `${env.clientUrl}/dashboard/bookings?payment=cancelled`,

    expires_at: expiresAtSeconds,
  });

  // 6. Save Stripe session and payment deadline.
  try {
    await savePaymentDeadline(
      bookings,
      booking._id,
      session.id,
      paymentExpiresAt
    );
  } catch (error) {
    // Prevent an orphaned open Checkout Session.
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Preserve the original database error.
    }

    throw error;
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
};

// ============================================
// GET PAYMENT HISTORY
// ============================================

export const getPaymentHistory = async (user) => {
  const payments = getDB().collection("payments");

  let query = {};

  // Customers can see only their own payments.
  if (user.role === "customer") {
    query.customerId = user.id;
  }

  // Owners can see payments for their equipment.
  else if (user.role === "owner") {
    query.ownerId = user.id;
  }

  // Admins can see all platform payments.
  else if (user.role !== "admin") {
    throw new Error(
      "You are not allowed to view payment history"
    );
  }

  const [data, total] = await Promise.all([
    payments
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),

    payments.countDocuments(query),
  ]);

  return {
    total,
    data,
  };
};
