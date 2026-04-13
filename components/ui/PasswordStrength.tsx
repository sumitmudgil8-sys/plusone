'use client';

interface PasswordStrengthProps {
  password: string;
}

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const passed = RULES.filter((r) => r.test(password)).length;
  const strength = passed <= 1 ? 'Weak' : passed <= 2 ? 'Fair' : passed <= 3 ? 'Good' : 'Strong';
  const barColor =
    passed <= 1 ? 'bg-red-500' : passed <= 2 ? 'bg-amber-500' : passed <= 3 ? 'bg-blue-400' : 'bg-green-500';

  return (
    <div className="space-y-2 mt-1.5">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i < passed ? barColor : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        passed <= 1 ? 'text-red-400' : passed <= 2 ? 'text-amber-400' : passed <= 3 ? 'text-blue-400' : 'text-green-400'
      }`}>
        {strength}
      </p>

      {/* Rules checklist */}
      <div className="space-y-1">
        {RULES.map((rule) => {
          const pass = rule.test(password);
          return (
            <div key={rule.label} className="flex items-center gap-2">
              {pass ? (
                <svg className="w-3 h-3 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-3 h-3 rounded-full border border-white/20 shrink-0" />
              )}
              <span className={`text-xs ${pass ? 'text-white/50' : 'text-white/30'}`}>{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
