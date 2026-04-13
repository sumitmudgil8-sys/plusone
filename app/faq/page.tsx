import Link from 'next/link';

const faqs = [
  {
    q: 'What is Plus One?',
    a: 'Plus One is a social companionship platform that connects users with verified companions for dining, events, travel, and conversation. Think of it as finding the perfect plus one for any social occasion. All interactions are strictly social and non-intimate — no exceptions.',
  },
  {
    q: 'How do I sign up?',
    a: 'Create an account with your name, email, phone number, LinkedIn URL, and date of birth. Then upload a government-issued ID (Aadhaar, PAN, Passport, or Driving License) for verification. Our team reviews applications within 24–48 hours.',
  },
  {
    q: 'Why do I need to upload a government ID?',
    a: 'Identity verification ensures the safety and trust of everyone on the platform. Your ID is stored securely and is only used for verification — it is never shared with other users.',
  },
  {
    q: 'How long does the review process take?',
    a: 'Most applications are reviewed within 24–48 hours. You\'ll receive an update once a decision is made. You can check your status anytime by logging in.',
  },
  {
    q: 'What happens if my application is rejected?',
    a: 'If your application is rejected, you\'ll see the reason when you log in. Common reasons include an unverifiable LinkedIn profile or an unclear ID photo. You can contact support to discuss next steps.',
  },
  {
    q: 'How does billing work?',
    a: 'Plus One uses a wallet-based, pay-per-minute model. Add funds to your wallet via Razorpay, then chat or call companions at their listed per-minute rates. You only pay for time used — no subscriptions or hidden fees.',
  },
  {
    q: 'What are the minimum and maximum recharge amounts?',
    a: 'Minimum recharge is ₹100 and maximum single recharge is ₹50,000. Your wallet balance never expires.',
  },
  {
    q: 'Can I book companions for in-person meetings?',
    a: 'Yes. You can book in-person social activities like dinners, coffee meetups, events, or travel companionship through the platform at the companion\'s hourly rate. Meeting details including date, time, and venue are coordinated through the booking system.',
  },
  {
    q: 'What kind of companionship does Plus One offer?',
    a: 'Plus One is strictly for social companionship — dining, events, travel, parties, coffee meetups, and conversation (via chat or voice call). We do not facilitate dating, romantic, intimate, or any non-social services. Users who violate this policy are permanently banned.',
  },
  {
    q: 'How do I become a companion?',
    a: 'Companion profiles are created by the Plus One team. If you\'re interested in joining as a companion, email us at support@plusone.app with your details.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. We use encrypted connections, secure authentication, and never share your personal information with other users. Government IDs are stored in a secure, access-controlled environment and are only viewed by our verification team.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email us anytime at support@plusone.app. We typically respond within 24 hours.',
  },
  {
    q: 'Can I delete my account?',
    a: 'Yes. Contact support at support@plusone.app to request account deletion. Any remaining wallet balance will be refunded as per our refund policy.',
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-charcoal text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="mb-10">
          <Link href="/" className="text-gold hover:text-gold/80 text-sm transition-colors">
            &larr; Back to home
          </Link>
          <h1 className="text-3xl font-bold text-gold mt-4 mb-2">Frequently Asked Questions</h1>
          <p className="text-white/50 text-sm">Everything you need to know about Plus One</p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <section key={i} className="bg-charcoal-surface/50 border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-base font-semibold text-white mb-2">{faq.q}</h2>
              <p className="text-white/70 text-sm leading-relaxed">{faq.a}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center space-y-3">
          <p className="text-white/40 text-sm">
            Still have questions?
          </p>
          <a
            href="mailto:support@plusone.app"
            className="inline-block text-gold hover:underline text-sm"
          >
            support@plusone.app
          </a>
        </div>
      </div>
    </div>
  );
}
