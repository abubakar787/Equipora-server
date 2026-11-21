
import Stripe from "stripe";
import { env } from "./env.js";

// Initialize Stripe using the secret key from environment variables.
// Never expose this Stripe instance or secret key to the frontend.
export const stripe = new Stripe(env.stripeSecretKey);
