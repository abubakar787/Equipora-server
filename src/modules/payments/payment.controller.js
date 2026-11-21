
import { createCheckoutSession } from "./payment.service.js";
// MongoDB, Stripe and environment configuration
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";
// Import payment history service
import { getPaymentHistory } from "./payment.service.js";




// Create a Stripe Checkout Session for the logged-in customer
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

// Verify Stripe webhook and process payment events securely
export const stripeWebhookController = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;

  // Verify that the request genuinely came from Stripe
  try {
    if (!signature || !env.stripeWebhookSecret) {
      return res.status(400).send("Webhook configuration is missing");
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripeWebhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    const db = getDB();
    const bookings = db.collection("bookings");
    const payments = db.collection("payments");

    // Handle successful Checkout payments
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;

      // Wait if the Checkout Session is not paid yet
      if (session.payment_status !== "paid") {
        return res.status(200).json({ received: true });
      }

      const bookingId = session.metadata?.bookingId;
      const customerId = session.metadata?.customerId;

      if (!ObjectId.isValid(bookingId || "")) {
        return res.status(400).send("Invalid booking reference");
      }

      // Find the booking associated with this Stripe session
      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
        customerId,
        checkoutSessionId: session.id,
      });

      if (!booking) {
        return res.status(400).send("Matching booking was not found");
      }

      // Confirm the amount and currency against the server-side booking
      const expectedAmountCents = Math.round(
        Number(booking.totalAmount) * 100
      );

      if (
        session.currency !== "usd" ||
        session.amount_total !== expectedAmountCents
      ) {
        console.error("Stripe payment amount or currency mismatch");
        return res.status(400).send("Payment amount verification failed");
      }

      // Mark the booking as paid; repeated webhook deliveries cannot pay it twice
      const bookingUpdate = await bookings.updateOne(
        {
          _id: booking._id,
          checkoutSessionId: session.id,
          paymentStatus: "unpaid",
          status: "approved_for_payment",
        },
        {
          $set: {
            status: "confirmed",
            paymentStatus: "paid",
            paidAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      // If already paid, accept the duplicate event without creating another payment
      const alreadyPaid = await bookings.findOne({
        _id: booking._id,
        paymentStatus: "paid",
        checkoutSessionId: session.id,
      });

      if (bookingUpdate.modifiedCount === 0 && !alreadyPaid) {
        return res.status(409).send("Booking could not be confirmed");
      }

      // Store one payment record per Stripe Checkout Session
      await payments.updateOne(
        { stripeSessionId: session.id },
        {
          $setOnInsert: {
            bookingId: booking._id,
            customerId,
            ownerId: booking.ownerId,
            stripeSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id || null,
            amountCents: session.amount_total,
            currency: session.currency,
            status: "paid",
            paymentMethod: "card",
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // Record an unsuccessful asynchronous payment attempt without confirming the booking
    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;

      await bookings.updateOne(
        { checkoutSessionId: session.id, paymentStatus: "unpaid" },
        {
          $set: {
            lastPaymentAttemptStatus: "failed",
            updatedAt: new Date(),
          },
        }
      );
    }

    // Expire the booking reservation when its Checkout Session expires
    if (event.type === "checkout.session.expired") {
      const session = event.data.object;

      await bookings.updateOne(
        {
          checkoutSessionId: session.id,
          paymentStatus: "unpaid",
          status: "approved_for_payment",
        },
        {
          $set: {
            status: "expired",
            updatedAt: new Date(),
          },
        }
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    // Return an error so Stripe can retry processing the event
    console.error("Stripe webhook processing failed:", error);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};

// Return payment history for the authenticated user
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