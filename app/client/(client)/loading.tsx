export default function ClientLoading() {
  return (
    <div className="min-h-screen bg-charcoal p-4 animate-pulse">
      <div className="h-8 w-40 bg-white/[0.06] rounded-lg mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-white/[0.06] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
