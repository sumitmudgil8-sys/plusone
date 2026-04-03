export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">Terms of Service</h1>
        <p className="text-white/50 text-sm mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-white/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using the Plus One platform (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service. These terms apply to all users including clients and companions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>Plus One is a social companionship marketplace that connects clients with professional companions for conversation, social events, and companionship services. All interactions are strictly social and non-intimate in nature. The platform facilitates discovery, communication, and per-minute billing between users.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Payment Terms</h2>
            <p className="mb-2">The platform operates on a wallet-based, pay-per-minute model:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Clients must maintain a wallet balance to initiate chat or voice sessions.</li>
              <li>Billing is charged per minute at the companion&apos;s listed rate.</li>
              <li>Wallet funds are deducted in real time during active sessions.</li>
              <li>All payments are processed securely through Razorpay.</li>
              <li>There is no subscription or recurring charge. You pay only for time used.</li>
              <li>Minimum recharge: ₹100. Maximum single recharge: ₹50,000.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be at least 18 years of age to use this Service.</li>
              <li>You agree to provide accurate information during registration.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree not to use the platform for any unlawful, abusive, or inappropriate purpose.</li>
              <li>You agree not to solicit or engage in any activity that violates applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Content Policy</h2>
            <p>Users may not post, transmit, or share content that is:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Sexually explicit, obscene, or pornographic</li>
              <li>Harassing, threatening, or abusive toward other users</li>
              <li>Fraudulent, misleading, or impersonating another person</li>
              <li>In violation of any intellectual property rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Companion Conduct</h2>
            <p>Companions agree to provide professional, respectful, and lawful companionship services only. Companions are independent contractors and not employees of Plus One. The platform does not guarantee earnings or session frequency.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Termination</h2>
            <p>We reserve the right to suspend or terminate any account that violates these terms, engages in fraudulent activity, or causes harm to other users or the platform, with or without prior notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>Plus One is a technology platform and is not responsible for the actions, conduct, or representations of any user. To the maximum extent permitted by law, Plus One shall not be liable for any indirect, incidental, or consequential damages arising from use of the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any disputes arising shall be subject to the exclusive jurisdiction of courts in New Delhi, India.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p>For questions about these Terms, contact us at: <span className="text-[#D4AF37]">support@plusone.app</span></p>
          </section>
        </div>

        <div className="mt-12 flex gap-6 text-sm text-white/40">
          <a href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</a>
          <a href="/refund-policy" className="hover:text-white/70 transition-colors">Refund Policy</a>
        </div>
      </div>
    </div>
  );
}
