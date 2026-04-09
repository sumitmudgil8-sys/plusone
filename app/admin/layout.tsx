import { AdminNav } from '@/components/layout/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-charcoal flex flex-col">
      <AdminNav />

      <div className="pt-16 pb-24">
        <main className="max-w-7xl mx-auto px-4">{children}</main>
      </div>
    </div>
  );
}
