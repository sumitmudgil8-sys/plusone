import { AdminNav } from '@/components/layout/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      <AdminNav />

      <div className="pt-32 md:pt-20 pb-6">
        <main className="max-w-7xl mx-auto px-4">{children}</main>
      </div>
    </div>
  );
}
