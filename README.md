# BAD BATCH

BAD BATCH is a Next.js App Router application for a cookie brand/menu and a protected admin area. It uses PostgreSQL through Prisma. Customers can order through guest checkout and submit GCash proof on the signed order page or contact BAD BATCH through Instagram. Payments are manually verified; no payment gateway is integrated.

## Local setup

Requirements: Node.js 20.9 or later, npm, and a PostgreSQL database.

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`.
3. Install dependencies and apply the initial schema:

   ```sh
   npm install
   npm run db:migrate -- --name init
   npm run db:seed
   npm run dev
   ```

The seed creates exactly four products, initial store settings, and an admin account. It hashes the configured admin password with bcrypt. Re-running the seed does not replace an existing admin password.

## Environment

- `DATABASE_URL`: PostgreSQL connection URL.
- `SESSION_SECRET`: random secret of at least 32 characters used to sign admin sessions. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
- `ADMIN_EMAIL`: email address for the initial admin user.
- `ADMIN_PASSWORD`: initial admin password; at least 12 characters and no more than 72 UTF-8 bytes (bcrypt limit). Never commit `.env`.
- `STORE_TIME_ZONE`: IANA timezone used for daily admin reporting and order timestamps (for example, `Asia/Manila`); defaults to `UTC`.
- `GCASH_ACCOUNT_NAME` and `GCASH_ACCOUNT_NUMBER`: payment details shown to customers after checkout. Configure both before accepting GCash payments.
- `RESEND_API_KEY` and `EMAIL_FROM`: optional Resend REST API settings for order-received and payment-confirmed emails. Leave both unset to disable email notifications.
- Instagram ordering profile: `https://www.instagram.com/badbatchclub/`, configured in `src/lib/storefront/instagram.ts`.
- Contact email: `getbadbatch@gmail.com`.

Configure all four values in the deployment environment. Vercel must be connected to a PostgreSQL provider. Run `npm run db:migrate:deploy` as part of the production release process before deploying code that depends on a new migration.

## Architecture

- `src/app/(storefront)`: public storefront routes.
- `src/app/(protected)/admin`: admin pages behind a shared server-side authorization layout.
- `src/app/admin/login`: public admin sign-in page.
- `src/app/api`: guest checkout and admin-only product, order, and settings endpoints.
- `src/lib`: Prisma client, authentication/session helpers, HTTP utilities, and Zod validation.
- `src/components`: shared storefront and admin navigation/structure.
- `prisma/schema.prisma`: PostgreSQL data model.
- `prisma/seed.ts`: placeholder products, store settings, and environment-configured admin seed.

The storefront presents the current menu and supports guest checkout and Instagram ordering. Guest checkout verifies ordering and products, calculates prices from the database in a serializable transaction, and keeps line prices on the order item. A signed, HTTP-only order cookie protects confirmation and payment-proof submission. Uploaded proof images are stored as private PostgreSQL `bytea` data, limited to 4 MiB, and are only served through an admin-authenticated route. Fulfillment details are optional and confirmed directly with the customer.

The admin session is an eight-hour, HTTP-only, same-site strict, signed cookie. Passwords are bcrypt hashes; admin routes verify the session and re-check the user's ADMIN role in PostgreSQL. No payment provider or customer account flow is enabled yet.

The admin dashboard reports order counts by their stored order/last-updated timestamps and summarizes non-cancelled order totals created today. Payment review is separate from fulfillment. Website uploads and Instagram proof receipts require authorized admin verification; screenshots never automatically confirm payment. Legacy orders retain an unrecorded payment state. Completed-order counts use `updatedAt` as a best-effort completion-time proxy because the schema has no status history. Order fulfillment status is separate from payment. The order source is inferred from the current website checkout flow; no source field or POS order creation is implemented. Admin status updates follow PENDING → CONFIRMED → PREPARING → READY → COMPLETED, with cancellation available before the order reaches a terminal status.

## Commands

- `npm run dev`: local development.
- `npm run lint`: ESLint.
- `npm run build`: production build.
- `npm run db:generate`: generate Prisma Client.
- `npm run db:migrate -- --name <name>`: create/apply a development migration.
- `npm run db:migrate:deploy`: apply committed migrations in production.
- `npm run db:seed`: seed placeholder records and the configured admin.
