import Link from 'next/link';

export default function ApplicationSubmittedPage() {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <div>
          <h1 className="text-4xl font-serif font-bold text-gold">Plus One</h1>
        </div>

        {/* Status icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">Application Received</h2>
          <p className="text-white/60 leading-relaxed">
            Thank you for applying. Our team will review your application and
            email you within <strong className="text-white">24–48 hours</strong>.
          </p>
        </div>

        {/* What happens next */}
        <div className="text-left bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <p className="text-xs text-white/40 uppercase tracking-widest">What happens next</p>
          <ol className="space-y-3 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="text-gold font-semibold shrink-0">1.</span>
              <span>Our team reviews your LinkedIn profile and application details.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-gold font-semibold shrink-0">2.</span>
              <span>You complete a quick Aadhaar identity verification (takes 2 minutes).</span>
            </li>
            <li className="flex gap-3">
              <span className="text-gold font-semibold shrink-0">3.</span>
              <span>Once approved, you'll receive an email and can access the platform immediately.</span>
            </li>
          </ol>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <p className="text-sm text-white/50">
            Already submitted? Log in to check your status and complete identity verification.
          </p>
          <Link
            href="/login"
            className="block w-full py-3 px-6 bg-gold text-charcoal font-semibold rounded-lg hover:bg-gold/90 transition-colors text-center"
          >
            Log In to Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
