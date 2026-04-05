-- Phase 2 Step 1: Float → Int migration for all monetary columns.
-- Every monetary value is multiplied by 100 to convert from rupees to paise.
-- This script uses the rename-add-copy-drop pattern so data is never lost.

-- ─── Wallet.balance ───────────────────────────────────────────────────────────
ALTER TABLE "Wallet" ADD COLUMN "balance_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "Wallet" SET "balance_new" = ROUND("balance" * 100)::INTEGER;
ALTER TABLE "Wallet" DROP COLUMN "balance";
ALTER TABLE "Wallet" RENAME COLUMN "balance_new" TO "balance";

-- ─── WalletTransaction.amount ─────────────────────────────────────────────────
ALTER TABLE "WalletTransaction" ADD COLUMN "amount_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "WalletTransaction" SET "amount_new" = ROUND("amount" * 100)::INTEGER;
ALTER TABLE "WalletTransaction" DROP COLUMN "amount";
ALTER TABLE "WalletTransaction" RENAME COLUMN "amount_new" TO "amount";

-- ─── WalletTransaction.balanceAfter ───────────────────────────────────────────
ALTER TABLE "WalletTransaction" ADD COLUMN "balance_after_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "WalletTransaction" SET "balance_after_new" = ROUND("balanceAfter" * 100)::INTEGER;
ALTER TABLE "WalletTransaction" DROP COLUMN "balanceAfter";
ALTER TABLE "WalletTransaction" RENAME COLUMN "balance_after_new" TO "balanceAfter";

-- ─── BillingSession.ratePerMinute ─────────────────────────────────────────────
ALTER TABLE "BillingSession" ADD COLUMN "rate_per_min_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "BillingSession" SET "rate_per_min_new" = ROUND("ratePerMinute" * 100)::INTEGER;
ALTER TABLE "BillingSession" DROP COLUMN "ratePerMinute";
ALTER TABLE "BillingSession" RENAME COLUMN "rate_per_min_new" TO "ratePerMinute";

-- ─── BillingSession.totalCharged ──────────────────────────────────────────────
ALTER TABLE "BillingSession" ADD COLUMN "total_charged_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "BillingSession" SET "total_charged_new" = ROUND("totalCharged" * 100)::INTEGER;
ALTER TABLE "BillingSession" DROP COLUMN "totalCharged";
ALTER TABLE "BillingSession" RENAME COLUMN "total_charged_new" TO "totalCharged";

-- ─── Booking.totalAmount ──────────────────────────────────────────────────────
ALTER TABLE "Booking" ADD COLUMN "total_amount_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "Booking" SET "total_amount_new" = ROUND("totalAmount" * 100)::INTEGER;
ALTER TABLE "Booking" DROP COLUMN "totalAmount";
ALTER TABLE "Booking" RENAME COLUMN "total_amount_new" TO "totalAmount";

-- ─── Booking.depositAmount ────────────────────────────────────────────────────
ALTER TABLE "Booking" ADD COLUMN "deposit_amount_new" INTEGER NOT NULL DEFAULT 0;
UPDATE "Booking" SET "deposit_amount_new" = ROUND("depositAmount" * 100)::INTEGER;
ALTER TABLE "Booking" DROP COLUMN "depositAmount";
ALTER TABLE "Booking" RENAME COLUMN "deposit_amount_new" TO "depositAmount";

-- ─── CompanionProfile.hourlyRate (₹2000 default → 200000 paise) ──────────────
ALTER TABLE "CompanionProfile" ADD COLUMN "hourly_rate_new" INTEGER NOT NULL DEFAULT 200000;
UPDATE "CompanionProfile" SET "hourly_rate_new" = ROUND("hourlyRate" * 100)::INTEGER;
ALTER TABLE "CompanionProfile" DROP COLUMN "hourlyRate";
ALTER TABLE "CompanionProfile" RENAME COLUMN "hourly_rate_new" TO "hourlyRate";
