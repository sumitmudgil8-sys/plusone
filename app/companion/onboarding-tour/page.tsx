'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Screen data ─────────────────────────────────────────────────────────────

const TOTAL_SCREENS = 8;

interface SimMessage {
  from: 'client' | 'companion';
  text: string;
}

interface SimOption {
  label: string;
  correct: boolean;
  feedback: string;
}

const SIM_CONVERSATION: SimMessage[] = [
  { from: 'client', text: 'Hey! I saw your profile. Are you available this Saturday?' },
  { from: 'companion', text: 'Hi! Yes, I am. What event do you have in mind?' },
  { from: 'client', text: 'It\'s a cocktail party at a rooftop lounge. Would love some company.' },
  { from: 'companion', text: 'Sounds great! I\'d be happy to join. Can you share the time and venue details?' },
  { from: 'client', text: 'Sure. 8 PM at Sky Lounge, Connaught Place. By the way, can we meet privately after?' },
];

const SIM_OPTIONS: SimOption[] = [
  {
    label: 'Sure, we can figure that out later!',
    correct: false,
    feedback: 'This implies you\'re open to non-social requests. Plus One is strictly for social companionship — events, dining, travel, and conversation only.',
  },
  {
    label: 'I appreciate the invite! I\'m only available for the event itself. Looking forward to it!',
    correct: true,
    feedback: 'Perfect! You maintained a professional and warm tone while clearly setting boundaries. This is exactly how to handle these situations.',
  },
  {
    label: 'That\'s against the rules. Don\'t message me again.',
    correct: false,
    feedback: 'While the boundary is correct, this tone is unnecessarily harsh. A polite redirect keeps the client engaged for legitimate bookings.',
  },
];

