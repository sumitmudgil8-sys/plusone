'use client';

import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-white/60">Overview of your platform</p>
      </div>

      <AdminDashboard />
    </div>
  );
}
