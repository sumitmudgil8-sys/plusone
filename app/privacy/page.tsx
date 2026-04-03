export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">Privacy Policy</h1>
        <p className="text-white/50 text-sm mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-2">We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> Name, email address, and password (hashed).</li>
              <li><strong>Profile information:</strong> Bio, profile photo, location (for companion matching), languages, and interests.</li>
              <li><strong>Payment information:</strong> Transaction records (amounts, timestamps). We do not store full card details — payments are processed by Razorpay.</li>
              <li><strong>Usage data:</strong> Session durations, message counts, and feature interactions for billing and analytics.</li>
              <li><strong>Communications:</strong> Chat messages between clients and companions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To operate and provide the Plus One service</li>
              <li>To process payments and manage wallet balances</li>
              <li>To match clients with nearby companions based on location</li>
              <li>To send account-related notifications (session updates, payment receipts)</li>
              <li>To enforce our Terms of Service and prevent fraud</li>
              <li>To improve platform features and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Sharing</h2>
            <p className="mb-2">We do not sell your personal data. We may share data with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Razorpay:</strong> For payment processing (subject to Razorpay&apos;s privacy policy)</li>
              <li><strong>Cloudinary:</strong> For image hosting and delivery</li>
              <li><strong>Ably:</strong> For real-time messaging infrastructure</li>
              <li><strong>Agora:</strong> For voice call functionality</li>
              <li><strong>Law enforcement:</strong> When required by applicable law or court order</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. Chat messages are retained for dispute resolution purposes for up to 90 days after a session ends. You may request deletion of your account and associated data by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Password hashing using bcrypt</li>
              <li>HTTPS encryption for all data in transit</li>
              <li>HTTP-only cookies for authentication tokens</li>
              <li>Role-based access controls</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and data</li>
              <li>Withdraw consent for optional data uses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies</h2>
            <p>We use an authentication cookie (HTTP-only, secure) to maintain your session. We do not use advertising or tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>For privacy-related requests or questions: <span className="text-[#D4AF37]">privacy@plusone.app</span></p>
          </section>
        </div>

        <div className="mt-12 flex gap-6 text-sm text-white/40">
          <a href="/terms" className="hover:text-white/70 transition-colors">Terms of Service</a>
          <a href="/refund-policy" className="hover:text-white/70 transition-colors">Refund Policy</a>
        </div>
      </div>
    </div>
  );
}
