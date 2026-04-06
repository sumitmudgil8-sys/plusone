'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border ${
        ok
          ? 'bg-green-500/15 border-green-500/30 text-green-400'
          : 'bg-red-500/15 border-red-500/30 text-red-400'
      }`}
    >
      {msg}
    </div>
  );
}

// ─── SelectField ─────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CompanionProfilePage() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);

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
  const [section4, setSection4] = useState({ chatRatePerMinute: 0, callRatePerMinute: 0, hourlyRate: 0 });

  // Gallery state
  const [images, setImages] = useState<CompanionImageRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-section saving
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Security
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showTempModal, setShowTempModal] = useState(false);
  const securityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUser();
    fetchImages();
  }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const { user: u } = await res.json() as { user: UserRecord };
        setUser(u);
        const p = u.companionProfile ?? {};
        setAvatarUrl(p.avatarUrl ?? '');
        setSection1({
          name: p.name ?? '',
          bio: p.bio ?? '',
          tagline: p.tagline ?? '',
          age: p.age != null ? String(p.age) : '',
          gender: p.gender ?? '',
          city: p.city ?? '',
          languages: p.languages ?? [],
          education: p.education ?? '',
          occupation: p.occupation ?? '',
        });
        setSection2({
          height: p.height ?? '',
          weight: p.weight ?? '',
          bodyType: p.bodyType ?? '',
          hairColor: p.hairColor ?? '',
          eyeColor: p.eyeColor ?? '',
          ethnicity: p.ethnicity ?? '',
          foodPreference: p.foodPreference ?? '',
          drinking: p.drinking ?? '',
          smoking: p.smoking ?? '',
        });
        setSection3({ personalityTags: p.personalityTags ?? [] });
        setSection4({
          chatRatePerMinute: Math.round((p.chatRatePerMinute ?? 2000) / 100),
          callRatePerMinute: Math.round((p.callRatePerMinute ?? 3200) / 100),
          hourlyRate: Math.round((p.hourlyRate ?? 200000) / 100),
        });
        if (u.isTemporaryPassword) setShowTempModal(true);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/companion/images');
      if (res.ok) {
        const data = await res.json();
        setImages(data.data.images);
      }
    } catch { /* non-fatal */ }
  };

  // ── Avatar upload ──────────────────────────────────────────────────────────

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
    } catch {
      showToast('Upload failed', false);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // ── Section save helper ────────────────────────────────────────────────────

  const saveSection = async (key: string, payload: Record<string, unknown>) => {
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch('/api/companion/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { showToast(data.error ?? 'Save failed', false); return; }
      showToast('Saved', true);
    } catch {
      showToast('Save failed', false);
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  // ── Gallery handlers ───────────────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) { setUploadError('Only JPG, PNG, and WebP images are allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError('Image must be under 5 MB'); return; }

    setUploadError('');
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/companion/images', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) { setUploadError(data.error ?? 'Upload failed'); return; }
      setImages((prev) => [data.data.image, ...prev]);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const res = await fetch(`/api/companion/images/${id}`, { method: 'DELETE' });
      if (res.ok) setImages((prev) => prev.filter((img) => img.id !== id));
    } catch { /* non-fatal */ }
  };

  const handleSetPrimary = async (id: string) => {
    setSettingPrimary(id);
    try {
      const res = await fetch('/api/companion/images/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: id }),
      });
      if (res.ok) setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === id })));
    } catch { /* non-fatal */ } finally {
      setSettingPrimary(null);
    }
  };

  // ── Password change ────────────────────────────────────────────────────────

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('New passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }

    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pwForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPwError(data.error ?? 'Failed to update password'); return; }
      setPwSuccess(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setUser((prev) => prev ? { ...prev, isTemporaryPassword: false } : prev);
    } catch {
      setPwError('Something went wrong. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const isApproved = user?.companionProfile?.isApproved;
  const isTempPassword = user?.isTemporaryPassword === true;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Temp password modal */}
      {showTempModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm bg-[#1C1C1C] border border-red-500/40 rounded-2xl p-7 shadow-2xl">
            <p className="font-semibold text-white text-sm mb-2">Temporary Password Active</p>
            <p className="text-sm text-white/70 mb-5">Please update your password immediately to secure your account.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowTempModal(false)} className="flex-1 py-2 rounded-lg border border-[#3A3A3A] text-sm text-white/50 hover:text-white">Later</button>
              <button
                onClick={() => { setShowTempModal(false); setTimeout(() => securityRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); }}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-semibold"
              >Change Now</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-white/60">Manage your companion profile</p>
      </div>

      {isTempPassword && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">Temporary password in use</p>
            <p className="text-xs text-white/50 mt-0.5">Please update it immediately.</p>
          </div>
          <button onClick={() => securityRef.current?.scrollIntoView({ behavior: 'smooth' })} className="text-xs text-red-400 hover:text-red-300 font-medium whitespace-nowrap">
            Update now →
          </button>
        </div>
      )}

      {/* Approval status */}
      <Card className={isApproved ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isApproved ? 'bg-success/20' : 'bg-warning/20'}`}>
            <svg className={`w-5 h-5 ${isApproved ? 'text-success' : 'text-warning'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isApproved
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
            </svg>
          </div>
          <div>
            <p className="font-medium text-white">{isApproved ? 'Profile Approved' : 'Awaiting Approval'}</p>
            <p className="text-sm text-white/60">{isApproved ? 'Your profile is visible to clients' : 'An admin will review your profile soon'}</p>
          </div>
        </div>
      </Card>

      {/* ── Avatar ──────────────────────────────────────────────────────────── */}
      <Card>
        <h2 className="font-medium text-white mb-4">Profile Photo</h2>
        <div className="flex items-center gap-5">
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden bg-charcoal-surface cursor-pointer group shrink-0"
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gold/10">
                <svg className="w-8 h-8 text-gold/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs text-white mt-1">Change</span>
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="animate-spin w-6 h-6 border-2 border-gold border-t-transparent rounded-full" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-white/70">Click the photo to upload a new one</p>
            <p className="text-xs text-white/40 mt-1">JPG, PNG, WebP · Max 5 MB</p>
          </div>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
      </Card>

      {/* ── Section 1 — Basic Info ───────────────────────────────────────────── */}
      <Card>
        <h2 className="font-medium text-white mb-4">Basic Info</h2>
        <div className="space-y-4">
          <Input label="Display Name" value={section1.name} onChange={(e) => setSection1({ ...section1, name: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Bio</label>
            <textarea
              value={section1.bio}
              onChange={(e) => setSection1({ ...section1, bio: e.target.value })}
              rows={4}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
              placeholder="Tell clients about yourself..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Tagline <span className="text-white/30 font-normal">(max 100 chars)</span></label>
            <input
              type="text"
              value={section1.tagline}
              maxLength={100}
              onChange={(e) => setSection1({ ...section1, tagline: e.target.value })}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
              placeholder="A short catchy line about you"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5">Age</label>
              <input
                type="number" min={18} max={99}
                value={section1.age}
                onChange={(e) => setSection1({ ...section1, age: e.target.value })}
                className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <SelectField
              label="Gender"
              value={section1.gender}
              onChange={(v) => setSection1({ ...section1, gender: v })}
              options={['Male', 'Female', 'Non-binary', 'Prefer not to say']}
              placeholder="Select gender"
            />
          </div>
          <Input label="City" value={section1.city} onChange={(e) => setSection1({ ...section1, city: e.target.value })} />
          <Input label="Education" value={section1.education} onChange={(e) => setSection1({ ...section1, education: e.target.value })} placeholder="e.g. B.Tech, Delhi University" />
          <Input label="Occupation" value={section1.occupation} onChange={(e) => setSection1({ ...section1, occupation: e.target.value })} placeholder="e.g. Freelancer, Student" />
          <Button
            className="w-full"
            isLoading={saving['s1']}
            onClick={() => saveSection('s1', {
              name: section1.name,
              bio: section1.bio,
              tagline: section1.tagline,
              age: section1.age ? parseInt(section1.age) : undefined,
              gender: section1.gender || undefined,
              city: section1.city || undefined,
              education: section1.education || undefined,
              occupation: section1.occupation || undefined,
            })}
          >
            Save Basic Info
          </Button>
        </div>
      </Card>

      {/* ── Section 2 — Physical & Lifestyle ────────────────────────────────── */}
      <Card>
        <h2 className="font-medium text-white mb-4">Physical &amp; Lifestyle</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Height" value={section2.height} onChange={(e) => setSection2({ ...section2, height: e.target.value })} placeholder='e.g. 5&apos;8"' />
            <Input label="Weight (optional)" value={section2.weight} onChange={(e) => setSection2({ ...section2, weight: e.target.value })} placeholder="e.g. 65 kg" />
          </div>
          <SelectField label="Body Type" value={section2.bodyType} onChange={(v) => setSection2({ ...section2, bodyType: v })} options={BODY_TYPES} placeholder="Select body type" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Hair Color" value={section2.hairColor} onChange={(e) => setSection2({ ...section2, hairColor: e.target.value })} placeholder="e.g. Black" />
            <Input label="Eye Color" value={section2.eyeColor} onChange={(e) => setSection2({ ...section2, eyeColor: e.target.value })} placeholder="e.g. Brown" />
          </div>
          <Input label="Ethnicity" value={section2.ethnicity} onChange={(e) => setSection2({ ...section2, ethnicity: e.target.value })} placeholder="e.g. South Asian" />
          <SelectField label="Food Preference" value={section2.foodPreference} onChange={(v) => setSection2({ ...section2, foodPreference: v })} options={FOOD_OPTIONS} placeholder="Select preference" />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Drinking" value={section2.drinking} onChange={(v) => setSection2({ ...section2, drinking: v })} options={HABIT_OPTIONS} placeholder="Select" />
            <SelectField label="Smoking" value={section2.smoking} onChange={(v) => setSection2({ ...section2, smoking: v })} options={HABIT_OPTIONS} placeholder="Select" />
          </div>
          <Button
            className="w-full"
            isLoading={saving['s2']}
            onClick={() => saveSection('s2', {
              height: section2.height || undefined,
              weight: section2.weight || undefined,
              bodyType: section2.bodyType || undefined,
              hairColor: section2.hairColor || undefined,
              eyeColor: section2.eyeColor || undefined,
              ethnicity: section2.ethnicity || undefined,
              foodPreference: section2.foodPreference || undefined,
              drinking: section2.drinking || undefined,
              smoking: section2.smoking || undefined,
            })}
          >
            Save Physical &amp; Lifestyle
          </Button>
        </div>
      </Card>

      {/* ── Section 3 — Personality ──────────────────────────────────────────── */}
      <Card>
        <h2 className="font-medium text-white mb-1">Personality</h2>
        <p className="text-xs text-white/40 mb-4">Pick up to 5 tags that describe you</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {PERSONALITY_PRESETS.map((tag) => {
            const selected = section3.personalityTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => {
                  setSection3((prev) => {
                    if (selected) return { personalityTags: prev.personalityTags.filter((t) => t !== tag) };
                    if (prev.personalityTags.length >= 5) return prev;
                    return { personalityTags: [...prev.personalityTags, tag] };
                  });
                }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selected
                    ? 'bg-gold text-black border-gold font-medium'
                    : 'bg-transparent text-white/60 border-charcoal-border hover:border-gold/50 hover:text-white'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <Button
          className="w-full"
          isLoading={saving['s3']}
          onClick={() => saveSection('s3', { personalityTags: section3.personalityTags })}
        >
          Save Personality
        </Button>
      </Card>

      {/* ── Section 4 — Rates ────────────────────────────────────────────────── */}
      <Card>
        <h2 className="font-medium text-white mb-4">Rates</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Chat Rate (₹/min)</label>
            <input
              type="number" min={0}
              value={section4.chatRatePerMinute}
              onChange={(e) => setSection4({ ...section4, chatRatePerMinute: parseInt(e.target.value) || 0 })}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Call Rate (₹/min)</label>
            <input
              type="number" min={0}
              value={section4.callRatePerMinute}
              onChange={(e) => setSection4({ ...section4, callRatePerMinute: parseInt(e.target.value) || 0 })}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">Booking Rate (₹/hr)</label>
            <input
              type="number" min={0}
              value={section4.hourlyRate}
              onChange={(e) => setSection4({ ...section4, hourlyRate: parseInt(e.target.value) || 0 })}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <Button
            className="w-full"
            isLoading={saving['s4']}
            onClick={() => saveSection('s4', {
              chatRatePerMinute: section4.chatRatePerMinute * 100,
              callRatePerMinute: section4.callRatePerMinute * 100,
              hourlyRate: section4.hourlyRate * 100,
            })}
          >
            Save Rates
          </Button>
        </div>
      </Card>

      {/* ── Section 5 — Gallery ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium text-white">Photos</h2>
            <p className="text-xs text-white/40 mt-0.5">JPG, PNG, WebP · Max 5 MB each</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} isLoading={uploading} className="text-sm py-1.5 px-3">
            + Upload
          </Button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
        </div>

        {uploadError && <p className="text-sm text-red-400 mb-3">{uploadError}</p>}

        {images.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">No photos yet. Upload your first photo.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className={`relative group aspect-square rounded-lg overflow-hidden bg-charcoal-surface ${img.isPrimary ? 'ring-2 ring-gold' : ''}`}>
                <img src={img.imageUrl} alt="Gallery" className="w-full h-full object-cover" />
                {img.isPrimary && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gold text-black leading-none">Main</span>
                )}
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {!img.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(img.id)}
                    disabled={settingPrimary === img.id}
                    className="absolute bottom-0 inset-x-0 py-1.5 text-[11px] font-medium text-white bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gold hover:text-black disabled:opacity-50"
                  >
                    {settingPrimary === img.id ? '…' : 'Set as Main'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      <div ref={securityRef}>
        <Card className={isTempPassword ? 'border-red-500/40' : ''}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-medium text-white">Security</h2>
              <p className="text-xs text-white/40 mt-0.5">Update your account password</p>
            </div>
            {isTempPassword && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">Temp Password</span>
            )}
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input label="Current Password" type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} placeholder={isTempPassword ? 'Enter your temporary password' : 'Enter current password'} required />
            <Input label="New Password" type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="At least 8 characters" required />
            <Input label="Confirm New Password" type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} placeholder="Repeat new password" required />
            {pwError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">Password updated successfully.</p>}
            <Button type="submit" className="w-full" isLoading={pwLoading}>Update Password</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
