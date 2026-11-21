
import Stripe from "stripe";
import { env } from "./env.js";

// Initialize Stripe using the secret key stored in environment variables
export const stripe = new Stripe(env.stripeSecretKey);
