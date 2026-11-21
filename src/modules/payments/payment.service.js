
import { ObjectId } from "mongodb";
import { getDB } from "../../config/db.js";
import { stripe } from "../../config/stripe.js";
import { env } from "../../config/env.js";

// Access the bookings collection
const getBookingCollection = () => getDB().collection("bookings");

// Create a Stripe Checkout Session for an approved booking
export const createCheckoutSession = async (bookingId, customer) => {
  if (!ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const bookings = getBookingCollection();

  // Only the booking customer can pay for an approved, unpaid booking
  const booking = await bookings.findOne({
    _id: new ObjectId(bookingId),
    customerId: customer.id,
    status: "approved_for_payment",
    paymentStatus: "unpaid",
    expiresAt: { $gt: new Date() },
  });

  if (!booking) {
    throw new Error(
      "Booking not found, not approved, already paid, or expired"
    );
  }

  // Reuse an existing open Checkout Session to avoid duplicate sessions
  if (booking.checkoutSessionId) {
    const existingSession = await stripe.checkout.sessions.retrieve(
      booking.checkoutSessionId
    );

    if (existingSession.status === "open" && existingSession.url) {
      return {
        checkoutUrl: existingSession.url,
        sessionId: existingSession.id,
      };
    }
  }

  // Calculate the amount from the trusted database record
  const amountInCents = Math.round(Number(booking.totalAmount) * 100);

  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new Error("Invalid booking payment amount");
  }

  // Keep the equipment reservation active while the customer completes payment.
  // Stripe Checkout supports a minimum custom expiration of 30 minutes.
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + 31 * 60;
  const reservationExpiresAt = new Date(expiresAtSeconds * 1000);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
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

  // Save the Stripe Session reference and extend the reservation
  await bookings.updateOne(
    {
      _id: booking._id,
      status: "approved_for_payment",
      paymentStatus: "unpaid",
    },
    {
      $set: {
        checkoutSessionId: session.id,
        expiresAt: reservationExpiresAt,
        updatedAt: new Date(),
      },
    }
  );

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
};
