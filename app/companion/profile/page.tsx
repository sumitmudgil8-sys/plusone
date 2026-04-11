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

  useEffect(() => {
    fetchUser();
    fetchImages();
  }, []);

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

      {/* ── TINDER-STYLE PREVIEW CARD ───────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0f0f1a] mb-6 shadow-2xl">
        {/* Image carousel */}
        <div className="relative aspect-[3/4]">
          {allImages.length > 0 ? (
            <img
              src={allImages[previewIdx % allImages.length]?.imageUrl}
              alt={section1.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-amber-400/10">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm">Add photos to preview your card</p>
              </div>
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
                    <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── EDIT TAB ─────────────────────────────────────────────────── */
        <div className="space-y-5">

          {/* Avatar */}
          <div className="bg-[#0f0f1a] rounded-2xl border border-white/5 p-5">
            <h3 className="text-sm font-semibold text-white/80 mb-4">Profile Photo</h3>
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 rounded-full overflow-hidden bg-white/5 cursor-pointer group shrink-0"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="animate-spin w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-white/60">Tap to change avatar</p>
                <p className="text-xs text-white/30 mt-0.5">JPG, PNG, WebP · Max 5 MB</p>
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>

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
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
            </div>
            {uploadError && <p className="text-xs text-red-400 mb-3">{uploadError}</p>}
            {images.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-8">No photos yet</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img.id} className={`relative group aspect-square rounded-xl overflow-hidden ${img.isPrimary ? 'ring-2 ring-amber-500' : ''}`}>
                    <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
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
