'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanionImageRecord {
  id: string;
  imageUrl: string;
  publicId: string | null;
  isPrimary: boolean;
  createdAt: string;
}

interface CompanionProfileData {
  name: string;
  bio: string;
  tagline: string;
  age: string;
  gender: string;
  city: string;
  languages: string[];
  education: string;
  occupation: string;
  height: string;
  weight: string;
  bodyType: string;
  hairColor: string;
  eyeColor: string;
  ethnicity: string;
  foodPreference: string;
  drinking: string;
  smoking: string;
  personalityTags: string[];
  chatRatePerMinute: number;
  callRatePerMinute: number;
  hourlyRate: number;
  avatarUrl: string;
  isApproved: boolean;
}

interface UserRecord {
  id: string;
  isTemporaryPassword: boolean;
  companionProfile?: Partial<CompanionProfileData> & { availability?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSONALITY_PRESETS = [
  'Adventurous', 'Intellectual', 'Funny', 'Calm', 'Romantic',
  'Sporty', 'Artistic', 'Foodie', 'Traveller', 'Music lover', 'Night owl', 'Morning person',
];

const BODY_TYPES = ['Slim', 'Athletic', 'Average', 'Curvy', 'Heavy'];
const FOOD_OPTIONS = ['Veg', 'Non-veg', 'Vegan', 'No preference'];
const HABIT_OPTIONS = ['Never', 'Socially', 'Regularly'];

// ─── SelectField ─────────────────────────────────────────────────────────────

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CompanionProfilePage() {
  const toast = useToast();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Section state
  const [section1, setSection1] = useState({
    name: '', bio: '', tagline: '', age: '', gender: '', city: '',
    languages: [] as string[], education: '', occupation: '',
  });
  const [section2, setSection2] = useState({
    height: '', weight: '', bodyType: '', hairColor: '', eyeColor: '',
    ethnicity: '', foodPreference: '', drinking: '', smoking: '',
  });
  const [section3, setSection3] = useState({ personalityTags: [] as string[] });

  // Gallery state
  const [images, setImages] = useState<CompanionImageRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Intro video
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Per-section saving
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Security
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const securityRef = useRef<HTMLDivElement>(null);

  // Preview card image index
  const [previewIdx, setPreviewIdx] = useState(0);

  // Track initial data for unsaved-changes warning
  const initialDataRef = useRef<{ s1: typeof section1; s2: typeof section2; s3: typeof section3 } | null>(null);

  useEffect(() => {
    fetchUser();
    fetchImages();
  }, []);

  // Unsaved changes warning (beforeunload)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!initialDataRef.current) return;
      const dirty =
        JSON.stringify(section1) !== JSON.stringify(initialDataRef.current.s1) ||
        JSON.stringify(section2) !== JSON.stringify(initialDataRef.current.s2) ||
        JSON.stringify(section3) !== JSON.stringify(initialDataRef.current.s3);
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [section1, section2, section3]);

  const showToast = (msg: string, ok: boolean) => {
    if (ok) toast.success(msg);
    else toast.error(msg);
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const { user: u } = await res.json() as { user: UserRecord };
        setUser(u);
        const p = u.companionProfile ?? {};
        setAvatarUrl(p.avatarUrl ?? '');
        setIntroVideoUrl((p as Record<string, unknown>).introVideoUrl as string ?? '');

        // languages and personalityTags come from Prisma as JSON strings — parse them
        const parsedLangs = typeof p.languages === 'string' ? JSON.parse(p.languages || '[]') : (p.languages ?? []);
        const parsedPTags = typeof p.personalityTags === 'string' ? JSON.parse(p.personalityTags || '[]') : (p.personalityTags ?? []);

        setSection1({
          name: p.name ?? '', bio: p.bio ?? '', tagline: p.tagline ?? '',
          age: p.age != null ? String(p.age) : '', gender: p.gender ?? '', city: p.city ?? '',
          languages: parsedLangs, education: p.education ?? '', occupation: p.occupation ?? '',
        });
        setSection2({
          height: p.height ?? '', weight: p.weight ?? '', bodyType: p.bodyType ?? '',
          hairColor: p.hairColor ?? '', eyeColor: p.eyeColor ?? '', ethnicity: p.ethnicity ?? '',
          foodPreference: p.foodPreference ?? '', drinking: p.drinking ?? '', smoking: p.smoking ?? '',
        });
        setSection3({ personalityTags: parsedPTags });

        // Snapshot initial state for dirty-check
        initialDataRef.current = {
          s1: {
            name: p.name ?? '', bio: p.bio ?? '', tagline: p.tagline ?? '',
            age: p.age != null ? String(p.age) : '', gender: p.gender ?? '', city: p.city ?? '',
            languages: parsedLangs, education: p.education ?? '', occupation: p.occupation ?? '',
          },
          s2: {
            height: p.height ?? '', weight: p.weight ?? '', bodyType: p.bodyType ?? '',
            hairColor: p.hairColor ?? '', eyeColor: p.eyeColor ?? '', ethnicity: p.ethnicity ?? '',
            foodPreference: p.foodPreference ?? '', drinking: p.drinking ?? '', smoking: p.smoking ?? '',
          },
          s3: { personalityTags: parsedPTags },
        };
      }
    } catch { /* */ } finally { setLoading(false); }
  };

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/companion/images');
      if (res.ok) { const data = await res.json(); setImages(data.data.images); }
    } catch { /* */ }
  };

  // Avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { showToast('Only JPG, PNG, WebP allowed', false); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB', false); return; }
    setUploadingAvatar(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/companion/profile/avatar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.error ?? 'Upload failed', false); return; }
      setAvatarUrl(data.data.avatarUrl);
      showToast('Avatar updated', true);
    } catch { showToast('Upload failed', false); } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Section save helper
  const saveSection = async (key: string, payload: Record<string, unknown>) => {
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch('/api/companion/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.error ?? 'Save failed', false); return; }
      showToast('Saved', true);
      // Reset dirty state after successful save
      if (initialDataRef.current) {
        initialDataRef.current = { s1: { ...section1 }, s2: { ...section2 }, s3: { ...section3 } };
      }
    } catch { showToast('Save failed', false); } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  // Gallery handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setUploadError('Only JPG, PNG, WebP'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('Under 5 MB'); return; }
    setUploadError(''); setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/companion/images', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) { setUploadError(data.error ?? 'Upload failed'); return; }
      setImages((prev) => [data.data.image, ...prev]);
    } catch { setUploadError('Upload failed'); } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const res = await fetch(`/api/companion/images/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== id));
        toast.success('Photo removed');
      } else {
        toast.error('Failed to delete photo');
      }
    } catch {
      toast.error('Network error — please try again');
    }
  };

  const handleSetPrimary = async (id: string) => {
    setSettingPrimary(id);
    try {
      const res = await fetch('/api/companion/images/set-primary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: id }),
      });
      if (res.ok) {
        setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === id })));
        toast.success('Primary photo updated');
      } else {
        toast.error('Failed to set primary');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setSettingPrimary(null);
    }
  };

  // Video upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) { setVideoError('Only MP4, WebM, MOV allowed'); return; }
    if (file.size > 30 * 1024 * 1024) { setVideoError('Video must be under 30 MB'); return; }
    setVideoError(''); setUploadingVideo(true);
    const form = new FormData();
    form.append('file', file);
    form.append('type', 'video');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) { setVideoError(data.error ?? 'Upload failed'); return; }
      setIntroVideoUrl(data.data.url);
      showToast('Intro video uploaded', true);
    } catch { setVideoError('Upload failed'); } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // Password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess(false);
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('Passwords don\'t match'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('Min 8 characters'); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pwForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPwError(data.error ?? 'Failed'); return; }
      setPwSuccess(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setUser((prev) => prev ? { ...prev, isTemporaryPassword: false } : prev);
    } catch { setPwError('Something went wrong'); } finally { setPwLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isApproved = user?.companionProfile?.isApproved;
  const isTempPassword = user?.isTemporaryPassword === true;
  const allImages = images.length > 0 ? images : (avatarUrl ? [{ id: 'avatar', imageUrl: avatarUrl, publicId: null, isPrimary: true, createdAt: '' }] : []);
  const primaryImage = allImages.find(i => i.isPrimary) ?? allImages[0];

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* ── Temp password warning ────────────────────────────────────── */}
      {isTempPassword && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">Update your password</p>
            <p className="text-xs text-white/40">Temporary password active</p>
          </div>
          <button onClick={() => securityRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-xs text-red-400 font-medium">
            Change →
          </button>
        </div>
      )}

      {/* ── Approval badge ───────────────────────────────────────────── */}
      <div className={`mb-4 flex items-center gap-2.5 p-3 rounded-xl ${isApproved ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isApproved ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
          {isApproved ? (
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{isApproved ? 'Profile Live' : 'Under Review'}</p>
          <p className="text-xs text-white/40">{isApproved ? 'Clients can see your profile' : 'Pending admin approval'}</p>
        </div>
      </div>

      {/* Hidden file inputs — outside tab conditional so card buttons always work */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />

      {/* ── TINDER-STYLE PREVIEW CARD ───────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0f0f1a] mb-6 shadow-2xl">
        {/* Image area */}
        <div className="relative aspect-[3/4]">
          {allImages.length > 0 ? (
            <img
              src={allImages[previewIdx % allImages.length]?.imageUrl}
              alt={section1.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-400/10">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-center group"
              >
                <div className="w-20 h-20 rounded-full bg-white/10 group-hover:bg-amber-500/20 border-2 border-dashed border-white/20 group-hover:border-amber-500/50 flex items-center justify-center mx-auto mb-3 transition-all">
                  {uploading ? (
                    <div className="animate-spin w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full" />
                  ) : (
                    <svg className="w-9 h-9 text-white/40 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>
                <p className="text-amber-400/80 text-sm font-medium group-hover:text-amber-400 transition-colors">Tap to add photos</p>
                <p className="text-white/25 text-xs mt-1">JPG, PNG, WebP · Max 5 MB</p>
              </button>
            </div>
          )}

          {/* Image dots */}
          {allImages.length > 1 && (
            <div className="absolute top-3 inset-x-3 flex gap-1">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewIdx(i)}
                  className={`flex-1 h-1 rounded-full transition-all ${i === previewIdx % allImages.length ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}

          {/* Tap zones for carousel */}
          {allImages.length > 1 && (
            <>
              <button className="absolute left-0 top-0 bottom-0 w-1/3" onClick={() => setPreviewIdx(p => Math.max(0, p - 1))} />
              <button className="absolute right-0 top-0 bottom-0 w-1/3" onClick={() => setPreviewIdx(p => Math.min(allImages.length - 1, p + 1))} />
            </>
          )}

          {/* Upload button — always visible top-right */}
          {allImages.length > 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/75 active:scale-90 transition-all shadow-lg"
            >
              {uploading ? (
                <div className="animate-spin w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full" />
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          )}

          {/* Main photo badge / Set as Main button — top-left */}
          {allImages.length > 0 && (() => {
            const cur = allImages[previewIdx % allImages.length];
            if (!cur) return null;
            if (cur.isPrimary) {
              return (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/90 backdrop-blur-sm shadow-lg">
                  <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-[11px] font-bold text-black">Main photo</span>
                </div>
              );
            }
            if (cur.id !== 'avatar') {
              return (
                <button
                  onClick={() => handleSetPrimary(cur.id)}
                  disabled={settingPrimary === cur.id}
                  className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm border border-white/20 hover:bg-amber-500/80 hover:border-transparent active:scale-95 transition-all shadow-lg group disabled:opacity-60"
                >
                  <svg className="w-3 h-3 text-white/60 group-hover:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span className="text-[11px] font-medium text-white/70 group-hover:text-black">
                    {settingPrimary === cur.id ? 'Setting…' : 'Set as main'}
                  </span>
                </button>
              );
            }
            return null;
          })()}

          {/* Dark gradient */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

          {/* Info overlay */}
          <div className="absolute bottom-0 inset-x-0 p-5">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {section1.name || 'Your Name'}{section1.age ? `, ${section1.age}` : ''}
                </h2>
                {(section1.city || section1.occupation) && (
                  <p className="text-sm text-white/70 mt-0.5">
                    {[section1.occupation, section1.city].filter(Boolean).join(' · ')}
                  </p>
                )}
                {section1.tagline && (
                  <p className="text-sm text-white/50 mt-1 italic">&ldquo;{section1.tagline}&rdquo;</p>
                )}
              </div>
              {isApproved && (
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 ml-2">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Tags */}
            {section3.personalityTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {section3.personalityTags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/80 backdrop-blur-sm border border-white/5">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Photo strip — thumbnails + add button */}
        <div className="flex items-center gap-2 px-3 py-3 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {allImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setPreviewIdx(i)}
              className={`relative shrink-0 w-[52px] h-[52px] rounded-xl overflow-hidden transition-all active:scale-90 ${
                i === previewIdx % allImages.length
                  ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-[#0f0f1a] opacity-100'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
              {img.isPrimary && (
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-amber-500 rounded-tl-lg flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              )}
            </button>
          ))}
          {/* Add photo button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 w-[52px] h-[52px] rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center hover:border-amber-500/50 hover:bg-amber-500/5 active:scale-90 transition-all disabled:opacity-40"
          >
            {uploading ? (
              <div className="animate-spin w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full" />
            ) : (
              <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>

        {uploadError && (
          <p className="text-xs text-red-400 px-4 pb-3 -mt-1">{uploadError}</p>
        )}

        {/* Bio below card */}
        {section1.bio && (
          <div className="px-5 py-4 border-t border-white/5">
            <p className="text-sm text-white/70 leading-relaxed">{section1.bio}</p>
          </div>
        )}
      </div>

      {/* ── Tab switcher ────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
        {(['preview', 'edit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black font-semibold shadow-lg shadow-amber-500/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Edit Profile'}
          </button>
        ))}
      </div>

      {activeTab === 'preview' ? (
        /* ── PREVIEW TAB ──────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Details grid */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4">About</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Height', value: section2.height },
                { label: 'Body', value: section2.bodyType },
                { label: 'Hair', value: section2.hairColor },
                { label: 'Eyes', value: section2.eyeColor },
                { label: 'Ethnicity', value: section2.ethnicity },
                { label: 'Food', value: section2.foodPreference },
                { label: 'Drinking', value: section2.drinking },
                { label: 'Smoking', value: section2.smoking },
                { label: 'Education', value: section1.education },
                { label: 'Gender', value: section1.gender },
              ].filter(d => d.value).map(d => (
                <div key={d.label} className="bg-white/5 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-white/30">{d.label}</p>
                  <p className="text-sm text-white/80 mt-0.5">{d.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery preview */}
          {images.length > 0 && (
            <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
              <h3 className="text-sm font-semibold text-white/80 mb-3">Photos ({images.length})</h3>
              <div className="grid grid-cols-3 gap-2">
                {images.map(img => (
                  <div key={img.id} className={`aspect-square rounded-xl overflow-hidden ${img.isPrimary ? 'ring-2 ring-amber-500' : ''}`}>
                    <img src={img.imageUrl} alt="Gallery photo" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── EDIT TAB ─────────────────────────────────────────────────── */
        <div className="space-y-5">

          {/* Basic Info */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Basic Info</h3>
            <div className="space-y-3">
              <Input label="Display Name" value={section1.name} onChange={(e) => setSection1({ ...section1, name: e.target.value })} />
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Bio</label>
                <textarea value={section1.bio} onChange={(e) => setSection1({ ...section1, bio: e.target.value })} rows={3}
                  className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all" placeholder="Tell clients about yourself..." />
              </div>
              <Input label="Tagline" value={section1.tagline} onChange={(e) => setSection1({ ...section1, tagline: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Age</label>
                  <input type="number" min={18} max={99} value={section1.age} onChange={(e) => setSection1({ ...section1, age: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold/50" />
                </div>
                <SelectField label="Gender" value={section1.gender} onChange={(v) => setSection1({ ...section1, gender: v })} options={['Male', 'Female', 'Non-binary', 'Prefer not to say']} placeholder="Select" />
              </div>
              <Input label="City" value={section1.city} onChange={(e) => setSection1({ ...section1, city: e.target.value })} />
              <Input label="Education" value={section1.education} onChange={(e) => setSection1({ ...section1, education: e.target.value })} placeholder="e.g. B.Tech, Delhi University" />
              <Input label="Occupation" value={section1.occupation} onChange={(e) => setSection1({ ...section1, occupation: e.target.value })} placeholder="e.g. Freelancer" />
              <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold border-0 shadow-lg shadow-amber-500/20"
                isLoading={saving['s1']}
                onClick={() => saveSection('s1', {
                  name: section1.name, bio: section1.bio, tagline: section1.tagline,
                  age: section1.age ? parseInt(section1.age) : undefined,
                  gender: section1.gender || undefined, city: section1.city || undefined,
                  education: section1.education || undefined, occupation: section1.occupation || undefined,
                })}>
                Save Basic Info
              </Button>
            </div>
          </div>

          {/* Physical & Lifestyle */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Physical &amp; Lifestyle</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Height" value={section2.height} onChange={(e) => setSection2({ ...section2, height: e.target.value })} placeholder="5'8&quot;" />
                <Input label="Weight" value={section2.weight} onChange={(e) => setSection2({ ...section2, weight: e.target.value })} placeholder="65 kg" />
              </div>
              <SelectField label="Body Type" value={section2.bodyType} onChange={(v) => setSection2({ ...section2, bodyType: v })} options={BODY_TYPES} placeholder="Select" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Hair" value={section2.hairColor} onChange={(e) => setSection2({ ...section2, hairColor: e.target.value })} placeholder="Black" />
                <Input label="Eyes" value={section2.eyeColor} onChange={(e) => setSection2({ ...section2, eyeColor: e.target.value })} placeholder="Brown" />
              </div>
              <Input label="Ethnicity" value={section2.ethnicity} onChange={(e) => setSection2({ ...section2, ethnicity: e.target.value })} />
              <SelectField label="Food" value={section2.foodPreference} onChange={(v) => setSection2({ ...section2, foodPreference: v })} options={FOOD_OPTIONS} placeholder="Select" />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Drinking" value={section2.drinking} onChange={(v) => setSection2({ ...section2, drinking: v })} options={HABIT_OPTIONS} placeholder="Select" />
                <SelectField label="Smoking" value={section2.smoking} onChange={(v) => setSection2({ ...section2, smoking: v })} options={HABIT_OPTIONS} placeholder="Select" />
              </div>
              <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold border-0 shadow-lg shadow-amber-500/20"
                isLoading={saving['s2']}
                onClick={() => saveSection('s2', {
                  height: section2.height || undefined, weight: section2.weight || undefined,
                  bodyType: section2.bodyType || undefined, hairColor: section2.hairColor || undefined,
                  eyeColor: section2.eyeColor || undefined, ethnicity: section2.ethnicity || undefined,
                  foodPreference: section2.foodPreference || undefined, drinking: section2.drinking || undefined,
                  smoking: section2.smoking || undefined,
                })}>
                Save
              </Button>
            </div>
          </div>

          {/* Personality */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-1">Personality</h3>
            <p className="text-xs text-white/30 mb-4">Pick up to 5 tags</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PERSONALITY_PRESETS.map((tag) => {
                const selected = section3.personalityTags.includes(tag);
                return (
                  <button key={tag}
                    onClick={() => setSection3((prev) => {
                      if (selected) return { personalityTags: prev.personalityTags.filter((t) => t !== tag) };
                      if (prev.personalityTags.length >= 5) return prev;
                      return { personalityTags: [...prev.personalityTags, tag] };
                    })}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      selected ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black border-transparent font-semibold shadow-md shadow-amber-500/20' : 'bg-transparent text-white/50 border-white/10 hover:border-amber-500/40 hover:text-white'
                    }`}>
                    {tag}
                  </button>
                );
              })}
            </div>
            <Button className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold border-0 shadow-lg shadow-amber-500/20"
              isLoading={saving['s3']}
              onClick={() => saveSection('s3', { personalityTags: section3.personalityTags })}>
              Save
            </Button>
          </div>

          {/* Photos */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white/80">Photos</h3>
                <p className="text-xs text-white/30 mt-0.5">JPG, PNG, WebP · Max 5 MB</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-semibold shadow-md shadow-amber-500/20 disabled:opacity-50">
                {uploading ? '...' : '+ Upload'}
              </button>
            </div>
            {uploadError && <p className="text-xs text-red-400 mb-3">{uploadError}</p>}
            {images.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-8">No photos yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img.id} className={`relative group aspect-square rounded-xl overflow-hidden ${img.isPrimary ? 'ring-2 ring-amber-500' : ''}`}>
                    <img src={img.imageUrl} alt="Gallery photo" className="w-full h-full object-cover" />
                    {img.isPrimary && (
                      <span className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-black leading-none">Main</span>
                    )}
                    <button onClick={() => setPendingDeleteId(img.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    {!img.isPrimary && (
                      <button onClick={() => handleSetPrimary(img.id)} disabled={settingPrimary === img.id}
                        className="absolute bottom-0 inset-x-0 py-1.5 text-[10px] font-medium text-white bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-500 hover:text-black disabled:opacity-50">
                        {settingPrimary === img.id ? '...' : 'Set as Main'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Intro Video */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white/80">Intro Video</h3>
                <p className="text-xs text-white/30 mt-0.5">MP4, WebM, MOV · Max 30 MB</p>
              </div>
              <button onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-black text-xs font-semibold shadow-md shadow-amber-500/20 disabled:opacity-50">
                {uploadingVideo ? '...' : introVideoUrl ? 'Replace' : '+ Upload'}
              </button>
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoUpload} />
            </div>
            {videoError && <p className="text-xs text-red-400 mb-3">{videoError}</p>}
            {introVideoUrl ? (
              <div className="rounded-xl overflow-hidden bg-black">
                <video src={introVideoUrl} controls playsInline className="w-full max-h-64 object-contain" />
              </div>
            ) : (
              <div className="border border-dashed border-white/10 rounded-xl p-6 text-center">
                <svg className="w-8 h-8 text-white/20 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-white/30">Record a short intro to attract more clients</p>
              </div>
            )}
          </div>

          {/* Security */}
          <div ref={securityRef} className={`bg-[#0f0f1a] rounded-2xl border p-5 ${isTempPassword ? 'border-red-500/30' : 'border-white/5'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/80">Security</h3>
              {isTempPassword && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">Temp</span>
              )}
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <Input label="Current Password" type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} placeholder={isTempPassword ? 'Temporary password' : 'Current password'} required />
              <Input label="New Password" type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="Min 8 characters" required />
              <Input label="Confirm" type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} placeholder="Repeat new password" required />
              {pwError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">Password updated</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold border-0 shadow-lg shadow-amber-500/20" isLoading={pwLoading}>
                Update Password
              </Button>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          if (id) await handleDeleteImage(id);
        }}
        title="Remove this photo?"
        message="This photo will be permanently deleted from your gallery."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
