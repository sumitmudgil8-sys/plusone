'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface EarningsData {
  total: number;
  today: number;
  thisWeek: number;
  completedSessions: number;
}

interface SessionRecord {
  id: string;
  type: string;
  clientName: string;
  clientAvatar: string | null;
  durationMinutes: number;
  earned: number;
  startedAt: string;
  endedAt: string | null;
}

interface BlockedRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  blockedAt: string;
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [blocked, setBlocked] = useState<BlockedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [eRes, sRes, bRes] = await Promise.all([
          fetch('/api/companion/earnings'),
          fetch('/api/companion/sessions?limit=50'),
          fetch('/api/companion/blocked'),
        ]);

        if (eRes.ok) {
          const d = await eRes.json();
          setEarnings(d.data);
        }
        if (sRes.ok) {
          const d = await sRes.json();
          setSessions(d.data?.sessions ?? []);
        }
        if (bRes.ok) {
          const d = await bRes.json();
          setBlocked(d.data?.blocked ?? []);
        }
      } catch (error) {
        console.error('Earnings page fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUnblock = async (id: string) => {
    setUnblockingId(id);
    try {
      const res = await fetch(`/api/companion/block/${id}`, { method: 'DELETE' });
      if (res.ok) setBlocked((prev) => prev.filter((b) => b.id !== id));
    } catch { /* non-fatal */ } finally {
      setUnblockingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Earnings</h1>
        <p className="text-white/60">Track your income and sessions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-bold text-gold">{formatCurrency(earnings?.total ?? 0)}</p>
          <p className="text-xs text-white/50 mt-1">Total Earned</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-white">{formatCurrency(earnings?.today ?? 0)}</p>
          <p className="text-xs text-white/50 mt-1">Today</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-white">{formatCurrency(earnings?.thisWeek ?? 0)}</p>
          <p className="text-xs text-white/50 mt-1">This Week</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-white">{earnings?.completedSessions ?? 0}</p>
          <p className="text-xs text-white/50 mt-1">Sessions Done</p>
        </Card>
      </div>

      {/* Session History */}
      <Card>
        <h2 className="font-medium text-white mb-4">Session History</h2>
        {sessions.length === 0 ? (
          <p className="text-white/50 text-center py-8 text-sm">No sessions yet</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {sessions.map((s) => (
              <div key={s.id} className="py-3 flex items-center gap-3">
                {s.clientAvatar ? (
                  <img src={s.clientAvatar} alt={s.clientName}
                    className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-white">{s.clientName[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.clientName}</p>
                  <p className="text-xs text-white/40">
                    {s.type} · {s.durationMinutes} min
                    {s.endedAt ? ` · ${formatDateTime(s.endedAt)}` : ''}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-400 shrink-0">
                  +{formatCurrency(s.earned)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Blocked Clients */}
      <Card>
        <h2 className="font-medium text-white mb-4">Blocked Clients</h2>
        {blocked.length === 0 ? (
          <p className="text-white/50 text-center py-6 text-sm">No blocked clients</p>
        ) : (
          <div className="divide-y divide-charcoal-border">
            {blocked.map((b) => (
              <div key={b.id} className="py-3 flex items-center gap-3">
                {b.clientAvatar ? (
                  <img src={b.clientAvatar} alt={b.clientName}
                    className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-charcoal-border flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-white">{b.clientName[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{b.clientName}</p>
                  <p className="text-xs text-white/40">Blocked {formatDateTime(b.blockedAt)}</p>
                </div>
                <button
                  onClick={() => handleUnblock(b.id)}
                  disabled={unblockingId === b.id}
                  className="text-xs text-white/50 hover:text-red-400 transition-colors disabled:opacity-40"
                >
                  {unblockingId === b.id ? '…' : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
