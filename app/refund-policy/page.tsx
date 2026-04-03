export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">Refund Policy</h1>
        <p className="text-white/50 text-sm mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Wallet Recharges</h2>
            <p>All wallet recharges on Plus One are processed through Razorpay and are <strong>non-refundable</strong> once credited to your wallet, except in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>A technical error caused duplicate charges for the same transaction</li>
              <li>Payment was debited from your bank but wallet was not credited within 24 hours</li>
              <li>An unauthorized transaction was reported within 7 days of occurrence</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Per-Minute Session Charges</h2>
            <p className="mb-2">Session charges (chat and voice) are deducted from your wallet in real time based on actual time spent. These charges are <strong>non-refundable</strong> once billed. However, refunds may be considered in the following cases:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A confirmed platform-side technical failure (e.g., server error) caused a session to be billed incorrectly</li>
              <li>A companion failed to join a voice session after the client was charged for more than 2 minutes of wait time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Unused Wallet Balance</h2>
            <p>Wallet balances do not expire. If you wish to withdraw your unused wallet balance, you may contact us at <span className="text-[#D4AF37]">support@plusone.app</span>. Withdrawal requests are subject to identity verification and a processing fee of 5% or ₹50 (whichever is higher) to cover payment gateway costs. Processing takes 5–10 business days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Failed Payments</h2>
            <p>If a payment fails at the Razorpay gateway (e.g., card declined, net banking timeout), no amount is deducted. If you believe you were charged for a failed transaction, contact your bank and also write to us at <span className="text-[#D4AF37]">support@plusone.app</span> with your transaction ID.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Refund Process</h2>
            <p>To request a refund:</p>
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>Email <span className="text-[#D4AF37]">support@plusone.app</span> with your registered email and order/transaction ID</li>
              <li>Describe the issue clearly with any relevant screenshots</li>
              <li>Our team will review your request within 3–5 business days</li>
              <li>Approved refunds are credited to the original payment source within 5–10 business days</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Account Termination</h2>
            <p>If your account is suspended or terminated due to a violation of our Terms of Service, any remaining wallet balance is forfeited and not eligible for refund.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Contact Us</h2>
            <p>For refund requests or payment disputes: <span className="text-[#D4AF37]">support@plusone.app</span></p>
            <p className="mt-2 text-white/50 text-sm">We aim to resolve all valid disputes fairly and promptly.</p>
          </section>
        </div>

        <div className="mt-12 flex gap-6 text-sm text-white/40">
          <a href="/terms" className="hover:text-white/70 transition-colors">Terms of Service</a>
          <a href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
