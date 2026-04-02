Project: Plus One

## What this app does
A companion platform where clients can browse companions, recharge a wallet,
and engage in per-minute billed chat and voice calls.

## Tech Stack
- Next.js 14 App Router
- PostgreSQL + Prisma
- JWT Auth + RBAC (client / companion / admin)
- Razorpay (payments)
- Tailwind CSS

## Current Status (update after each session)
- ✅ Auth + RBAC
- ✅ Booking system (basic)
- ✅ Messaging DB structure
- ✅ Admin APIs
- ✅ Razorpay basic integration
- ✅ Security: cookie secure flag, JWT secret guard, test creds removed
- ✅ Schema: MessageThread companion relation fixed
- ✅ Real-time chat (Ably — token auth, server publish, typing indicators)
- ✅ Wallet system (balance, recharge via Razorpay, transaction history, atomic credit/debit)
- ✅ Per-minute billing (start/tick/end, atomic debit+companion credit, anti-double-billing)
- ✅ Image upload (Cloudinary — avatar, companion gallery, verification docs)
- ❌ Companion onboarding
- ❌ Voice calling
- ❌ Production UI

## Conventions (Claude MUST follow these)
- All API routes in /app/api
- DB queries only through Prisma client in /lib/db.ts
- Auth checks via middleware or /lib/auth.ts helpers
- No `any` types in TypeScript
- Zod for all API input validation
- Return format: { success: boolean, data?: any, error?: string }

## DO NOT TOUCH (working — hands off)
- /app/api/auth — working auth, do not refactor
- prisma/schema.prisma existing models — only ADD, never modify existing fields
- /middleware.ts — do not change route protection logic

## Environment Variables needed
ABLY_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=