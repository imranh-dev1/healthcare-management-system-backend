# Healthcare System — Backend

REST API for a doctor-appointment platform where **patients book consultations**, **doctors run them remotely and write prescriptions**, and **admins/super-admins manage the platform and review doctor applications**.

Bundled with a ready-to-use [Postman collection](#postman-collection) containing every endpoint with sample payloads.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture & Project Structure](#architecture--project-structure)
- [Data Model](#data-model)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Pagination & Filtering](#pagination--filtering)
- [Error Handling & Response Envelope](#error-handling--response-envelope)
- [Background Jobs](#background-jobs)
- [Postman Collection](#postman-collection)
- [Scripts](#scripts)
- [Known Issues & Limitations](#known-issues--limitations)
- [Troubleshooting](#troubleshooting)

---

## Features

**Authentication & Users**
- Email + OTP registration flow for patients (Redis-backed, 5-minute OTP).
- Login returns JWT access + refresh tokens both in the body and as cookies.
- Google Sign-In (ID token verification).
- Forgot / reset password with OTP.
- Role-based access control across four roles: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `PATIENT`.
- Authenticated profile image upload (Cloudinary).

**Doctor Management**
- Multipart application form (`resume`, up to 10 `additionalFiles`, JSON `data`) — a doctor account is created automatically.
- Email verification OTP for the applicant.
- Admin approval / rejection workflow with review tracking.
- Public doctor directory and today's available doctors for patients.
- Doctors can manage their own profile.

**Schedules**
- Doctors create one schedule per day (slots auto-computed at 20 minutes each).
- Draft → published lifecycle; patients can only book published schedules.
- Doctors can update, publish, or delete their schedules.

**Appointments & Payments**
- Patients book appointments against a published schedule slot.
- **bKash tokenized checkout** (sandbox) for payment; a payment record is created with each booking.
- bKash callback confirms the appointment, assigns a serial number + joining time, generates an invoice PDF, and emails it to the patient.
- Patients can cancel; cancellation more than 1 hour before the slot triggers an automatic bKash refund.
- Doctors move appointments through `CONFIRMED → ONGOING → COMPLETED`.

**Prescriptions**
- Doctors generate PDF prescriptions for appointments and store them on Cloudinary; the PDF is emailed to the patient.

**Analytics**
- Role-based dashboards: admin (platform KPIs + revenue), doctor (schedules/appointments/fees), patient (own appointments/spend).

**Platform**
- Global error handler, Zod request validation, centralized response envelope.
- Cron jobs to clean up stale doctor applications.

---

## Tech Stack

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Runtime    | Node.js 20+ · Express 5 · TypeScript                             |
| Database   | PostgreSQL · Prisma ORM 7 (multi-file schema, typed client)       |
| Auth       | JWT (access/refresh) · cookie + Bearer header support · Google   |
| Cache/OTP  | Redis (OTPs, pending registration payloads, bKash tokens)        |
| Payments   | bKash Tokenized Checkout (sandbox)                               |
| Storage    | Cloudinary (resume, certificates, prescriptions, profile images) |
| Email      | Nodemailer with EJS templates (verification, invoice, etc.)      |
| Scheduling | node-cron                                                         |
| Validation | Zod                                                              |
| PDF        | pdfkit                                                           |
| Linting    | Biome                                                            |

---

## Architecture & Project Structure

The API follows a lightweight layered architecture per module: **route → controller → service**, which keeps HTTP plumbing separate from business logic.

```
src/
├── server.ts                        # DB + Redis + SMTP connect, seeding, cron, listen
├── app.ts                           # Express app: CORS, body parsing, route mounting, error handlers
├── generated/prisma/                # Prisma client (git-ignored — run npx prisma generate)
└── app/
    ├── config/index.ts              # Single source of truth for all env vars
    ├── interface/index.ts           # Shared types (e.g. IQuery for pagination)
    ├── lib/
    │   ├── bikash.ts                # bKash grant/refresh token management (Redis-cached)
    │   ├── cloudinary.ts            # Image/file upload helper
    │   ├── cron.ts                  # Unverified / rejected doctor cleanup jobs
    │   ├── googleAuth.ts            # Google OAuth client
    │   ├── multer.ts                # In-memory multipart upload
    │   ├── nodemailer.ts            # SMTP transporter
    │   ├── prisma.ts                # Shared PrismaClient instance
    │   └── redis.ts                 # Redis client
    ├── middleware/
    │   ├── checkAuth.ts             # auth(...roles) JWT + role guard
    │   ├── validateRequest.ts       # Zod body validation
    │   ├── globalErrorHandler.ts    # Normalized JSON errors (Prisma-aware)
    │   └── notFound.ts              # 404 catch-all
    ├── templates/                   # EJS email templates (EJS)
    ├── utils/
    │   ├── AppError.ts · catchAsync.ts · jwt.ts
    │   ├── sendEmail.ts · sendResponse.ts
    │   └── seed.ts                  # Seeds super admin / tester admin / tester doctor
    └── module/                      # One folder per domain
        ├── auth/                    # register, login, google, password reset
        ├── user/                    # profile image upload
        ├── doctor/                  # applications, approval, public directory
        ├── schedule/                # doctor schedule CRUD + publish
        ├── appointment/             # booking, payment, cancellation, status
        ├── payment/                 # payment history
        ├── prescription/            # PDF prescriptions
        └── analytics/               # role-based dashboards
prisma/
├── schema/                          # split schema (schema, enums, user, patient, doctor, schedule, appointment, payment)
└── migrations/                      # committed SQL migrations
```

Module convention: each module provides `<name>.route|controller|service|interface|validation.ts`. Controllers never call Prisma, services never touch `req`/`res`.

---

## Data Model

```
User (roles, status, authProvider) ─┬─ 1:1 ─ Patient
                                    └─ 1:1 ─ Doctor ───< Schedule
                                            └──────────< Appointment <─ 1:1 ─ Payment
```

| Model       | Key fields                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------ |
| `User`      | role (`SUPER_ADMIN`/`ADMIN`/`DOCTOR`/`PATIENT`), authProvider, emailVerified, status       |
| `Patient`   | name, email, contactNumber, address, soft-delete flags                                     |
| `Doctor`    | specialization, licenseNumber, qualification, experience, consultationFee, verificationStatus |
| `Schedule`  | start/end datetime, totalSlots/availableSlots, meetingLink, status (`DRAFT`/`PUBLISHED`)   |
| `Appointment` | status (`PENDING`/`CONFIRMED`/`ONGOING`/`COMPLETED`/`CANCELLED`), serialNumber, joiningTime |
| `Payment`   | amount, gateway, bKash ids, status (`UNPAID`…`REFUNDED`), refund fields                    |

> Note: `Appointment`, `Doctor`, `Schedule`, `Payment`, `Patient`, `User` are stored on PostgreSQL; prescriptions currently live as a PDF URL on the `Appointment` (there is no separate `Prescription` table).

---

## Getting Started

Prerequisites: **Node.js 20+**, **PostgreSQL 14+**.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env — set DATABASE_URL and the SMTP/Redis/bKash/Cloudinary/Google keys

# 3. Generate the Prisma client (typed client into src/generated/prisma)
npx prisma generate

# 4. Create the schema
npx prisma migrate dev

# 5. Start the dev server
npm run dev
```

On startup the server connects to **PostgreSQL**, **Redis**, and the **SMTP** host, then seeds the demo accounts (see below). You should see:

```
Connected to the database successfully.
Connected to the Redis successfully.
Connected to the Nodemailer successfully.
Server is running on port, 5000
```

Smoke test:

```bash
curl http://localhost:5000/
# {"success":true,"message":"Welcome to Healthcare System Backend"}
```

---

## Environment Variables

All variables are read in `src/app/config/index.ts`. Start from `.env.example`:

| Variable                 | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `NODE_ENV`               | `development` exposes error details in responses                    |
| `PORT`                   | HTTP port (default `5000`)                                          |
| `DATABASE_URL`           | PostgreSQL connection string                                        |
| `JWT_ACCESS_SECRET`      | Access token signing key                                            |
| `JWT_REFRESH_SECRET`     | Refresh token signing key                                           |
| `JWT_ACCESS_EXPIRES_IN`  | e.g. `15m`, `1d`                                                    |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d`                                                           |
| `BCRYPT_SALT_ROUNDS`     | bcrypt cost                                                         |
| `FRONTEND_URL`           | CORS allowlist origin                                               |
| `SUPER_ADMIN_*`          | Super-admin seed credentials                                        |
| `TESTER_ADMIN_*`         | Admin seed credentials                                              |
| `TESTER_DOCTOR_*`        | Doctor seed credentials                                             |
| `REDIS_*`                | Redis connection (host, port, username, password)                   |
| `SMTP_USER/PASSWORD/SENDER` | Nodemailer credentials and sender address                        |
| `GOOGLE_CLINT_ID`        | Google OAuth client ID (note the typo is in the source)             |
| `CLOUDINARY_*`           | Cloudinary cloud name, API key & secret                             |
| `BKASH_*`                | bKash sandbox URL, merchant credentials, callback URL               |

> **Security:** the JWT secrets committed in `.env.example` are placeholders — replace them before deploying:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Demo Accounts

Seeded automatically on startup (idempotent):

| Role        | Email                     | Password          |
| ----------- | ------------------------- | ----------------- |
| Super Admin | `superadmin@gmail.com`    | `Super@admin1`    |
| Admin       | `testeradmin@gmail.com`   | `Tester@admin1`   |
| Doctor      | `testerdoctor@gmail.com`  | `Tester@doctor1`  |
| Patient     | (register via the API)    | —                 |

---

## Authentication

All endpoints except the ones marked **public** require `Authorization: Bearer <accessToken>` (the header also accepts a raw token). `login`, `register-email-verify` and `google` also set httpOnly cookies (`accessToken`, `refreshToken`).

**Recommended flow:** use the `accessToken` from the response body. `POST /auth/refresh-token` rotates the pair (reads the `refreshToken` cookie).

> Note: cookies are set with `sameSite: "none"` + `secure: false`, a combination browsers may silently drop — prefer the Bearer header in browsers.

Roles: `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `PATIENT`. Access is enforced by the `auth(...roles)` guard using the role embedded in the JWT, and the user is re-validated against the database on every request.

---

## API Reference

Base URL: `http://localhost:5000/api/v1`

### Auth

| Method | Path                    | Access     | Body |
| ------ | ----------------------- | ---------- | ---- |
| POST   | `/auth/register`        | public     | `{ name, email, password, patient?: { contactNumber? } }` — emails an OTP |
| POST   | `/auth/register-email-verify` | public | `{ email, otp }` — completes registration, returns tokens |
| POST   | `/auth/login`           | public     | `{ email, password }` |
| GET    | `/auth/me`              | all roles  | — |
| POST   | `/auth/google`          | public     | `{ idToken }` |
| POST   | `/auth/refresh-token`   | cookie     | — |
| POST   | `/auth/forgot-password` | public     | `{ email }` |
| POST   | `/auth/reset-password`  | public     | `{ email, newPassword, otp }` |

Password rule: ≥ 8 chars, one uppercase, one lowercase, one digit, one special char (`@$!%*?&`).

### User

| Method | Path                          | Access    | Body |
| ------ | ----------------------------- | --------- | ---- |
| PATCH  | `/user/profile-image-upload`  | all roles | multipart `profile-image` file |

### Doctor

| Method | Path                                  | Access                 | Notes |
| ------ | ------------------------------------- | ---------------------- | ----- |
| POST   | `/doctor/applying-as-doctor`          | public                 | multipart `resume`, `additionalFiles*`, `data` (JSON string) |
| POST   | `/doctor/applying-as-doctor/email-verify` | DOCTOR               | `{ email, otp }` — the verification email now includes the applicant's temporary login password |
| POST   | `/doctor/approved-doctor`             | ADMIN, SUPER_ADMIN     | `{ doctorId, verificationStatus, rejectionReason? }` — `rejectionReason` optional unless rejecting |
| GET    | `/doctor/all-doctors`                 | ADMIN, SUPER_ADMIN     | filters: `searchTerm`, `specialization`, `email`, `licenseNumber`, `verificationStatus` |
| PATCH  | `/doctor/update-my-profile`           | DOCTOR                 | all fields optional |
| GET    | `/doctor/public-doctors`              | public                 | approved doctors only |
| GET    | `/doctor/public-doctors/:doctorId`    | public                 | includes today's published schedules |
| GET    | `/doctor/available-doctors-today`     | PATIENT                | approved doctors with open slots today |

### Schedule

| Method | Path                                       | Access                   | Notes |
| ------ | ------------------------------------------ | ------------------------ | ----- |
| POST   | `/schedule/create-schedules`               | DOCTOR                   | `{ startDateTime, endDateTime, totalSlots, availableSlots, meetingLink }` — slots recomputed (20 min each) |
| GET    | `/schedule/my-schedules`                   | DOCTOR                   | `page`, `limit`, `status` |
| GET    | `/schedule/all-schedules`                  | ADMIN, SUPER_ADMIN       | `doctorId`, `email`, `status`, `searchTerm` |
| GET    | `/schedule/todays-schedules`               | PATIENT                  | requires `doctorId` query |
| PATCH  | `/schedule/update-schedule/:scheduleId`    | DOCTOR                   | all fields optional |
| PATCH  | `/schedule/publish-schedule/:scheduleId`   | DOCTOR                   | draft → published |
| GET    | `/schedule/:scheduleId`                    | DOCTOR, ADMIN, SUPER_ADMIN | |
| DELETE | `/schedule/:scheduleId`                    | DOCTOR                   | blocked once bookings exist |

### Appointment

| Method | Path                                              | Access                | Notes |
| ------ | ------------------------------------------------- | --------------------- | ----- |
| POST   | `/appointment/book-appointment`                   | PATIENT               | `{ scheduleId }` → creates PENDING appointment + bKash intent, returns `paymentUrl` |
| POST   | `/appointment/pay-appointment`                    | PATIENT               | `{ appointmentId }` → re-initiate checkout for pending appointment |
| GET    | `/appointment/book-appointment/payment/callback`  | bKash callback        | `paymentID`, `status` — confirms appointment, emails invoice |
| POST   | `/appointment/cancel-appointment`                 | PATIENT, ADMIN, SUPER_ADMIN | `{ appointmentId }` → cancels the appointment, frees a slot only if payment was PAID/CONFIRMED; auto bKash refund if >1h before start and payment was PAID |
| PATCH  | `/appointment/update-status/:appointmentId`       | DOCTOR                | `{ status: "ONGOING" \| "COMPLETED" }` |
| GET    | `/appointment/my-appointments`                    | PATIENT               | `page`, `limit`, `status` |
| GET    | `/appointment/doctor-appointments`                | DOCTOR                | `page`, `limit`, `status` |
| GET    | `/appointment/all-appointments`                   | ADMIN, SUPER_ADMIN    | filters `status`, `doctorId`, `patientId`, `doctorEmail`, `patientEmail` |
| GET    | `/appointment/:appointmentId`                     | all roles             | ownership-checked per role |

### Payment

| Method | Path                        | Access                 | Notes |
| ------ | --------------------------- | ---------------------- | ----- |
| GET    | `/payment/my-payments`      | PATIENT                | `page`, `limit` |
| GET    | `/payment`                  | ADMIN, SUPER_ADMIN     | `page`, `limit` |
| GET    | `/payment/:paymentId`       | PATIENT, ADMIN, SUPER_ADMIN | patients scoped to own payments |

### Prescription

| Method | Path                                      | Access     | Notes |
| ------ | ----------------------------------------- | ---------- | ----- |
| POST   | `/prescription/careate-prescription`      | DOCTOR     | `{ appointmentId, finding, medicines[] }` — generates PDF, uploads to Cloudinary, emails patient. *(route name intentionally kept as-is to match the source)* |
| GET    | `/prescription/:prescriptionId`           | all roles  | expects an **appointment id**; returns `{ appointment, prescription }` |

### Analytics

| Method | Path                         | Access             |
| ------ | ---------------------------- | ------------------ |
| GET    | `/analytics/admin-analytics` | ADMIN, SUPER_ADMIN |
| GET    | `/analytics/doctor-analytics`| DOCTOR             |
| GET    | `/analytics/patient-analytics`| PATIENT           |

### Misc

- `GET /` — health check / welcome.
- `GET /test` — bKash grant-token self-test.

---

## Pagination & Filtering

List endpoints support a shared query convention:

| Query param  | Default   | Description                    |
| ------------ | --------- | ------------------------------ |
| `page`       | `1`       | page number                    |
| `limit`      | `10`      | items per page                 |
| `sortBy`     | `createdAt` | field to sort by             |
| `sortOrder`  | `desc`    | `asc` or `desc`                |
| `searchTerm` | —         | text search (module-specific)  |
| `status`     | —         | entity status filter           |

Paginated responses include `data` plus a `meta` object: `{ page, limit, total, totalPages }`.

---

## Error Handling & Response Envelope

Successful responses follow a single shape:

```json
{ "success": true, "statusCode": 200, "message": "...", "data": {...}, "meta": {...} }
```

Errors are normalized by `globalErrorHandler`:

```json
{ "success": false, "statusCode": 400, "name": "...", "message": "...", "error": {...}, "stack": "..." }
```

- In `NODE_ENV=development`, `name`, `error`, and `stack` are included to ease debugging; in production only the generic message is shown.
- Prisma errors are mapped to friendly messages (duplicate key, foreign-key failure, not-found, DB auth/reachability).
- Zod validation failures return `400` with the first issue's message.

---

## Background Jobs

Defined in `src/app/lib/cron.ts` and started on boot:

| Job                   | Schedule          | Behavior                                                            |
| --------------------- | ----------------- | ------------------------------------------------------------------- |
| `unverifiedDoctorDelete` | every 10 minutes | deletes DOCTOR applications with unverified email older than 1 hour |
| `rejectedDoctorDelete`  | 1st of each month | deletes REJECTED doctor applications older than 1 month           |

---

## Postman Collection

A ready-to-use collection ships at the repo root: **`Healthcare-API.postman_collection.json`** (44 requests, 8 folders).

Features:
- Collection variable `baseUrl` (default `http://localhost:5000`) plus placeholder variables for ids (`scheduleId`, `appointmentId`, `doctorId`, etc.).
- Login / register-verify requests auto-store `accessToken` (and `refreshToken`) into collection variables via test scripts; every protected request sends `Authorization: Bearer {{accessToken}}`.
- Seeded demo credentials pre-filled for patient/admin/doctor.
- Suggested end-to-end flow documented inside the collection description.

Import: **Postman → Import → choose the JSON file**, then set the id variables from real responses.

---

## Scripts

| Command                  | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `npm run dev`            | start with hot reload (`tsx watch src/server.ts`)       |
| `npm run build`          | typecheck + compile to `dist/`                          |
| `npm run start`          | run once (no watching)                                  |
| `npm run format:check`   | Biome format check on `src/`                            |
| `npm run format:fix`     | Biome format write on `src/`                            |
| `npm run linter:check`   | Biome lint                                              |
| `npm run linter:fix`     | Biome lint with auto-fixes                              |

Prisma tasks are run through the CLI directly:

```bash
npx prisma generate   # regenerate the typed client after schema changes
npx prisma migrate dev
npx prisma studio     # browser GUI at http://localhost:5555
```

---

## Known Issues & Limitations

- **No automated tests** (`npm test` is a placeholder).
- **Prescription endpoint semantics**: there is no `Prescription` table; `GET /prescription/:prescriptionId` looks the appointment up by id and returns its PDF URL. Intentionally left matching the source, but the naming is misleading.
- **Route typo**: `POST /prescription/careate-prescription` (kept to match the source).
- **Cookie behavior**: tokens are set with `sameSite: "none"` + `secure: false`, which browsers may reject — use the Bearer header instead.
- **Analytics queries** are high-level counters; revenue figures assume PAID/REFUNDED payment statuses and are meant to be refined as the product grows.
- **Error messages** contain a few typos (e.g. "Pataint Not Found"). Cosmetic only.
- **Environment config** is unvalidated at boot — a missing variable surfaces at runtime when first used.
- **bKash integration** uses the sandbox tokenized checkout; swap the credentials/URL for production.
- **Doctor application bio/fee/contact**: the `bio`, `consultationFee`, and `contactNumber` fields from the application `data` payload are not persisted at apply time — they must be set after approval via `update-my-profile`.

---

## Bug Fixes Applied

The following bugs were identified and fixed during code review:

| # | Module | Bug | Fix |
|---|--------|-----|-----|
| 1 | Schedule | `differenceInMinutes` arguments were swapped in slot computation, always producing negative values | Fixed arg order to `(end, start)` |
| 2 | Doctor | `rejectionReason` was required in the approve/reject validation schema | Made optional (`z.string().optional()`) |
| 3 | Doctor | Typo `rejectionReson` in interface/service vs `rejectionReason` in validation | Fixed to `rejectionReason` throughout |
| 4 | Doctor | `approved-doctor` response included password hash via `user: true` | Changed to `user: { omit: { password: true } }` |
| 5 | Schedule | `getMySchedules` / `getAllSchedules` pagination `total` returned `totalPages` instead of record count | Fixed to `total: totalSchedules` + added `totalPages` field |
| 6 | Appointment | Cancel always incremented `availableSlots` even for never-paid (PENDING) appointments | Only increment when status was CONFIRMED or ONGOING |
| 7 | Appointment | Cancel refund logic ran regardless of payment status | Refund only when `payment.status === PAID` |
| 8 | Appointment | Admin/super-admin cancel failed — always queried by `patient.email` | Conditional query based on `user.role` |
| 9 | Appointment | bKash callback payment lookup used `undefined` appointmentId | Changed to `appointmentId: appointment.id` |
| 10 | Appointment | Invoice PDF: doctor email field used `specialization`; typo `paymentExicuteTime` | Fixed to `doctor.email` + `paymentExecuteTime` |
| 11 | Prescription | `createPrescription` status guard was inverted (threw when IS completed) | Fixed condition to `!== AppointmentStatus.COMPLETED` |
| 12 | DB | `@@unique` on appointments prevented re-booking after cancel | Partial unique index `WHERE status <> 'CANCELLED'` + Prisma `previewFeatures = ["partialIndexes"]` |
| 13 | Doctor | Multer config for `applying-as-doctor` was missing `data` field → "Unexpected field" error | Added `{ name: 'data', maxCount: 1 }` to `upload.fields` |
| 14 | Doctor | Applicant's randomly generated password was never emailed → could not log in to verify | Included temp password in the email-verification template |
| 15 | Auth | Soft-deleted users could still access APIs with a valid token | Added `isDeleted` check in `checkAuth.ts` middleware |

---

## Troubleshooting

**`Cannot find module '.../src/generated/prisma/client'`**
Run `npx prisma generate` — `src/generated/prisma` is git-ignored.

**`Can't reach database server` / `ECONNREFUSED`**
Postgres isn't running or `DATABASE_URL` is wrong. Confirm with `pg_isready -h localhost -p 5432`.

**`Authentication failed against database server`**
Check the username/password in `DATABASE_URL`; `psql -c '\du'` lists real roles.

**Login / register throw at runtime**
`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (or other required env vars) are missing from `.env`.

**bKash payment steps fail**
Verify `REDIS_*` connectivity first — bKash tokens are cached in Redis — then the `BKASH_*` sandbox credentials.

**Redis not reachable**
For local development set `REDIS_HOST`/`REDIS_PORT` to a local Redis, or use the remote host configured in `.env`.