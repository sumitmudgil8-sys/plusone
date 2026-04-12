'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

interface ClientCard {
  visibilityId: string;
  clientId: string;
  status: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  occupation: string | null;
  city: string | null;
  dateOfBirth: string | null;
  joinedAt: string;
}

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
}

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

function getAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Swipeable Card ──────────────────────────────────────────────────────────
function SwipeCard({
  client,
  onApprove,
  onReject,
  isTop,
}: {
  client: ClientCard;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isTop: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const age = getAge(client.dateOfBirth);

  const handleStart = useCallback((clientX: number) => {
    if (!isTop) return;
    isDraggingRef.current = true;
    startXRef.current = clientX;
    currentXRef.current = 0;
  }, [isTop]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - startXRef.current;
    currentXRef.current = dx;
    setDragX(dx);
  }, []);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const threshold = 100;
    if (currentXRef.current > threshold) {
      setExiting('right');
      setTimeout(() => onApprove(client.clientId), 300);
    } else if (currentXRef.current < -threshold) {
      setExiting('left');
      setTimeout(() => onReject(client.clientId), 300);
    } else {
      setDragX(0);
    }
  }, [client.clientId, onApprove, onReject]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  }, [handleStart]);

  useEffect(() => {
    if (!isTop) return;
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isTop, handleMove, handleEnd]);

  const rotation = dragX * 0.08;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 400);
  const approveOpacity = Math.min(1, Math.max(0, dragX / 100));
  const rejectOpacity = Math.min(1, Math.max(0, -dragX / 100));

  let transform = `translateX(${dragX}px) rotate(${rotation}deg)`;
  let transitionVal = isDraggingRef.current ? 'none' : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease';

  if (exiting === 'right') {
    transform = 'translateX(120vw) rotate(30deg)';
    transitionVal = 'transform 0.4s ease-in, opacity 0.3s ease';
  } else if (exiting === 'left') {
    transform = 'translateX(-120vw) rotate(-30deg)';
    transitionVal = 'transform 0.4s ease-in, opacity 0.3s ease';
  }

  if (!isTop) {
    transform = 'scale(0.95) translateY(12px)';
    transitionVal = 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)';
  }

  const handleButtonApprove = () => {
    if (exiting) return;
    setExiting('right');
    setTimeout(() => onApprove(client.clientId), 300);
  };

  const handleButtonReject = () => {
    if (exiting) return;
    setExiting('left');
    setTimeout(() => onReject(client.clientId), 300);
  };

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 select-none"
      style={{
        transform,
        transition: transitionVal,
        opacity: exiting ? 0.8 : opacity,
        zIndex: isTop ? 10 : 5,
        cursor: isTop ? 'grab' : 'default',
        touchAction: 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={isTop ? onMouseDown : undefined}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-[#161620] via-[#111118] to-[#0d0d14] shadow-2xl">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-amber-500/[0.06] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-purple-500/[0.04] blur-3xl pointer-events-none" />

        {/* APPROVE overlay stamp */}
        <div
          className="absolute top-8 left-6 z-20 pointer-events-none"
          style={{ opacity: approveOpacity }}
        >
          <div className="border-[3px] border-green-400 rounded-xl px-4 py-2 -rotate-12">
            <span className="text-green-400 font-black text-2xl tracking-wider uppercase">Approve</span>
          </div>
        </div>

        {/* REJECT overlay stamp */}
        <div
          className="absolute top-8 right-6 z-20 pointer-events-none"
          style={{ opacity: rejectOpacity }}
        >
          <div className="border-[3px] border-red-400 rounded-xl px-4 py-2 rotate-12">
            <span className="text-red-400 font-black text-2xl tracking-wider uppercase">Reject</span>
          </div>
        </div>

        {/* Card content */}
        <div className="relative flex flex-col items-center justify-center h-full px-6 py-8">
          {/* Avatar */}
          <div className="relative mb-6">
            <div className="w-28 h-28 rounded-full ring-4 ring-amber-500/20 overflow-hidden bg-white/[0.04]">
              {client.avatarUrl ? (
                <img src={client.avatarUrl} alt={client.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-purple-500/20">
                  <span className="text-4xl font-bold text-white/60">
                    {client.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* New badge */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg shadow-amber-500/30">
              NEW
            </div>
          </div>

          {/* Name + Age */}
          <h3 className="text-2xl font-bold text-white mb-1">
            {client.name}{age ? <span className="text-white/40 font-normal">, {age}</span> : ''}
          </h3>

          {/* City & Occupation */}
          <div className="flex items-center gap-2 text-sm text-white/45 mb-4">
            {client.city && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {client.city}
              </span>
            )}
            {client.city && client.occupation && <span className="text-white/20">|</span>}
            {client.occupation && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {client.occupation}
              </span>
            )}
          </div>

          {/* Bio */}
          {client.bio && (
            <div className="w-full max-w-xs mb-6">
              <p className="text-sm text-white/50 text-center leading-relaxed line-clamp-3">
                &ldquo;{client.bio}&rdquo;
              </p>
            </div>
          )}

          {/* Joined date */}
          <div className="flex items-center gap-1.5 text-xs text-white/25 mb-8">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Joined {timeAgo(client.joinedAt)}
          </div>

          {/* Action buttons */}
          {isTop && (
            <div className="flex items-center gap-5">
              {/* Reject button */}
              <button
                onClick={handleButtonReject}
                className="group w-16 h-16 rounded-full border-2 border-red-500/30 bg-red-500/[0.08] flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/50 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shadow-red-500/10"
              >
                <svg className="w-7 h-7 text-red-400 group-hover:text-red-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Approve button */}
              <button
                onClick={handleButtonApprove}
                className="group w-20 h-20 rounded-full border-2 border-green-500/30 bg-green-500/[0.08] flex items-center justify-center hover:bg-green-500/20 hover:border-green-500/50 hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg shadow-green-500/10"
              >
                <svg className="w-9 h-9 text-green-400 group-hover:text-green-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#0d0d14] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

// ─── List View (for Approved / Rejected tabs) ────────────────────────────────
function ClientListItem({
  client,
  onUndo,
}: {
  client: ClientCard;
  onUndo?: (id: string, action: 'APPROVED' | 'REJECTED') => void;
}) {
  const age = getAge(client.dateOfBirth);
  const isApproved = client.status === 'APPROVED';

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.08] transition-colors group">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full overflow-hidden bg-white/[0.04] shrink-0">
        {client.avatarUrl ? (
          <img src={client.avatarUrl} alt={client.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/15 to-purple-500/15">
            <span className="text-lg font-bold text-white/50">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {client.name}{age ? <span className="text-white/40 font-normal">, {age}</span> : ''}
        </p>
        <p className="text-xs text-white/35 truncate">
          {[client.city, client.occupation].filter(Boolean).join(' · ') || 'No details'}
        </p>
      </div>

      {/* Status badge + undo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
          isApproved
            ? 'bg-green-500/15 text-green-400 border border-green-500/20'
            : 'bg-red-500/15 text-red-400 border border-red-500/20'
        }`}>
          {isApproved ? 'Visible' : 'Hidden'}
        </span>

        {onUndo && (
          <button
            onClick={() => onUndo(client.clientId, isApproved ? 'REJECTED' : 'APPROVED')}
            className="opacity-0 group-hover:opacity-100 text-xs text-white/40 hover:text-amber-400 transition-all px-2 py-1 rounded-lg bg-white/[0.04]"
            title={isApproved ? 'Revoke visibility' : 'Approve this client'}
          >
            {isApproved ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ClientApprovalsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('PENDING');
  const [clients, setClients] = useState<ClientCard[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async (status: Tab) => {
    try {
      const res = await fetch(`/api/companion/client-approvals?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.data.clients);
        setCounts(data.data.counts);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchClients(activeTab);
  }, [activeTab, fetchClients]);

  const handleAction = useCallback(async (clientId: string, action: 'APPROVED' | 'REJECTED') => {
    // Optimistically remove from current list
    setClients((prev) => prev.filter((c) => c.clientId !== clientId));
    setCounts((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - (activeTab === 'PENDING' ? 1 : 0)),
      approved: prev.approved + (action === 'APPROVED' ? 1 : 0) - (activeTab === 'APPROVED' ? 1 : 0),
      rejected: prev.rejected + (action === 'REJECTED' ? 1 : 0) - (activeTab === 'REJECTED' ? 1 : 0),
    }));

    try {
      const res = await fetch('/api/companion/client-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, action }),
      });
      if (!res.ok) {
        toast.error('Failed to update — please try again');
        fetchClients(activeTab);
      } else {
        toast.success(action === 'APPROVED' ? 'Client approved' : 'Client hidden');
      }
    } catch {
      toast.error('Network error');
      fetchClients(activeTab);
    }
  }, [activeTab, fetchClients, toast]);

  const handleApprove = useCallback((clientId: string) => handleAction(clientId, 'APPROVED'), [handleAction]);
  const handleReject = useCallback((clientId: string) => handleAction(clientId, 'REJECTED'), [handleAction]);

  const handleUndo = useCallback(async (clientId: string, newAction: 'APPROVED' | 'REJECTED') => {
    await handleAction(clientId, newAction);
    fetchClients(activeTab);
  }, [handleAction, activeTab, fetchClients]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'PENDING', label: 'New', count: counts.pending },
    { key: 'APPROVED', label: 'Approved', count: counts.approved },
    { key: 'REJECTED', label: 'Hidden', count: counts.rejected },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/[0.12] bg-gradient-to-br from-amber-500/[0.08] via-[#0f0f1a] to-[#0f0f1a] p-5">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/[0.12] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-purple-500/[0.06] blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/companion/dashboard"
              className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-400/90 font-bold">Privacy Control</p>
              <h1 className="text-xl font-bold text-white mt-0.5">Client Approvals</h1>
            </div>
          </div>
          <p className="text-xs text-white/40 mt-2 ml-11">
            Swipe right to approve, left to hide. Only approved clients can see your profile.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === tab.key
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 shadow-lg shadow-amber-500/5'
                : 'text-white/35 hover:text-white/55 hover:bg-white/[0.03]'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                activeTab === tab.key
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/[0.08] text-white/40'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* PENDING tab — Swipe cards */}
      {!loading && activeTab === 'PENDING' && (
        <>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-green-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">All caught up!</h3>
              <p className="text-sm text-white/40 max-w-xs">
                No new clients to review. You&apos;ll see new requests here when clients join the platform.
              </p>
            </div>
          ) : (
            <>
              {/* Swipe instruction hint */}
              <div className="flex items-center justify-center gap-6 text-xs text-white/25 py-1">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-red-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Hide
                </span>
                <span className="text-white/15">|</span>
                <span className="flex items-center gap-1">
                  Approve
                  <svg className="w-4 h-4 text-green-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              </div>

              {/* Card stack */}
              <div className="relative w-full" style={{ height: '460px' }}>
                {clients.slice(0, 3).map((client, index) => (
                  <SwipeCard
                    key={client.clientId}
                    client={client}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    isTop={index === 0}
                  />
                ))}
              </div>

              {/* Counter */}
              <p className="text-center text-xs text-white/25">
                {clients.length} client{clients.length !== 1 ? 's' : ''} remaining
              </p>
            </>
          )}
        </>
      )}

      {/* APPROVED / REJECTED tabs — List view */}
      {!loading && activeTab !== 'PENDING' && (
        <>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-white/40">
                No {activeTab === 'APPROVED' ? 'approved' : 'hidden'} clients yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <ClientListItem key={client.clientId} client={client} onUndo={handleUndo} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
