export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-charcoal p-6 animate-pulse">
      <div className="h-8 w-48 bg-white/[0.06] rounded-lg mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.06] rounded-xl" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-64 bg-white/[0.06] rounded-xl" />
        <div className="h-64 bg-white/[0.06] rounded-xl" />
      </div>
    </div>
  );
}