// ─── Reusable sub-components ─────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i <= current ? 'bg-gold' : 'bg-white/[0.08]'
          }`}
        />
      ))}
    </div>
  );
}

function ScreenWrapper({
  children,
  icon,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      {subtitle && <p className="text-white/50 text-sm mb-8 max-w-sm">{subtitle}</p>}
      <div className="w-full text-left">{children}</div>
    </div>
  );
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? 'bg-gold/10 border border-gold/20' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
      <p className={`text-xs font-medium mb-1 ${accent ? 'text-gold' : 'text-white/40'}`}>{label}</p>
      <p className={`text-sm font-semibold ${accent ? 'text-gold' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ComparisonCard({ title, items, good }: { title: string; items: string[]; good: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${good ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-red-500/[0.06] border-red-500/20'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-lg ${good ? 'text-emerald-400' : 'text-red-400'}`}>
          {good ? '\u2713' : '\u2717'}
        </span>
        <p className={`text-sm font-semibold ${good ? 'text-emerald-400' : 'text-red-400'}`}>{title}</p>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-0.5 text-xs ${good ? 'text-emerald-400/60' : 'text-red-400/60'}`}>&bull;</span>
            <span className="text-sm text-white/70">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
        <span className="text-sm font-bold text-gold">{number}</span>
      </div>
      <p className="text-sm text-white/70 pt-1">{text}</p>
    </div>
  );
}

// ─── Individual screens ──────────────────────────────────────────────────────

function WelcomeScreen() {
  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
      title="Welcome to Plus One"
      subtitle="You're about to join a curated network of social companions. Let's walk through how it works."
    >
      <div className="space-y-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
          <p className="text-sm text-white/70 leading-relaxed">
            Plus One connects you with clients looking for social companionship — dinners, events,
            travel, coffee meetups, and conversation. You set your availability, clients discover you,
            and every interaction is transparent, safe, and professionally managed.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Service type" value="Social companionship" accent />
          <InfoCard label="Activities" value="Events, dining, travel" />
          <InfoCard label="Billing" value="Per-minute for virtual" />
          <InfoCard label="Safety" value="Verified users only" />
        </div>
      </div>
    </ScreenWrapper>
  );
}

function EarningsScreen() {
  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      title="How You Earn"
      subtitle="Transparent, per-minute billing with no hidden fees."
    >
      <div className="space-y-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/50">Chat sessions</span>
            <span className="text-sm text-white font-medium">Your set rate per minute</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/50">Voice calls</span>
            <span className="text-sm text-white font-medium">Your set rate per minute</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/50">In-person bookings</span>
            <span className="text-sm text-white font-medium">Your hourly rate</span>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/50">Your share</span>
              <span className="text-sm text-gold font-bold">40% of billed amount</span>
            </div>
          </div>
        </div>

        <div className="bg-gold/[0.06] border border-gold/15 rounded-xl p-4">
          <p className="text-xs text-gold font-medium mb-2">Example</p>
          <p className="text-sm text-white/70">
            If your chat rate is &#8377;20/min and a client chats for 30 minutes,
            the total is &#8377;600. You earn <span className="text-gold font-semibold">&#8377;240</span> (40%).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Payouts" value="Weekly withdrawals" />
          <InfoCard label="Minimum withdrawal" value="&#8377;500" />
        </div>
      </div>
    </ScreenWrapper>
  );
}

function ExpectationsScreen() {
  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
      title="Client Expectations"
      subtitle="Understand what clients expect and how to respond professionally."
    >
      <div className="space-y-4">
        <ComparisonCard
          title="Great responses"
          good
          items={[
            '"I\'d love to join you at the event! Can you share the details?"',
            '"That sounds like a fun evening. Let me check my availability."',
            '"Thanks for reaching out! I\'m available for social events this weekend."',
          ]}
        />
        <ComparisonCard
          title="Responses to avoid"
          good={false}
          items={[
            'Agreeing to anything beyond social companionship',
            'Being rude or dismissive to clients',
            'Sharing personal contact details or meeting off-platform',
          ]}
        />
      </div>
    </ScreenWrapper>
  );
}

function RulesScreen() {
  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
      title="Platform Guidelines"
      subtitle="These rules protect you, your clients, and the platform."
    >
      <div className="space-y-3">
        {[
          { rule: 'Social companionship only', desc: 'Events, dining, travel, and conversation. No intimate, romantic, or sexual services — ever.' },
          { rule: 'Stay on platform', desc: 'All communication and payments must go through Plus One. Do not share personal phone numbers or social media.' },
          { rule: 'Respect and professionalism', desc: 'Treat every client with courtesy. Harassment, discrimination, or abusive behavior results in instant removal.' },
          { rule: 'Honest availability', desc: 'Only mark yourself as available when you can genuinely accept sessions. Don\'t ghost clients.' },
          { rule: 'No substance use during sessions', desc: 'Stay sober and present during all interactions — virtual and in-person.' },
          { rule: 'Report violations', desc: 'If a client makes inappropriate requests, report them immediately. You\'ll never be penalized for reporting.' },
        ].map((item, i) => (
          <div key={i} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-1">{item.rule}</p>
            <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </ScreenWrapper>
  );
}

function HowItWorksScreen() {
  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
      title="How Sessions Work"
      subtitle="From request to payment — here's the flow."
    >
      <div className="space-y-4">
        <StepItem number={1} text="A client discovers your profile and sends a chat or call request." />
        <StepItem number={2} text="You receive a notification. Accept or decline — no pressure." />
        <StepItem number={3} text="Once accepted, the billing timer starts. Chat, call, or schedule an in-person meetup." />
        <StepItem number={4} text="Either party can end the session. Billing stops immediately." />
        <StepItem number={5} text="Your 40% share is credited to your companion wallet instantly." />
        <StepItem number={6} text="Request withdrawals anytime — processed weekly." />

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mt-4">
          <p className="text-xs text-white/40 mb-2">For in-person bookings:</p>
          <p className="text-sm text-white/70">
            Clients book through the platform with date, time, and venue.
            A wallet hold is placed upfront. You can accept or decline the booking,
            and coordinate details through the platform&apos;s messaging system.
          </p>
        </div>
      </div>
    </ScreenWrapper>
  );
}

function AvailabilityScreen() {
  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      title="Availability Matters"
      subtitle="Being responsive and available directly impacts your earnings and ranking."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label="Fast response" value="Higher ranking" accent />
          <InfoCard label="Consistent hours" value="More bookings" accent />
          <InfoCard label="Go offline" value="When unavailable" />
          <InfoCard label="Weekly schedule" value="Set recurring slots" />
        </div>

        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <p className="text-sm text-white font-medium">Tips for success</p>
          <ul className="space-y-2">
            {[
              'Set a weekly schedule so clients know when to find you',
              'Respond to requests within 3 minutes for the best ranking',
              'Go offline when you\'re busy — don\'t leave clients waiting',
              'Complete your profile (photos, bio, audio intro) to stand out',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-gold text-xs">&bull;</span>
                <span className="text-sm text-white/60">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScreenWrapper>
  );
}

function SimulationScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleSelect = (idx: number) => {
    setSelectedOption(idx);
    setShowFeedback(true);
  };

  const isCorrect = selectedOption !== null && SIM_OPTIONS[selectedOption].correct;

  return (
    <ScreenWrapper
      icon={<svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
      title="Practice Scenario"
      subtitle="A client sends you this message. How would you respond?"
    >
      <div className="space-y-3">
        {/* Chat messages */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
          {SIM_CONVERSATION.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.from === 'companion' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.from === 'companion'
                    ? 'bg-gold/15 text-white rounded-br-md'
                    : 'bg-white/[0.08] text-white/80 rounded-bl-md'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Response options */}
        <p className="text-xs text-white/40 pt-2">Choose your response:</p>
        <div className="space-y-2">
          {SIM_OPTIONS.map((opt, i) => {
            const isSelected = selectedOption === i;
            let borderClass = 'border-white/[0.06] hover:border-white/20';
            if (showFeedback && isSelected) {
              borderClass = opt.correct ? 'border-emerald-500/50 bg-emerald-500/[0.06]' : 'border-red-500/50 bg-red-500/[0.06]';
            }
            if (showFeedback && opt.correct && !isSelected) {
              borderClass = 'border-emerald-500/30 bg-emerald-500/[0.04]';
            }

            return (
              <button
                key={i}
                onClick={() => !showFeedback && handleSelect(i)}
                disabled={showFeedback}
                className={`w-full text-left rounded-xl p-4 border transition-all ${borderClass} ${
                  showFeedback ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <p className="text-sm text-white/80">{opt.label}</p>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {showFeedback && selectedOption !== null && (
          <div
            className={`rounded-xl p-4 border ${
              isCorrect
                ? 'bg-emerald-500/[0.06] border-emerald-500/20'
                : 'bg-amber-500/[0.06] border-amber-500/20'
            }`}
          >
            <p className={`text-sm font-medium mb-1 ${isCorrect ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isCorrect ? 'Correct!' : 'Not quite right'}
            </p>
            <p className="text-sm text-white/60">{SIM_OPTIONS[selectedOption].feedback}</p>
            {!isCorrect && (
              <button
                onClick={onComplete}
                className="mt-3 text-sm text-gold hover:text-gold-hover transition-colors font-medium"
              >
                Got it, continue &rarr;
              </button>
            )}
          </div>
        )}
      </div>
    </ScreenWrapper>
  );
}

function ActivationScreen({ onActivate, loading }: { onActivate: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">You&apos;re Ready!</h2>
      <p className="text-white/50 text-sm mb-8 max-w-sm">
        You&apos;ve completed the onboarding tour. You now understand how Plus One works,
        what clients expect, and how to earn. Time to go live!
      </p>

      <div className="w-full space-y-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
          <p className="text-sm text-white/70 leading-relaxed">
            After activating, complete your profile — add photos, write a compelling bio,
            and set your availability schedule. Companions with complete profiles get
            <span className="text-gold font-medium"> 3x more bookings</span>.
          </p>
        </div>

        <button
          onClick={onActivate}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-gold hover:bg-gold-hover text-black font-bold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Activating...' : 'Go Online \u2192'}
        </button>
      </div>
    </div>
  );
}

// ─── Main onboarding tour page ───────────────────────────────────────────────

export default function OnboardingTourPage() {
  const router = useRouter();
  const [screen, setScreen] = useState(0);
  const [simCompleted, setSimCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skipWarning, setSkipWarning] = useState(false);

  const canGoNext = () => {
    // On simulation screen, must complete it first
    if (screen === 6 && !simCompleted) return false;
    return screen < TOTAL_SCREENS - 1;
  };

  const handleNext = () => {
    if (canGoNext()) {
      setScreen((s) => s + 1);
      setSkipWarning(false);
    }
  };

  const handleBack = () => {
    if (screen > 0) {
      setScreen((s) => s - 1);
      setSkipWarning(false);
    }
  };

  const handleSimComplete = useCallback(() => {
    setSimCompleted(true);
  }, []);

  const handleSkip = () => {
    if (!skipWarning) {
      setSkipWarning(true);
      return;
    }
    // Second click — skip to activation screen
    setScreen(TOTAL_SCREENS - 1);
    setSkipWarning(false);
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companion/onboarding/complete', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        router.push('/companion/dashboard');
      }
    } catch {
      // Retry once
      try {
        await fetch('/api/companion/onboarding/complete', { method: 'POST' });
        router.push('/companion/dashboard');
      } catch {
        setLoading(false);
      }
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 0: return <WelcomeScreen />;
      case 1: return <EarningsScreen />;
      case 2: return <ExpectationsScreen />;
      case 3: return <RulesScreen />;
      case 4: return <HowItWorksScreen />;
      case 5: return <AvailabilityScreen />;
      case 6: return <SimulationScreen onComplete={handleSimComplete} />;
      case 7: return <ActivationScreen onActivate={handleActivate} loading={loading} />;
      default: return null;
    }
  };

  const isLastScreen = screen === TOTAL_SCREENS - 1;

  return (
    <div className="fixed inset-0 z-[9998] bg-charcoal overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-charcoal/95 backdrop-blur-sm border-b border-white/[0.06]"
             style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="max-w-lg mx-auto px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-serif font-bold text-gold">Plus One</h1>
              {!isLastScreen && screen < 7 && (
                <button
                  onClick={handleSkip}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  {skipWarning ? 'Are you sure? Tap again to skip' : 'Skip tour'}
                </button>
              )}
            </div>
            <ProgressBar current={screen} total={TOTAL_SCREENS} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-start justify-center px-5 py-8">
          <div className="w-full max-w-lg">{renderScreen()}</div>
        </div>

        {/* Navigation footer */}
        {!isLastScreen && (
          <div className="sticky bottom-0 bg-charcoal/95 backdrop-blur-sm border-t border-white/[0.06]"
               style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between gap-3">
              <button
                onClick={handleBack}
                disabled={screen === 0}
                className="px-5 py-2.5 rounded-xl border border-white/[0.08] text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
              >
                Back
              </button>

              <span className="text-xs text-white/30">
                {screen + 1} / {TOTAL_SCREENS}
              </span>

              <button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-hover text-black font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {screen === 6 && simCompleted ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
