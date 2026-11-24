# EQUIPORA — Backend API

**Rent Smarter. Build Better.**

EQUIPORA is an equipment rental platform. This repository contains the backend REST API responsible for application data, authentication, authorization, booking management, and payment processing.

## Live API

- **Production API:** https://equipora-server-chi.vercel.app/
- **Health Check:** https://equipora-server-chi.vercel.app/api/health
- **Frontend:** https://equipora-client-gules.vercel.app/

## Core Features

- Equipment management.
- Category management.
- Rental booking workflow.
- Customer, owner, and admin operations.
- Better Auth integration.
- JWT authentication.
- Role-based authorization.
- User and profile management.
- Customer favorites.
- Equipment reviews and ratings.
- Expense management.
- Admin dashboard operations.
- Stripe Checkout integration.
- Payment history.
- Refund management.
- Stripe webhook processing.
- MongoDB database integration.

## Technology Stack

- Node.js
- Express.js 5
- JavaScript (ES Modules)
- MongoDB Native Driver
- Better Auth
- MongoDB Adapter
- JWT / JOSE
- Stripe
- Zod
- Helmet
- CORS
- Morgan
- Nodemailer
- Vercel

## Project Architecture

The backend follows a modular route/controller/service architecture.

```text
src/
├── config/
│   ├── auth.js
│   ├── db.js
│   └── env.js
│
├── modules/
│   ├── admin/
│   ├── booking/
│   ├── categories/
│   ├── equipment/
│   ├── expenses/
│   ├── favorites/
│   ├── payments/
│   ├── reviews/
│   └── users/
│
├── routes/
├── middleware/
└── server.js
```

Refer to the actual `src/` directory for the current file structure.

## Getting Started

### Clone Repository

```bash
git clone <YOUR_SERVER_REPOSITORY_URL>
cd equipora-server
```

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the server root directory.

```env
NODE_ENV=development
PORT=5000

CLIENT_URL=http://localhost:3000

MONGODB_URI=your_mongodb_connection_string
DB_NAME=equipora

BETTER_AUTH_SECRET=your_long_random_secret
BETTER_AUTH_URL=http://localhost:5000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

**Important:** Never commit `.env` or real credentials to GitHub.

The application currently requires MongoDB, Better Auth, Google OAuth, GitHub OAuth, and Stripe secret configuration at startup.

### Run Development Server

```bash
npm run dev
```

The backend starts at:

http://localhost:5000

### Available Scripts

```bash
npm run dev
npm start
```

- `npm run dev` — starts the server using Nodemon.
- `npm start` — starts the server using Node.js.

## API Route Groups

| Endpoint | Description |
|---|---|
| `/api/auth` | Better Auth authentication |
| `/api/categories` | Category management |
| `/api/equipment` | Equipment management |
| `/api/bookings` | Booking management |
| `/api/payments` | Payment and refund operations |
| `/api/expenses` | Expense management |
| `/api/users` | User management |
| `/api/favorites` | Customer favorites |
| `/api/reviews` | Equipment reviews |
| `/api/admin` | Administrative operations |
| `/api/health` | API and database health |

Refer to individual route files for exact HTTP methods, request bodies, and authorization requirements.

## Authentication and Authorization

Better Auth is used for authentication with MongoDB integration.

The application uses JWT-based authentication for protected API requests.

Authenticated frontend requests send:

```http
Authorization: Bearer <JWT_TOKEN>
```

Role-based access must be enforced by the backend for customer, owner, and administrator operations.

## Stripe Payment Integration

EQUIPORA integrates Stripe-hosted Checkout.

### Payment Workflow

1. Customer requests payment for an eligible booking.
2. Backend validates booking ownership and payment eligibility.
3. Backend creates a Stripe Checkout Session.
4. Customer completes payment on Stripe.
5. Stripe sends a webhook event.
6. Backend verifies the webhook signature.
7. Payment and booking records are updated.
8. Frontend retrieves the verified payment status.

### Webhook Endpoint

```http
POST /api/payments/webhook
```

**Important:** Stripe webhook handling requires the original raw request body. The webhook route must be registered before `express.json()`.

Configure the webhook endpoint in Stripe Dashboard and provide the signing secret through `STRIPE_WEBHOOK_SECRET`.

Use Stripe test mode during development.

## Database

EQUIPORA uses MongoDB with the native MongoDB driver.

The backend initializes database indexes for application collections, including payment-related and other operational collections.

The database name is configurable through `DB_NAME`.

## Health Check

Local:

```text
http://localhost:5000/api/health
```

Production:

https://equipora-server-chi.vercel.app/api/health

The endpoint checks API availability and MongoDB connectivity.

## Security

- Helmet security headers.
- CORS origin restrictions.
- Better Auth authentication.
- JWT-based protected API requests.
- Server-side role authorization.
- Stripe webhook signature verification.
- Environment-based secret management.
- Centralized error handling.

Never expose:

- MongoDB connection strings.
- Better Auth secrets.
- Stripe secret keys.
- Stripe webhook signing secrets.
- OAuth client secrets.

## Deployment

The backend is deployed using Vercel.

Before deployment:

1. Configure all required environment variables.
2. Set `CLIENT_URL` to the production frontend.
3. Set `BETTER_AUTH_URL` to the deployed backend.
4. Configure OAuth callback URLs.
5. Configure Stripe webhook URL and signing secret.
6. Verify MongoDB network access.
7. Test authentication, bookings, checkout, webhook, and refund workflows.

## Important Production Considerations

Before accepting real payments, verify:

- Currency consistency between booking records and Stripe Checkout.
- Correct payment amount calculations.
- Webhook idempotency.
- Refund calculations and financial records.
- Stripe account and payment method configuration.
- Server-side ownership and role authorization.

## Related Repository

**Frontend:** `<YOUR_CLIENT_REPOSITORY_URL>`

---

**EQUIPORA — Equipment Rental Platform**

*Rent Smarter. Build Better.*
