export default function CompanionLoading() {
  return (
    <div className="min-h-screen bg-charcoal p-4 animate-pulse">
      <div className="h-8 w-40 bg-white/[0.06] rounded-lg mb-6" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-white/[0.06] rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.06] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
