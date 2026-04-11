'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { GENDERS, LANGUAGES, INTERESTS } from '@/lib/constants';

const STEPS = ['Profile', 'Interests', 'Photos', 'Documents'] as const;
type Step = (typeof STEPS)[number];

export default function CompanionOnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Profile
  const [profile, setProfile] = useState({
    bio: '',
    age: '',
    gender: '',
    city: '',
    hourlyRate: '2000',
  });

  // Step 2 — Interests & Languages
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Step 3 — Photos
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Step 4 — Documents
  const [docType, setDocType] = useState('ID_CARD');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploaded, setDocUploaded] = useState(false);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/companion/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: profile.bio || undefined,
          age: profile.age ? parseInt(profile.age) : undefined,
          gender: profile.gender || undefined,
          city: profile.city || undefined,
          hourlyRate: profile.hourlyRate ? parseFloat(profile.hourlyRate) : undefined,
          languages: selectedLanguages,
          interests: selectedInterests,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', avatarFile);
      form.append('type', 'avatar');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setAvatarPreview(data.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const uploadDocument = async () => {
    if (!docFile) return;
    setUploadingDoc(true);
    setError('');
    try {
      // Upload file to Cloudinary
      const form = new FormData();
      form.append('file', docFile);
      form.append('type', 'document');
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed');

      // Save document record
      const docRes = await fetch('/api/verification/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: docType, documentUrl: uploadData.data.url }),
      });
      const docData = await docRes.json();
      if (!docRes.ok) throw new Error(docData.error ?? 'Document save failed');

      setDocUploaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleNext = async () => {
    setError('');
    if (currentStep === 0 || currentStep === 1) {
      await saveProfile();
    }
    if (currentStep === 2 && avatarFile && !avatarPreview) {
      await uploadAvatar();
    }
    setCurrentStep((s) => s + 1);
  };

  const handleFinish = async () => {
    router.push('/companion/dashboard');
  };

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-charcoal py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-serif font-bold text-gold mb-2">Set Up Your Profile</h1>
          <p className="text-white/60">Complete your profile to get approved and start earning</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50 uppercase tracking-wider font-medium">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-xs text-gold font-semibold">
              {Math.round(((currentStep + 1) / STEPS.length) * 100)}% complete
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold via-amber-400 to-gold transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between mt-4">
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    i < currentStep
                      ? 'bg-gold text-charcoal shadow-lg shadow-gold/20'
                      : i === currentStep
                      ? 'bg-gold/20 text-gold border-2 border-gold ring-4 ring-gold/10'
                      : 'bg-white/[0.06] text-white/40 border border-white/10'
                  }`}
                >
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-medium text-center ${
                    i === currentStep ? 'text-gold' : i < currentStep ? 'text-white/60' : 'text-white/30'
                  }`}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6 space-y-6">

          {/* ── Step 1: Profile ── */}
          {currentStep === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-white">Basic Information</h2>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={4}
                  maxLength={1000}
                  className="w-full bg-charcoal border border-white/20 text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                  placeholder="Tell clients about yourself, your interests, and what kind of experiences you offer..."
                />
                <p className="text-xs text-white/40 mt-1">{profile.bio.length}/1000</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Age</label>
                  <input
                    type="number"
                    min={18}
                    max={99}
                    value={profile.age}
                    onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                    className="w-full bg-charcoal border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
                    placeholder="25"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">Gender</label>
                  <select
                    value={profile.gender}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    className="w-full bg-charcoal border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                label="City"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="e.g. Mumbai"
              />

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Hourly Rate (₹)
                </label>
                <input
                  type="number"
                  min={100}
                  value={profile.hourlyRate}
                  onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value })}
                  className="w-full bg-charcoal border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
                />
                <p className="text-xs text-white/40 mt-1">
                  Per-minute rate: ₹{(parseFloat(profile.hourlyRate || '0') / 60).toFixed(2)}/min
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Interests & Languages ── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Interests &amp; Languages</h2>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">
                  Languages you speak
                </label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleItem(selectedLanguages, lang, setSelectedLanguages)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selectedLanguages.includes(lang)
                          ? 'bg-gold text-charcoal border-gold font-medium'
                          : 'border-white/20 text-white/60 hover:border-gold/50'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">
                  Your interests
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleItem(selectedInterests, interest, setSelectedInterests)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selectedInterests.includes(interest)
                          ? 'bg-gold text-charcoal border-gold font-medium'
                          : 'border-white/20 text-white/60 hover:border-gold/50'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Photos ── */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-white">Profile Photo</h2>
              <p className="text-white/60 text-sm">
                Upload a clear, professional photo. This is the first thing clients see.
              </p>

              <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-white/30">?</span>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setAvatarFile(file);
                      if (file) setAvatarPreview(URL.createObjectURL(file));
                    }}
                    className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold/20 file:text-gold hover:file:bg-gold/30 cursor-pointer"
                  />
                  <p className="text-xs text-white/40">JPG, PNG or WebP — max 5MB</p>

                  {avatarFile && !avatarPreview?.startsWith('https') && (
                    <Button
                      onClick={uploadAvatar}
                      isLoading={uploadingAvatar}
                      className="text-sm py-2"
                    >
                      Upload Photo
                    </Button>
                  )}
                </div>
              </div>

              {avatarPreview?.startsWith('https') && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Photo uploaded successfully
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Documents ── */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-white">Identity Verification</h2>
              <p className="text-white/60 text-sm">
                Upload a government-issued ID. This is reviewed privately by our admin team
                and is never shown to clients.
              </p>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Document Type
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-charcoal border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  <option value="ID_CARD">National ID Card</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving Licence</option>
                </select>
              </div>

              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold/20 file:text-gold hover:file:bg-gold/30 cursor-pointer"
                />
                <p className="text-xs text-white/40">JPG, PNG or PDF — max 10MB</p>

                {docFile && !docUploaded && (
                  <Button
                    onClick={uploadDocument}
                    isLoading={uploadingDoc}
                    className="text-sm py-2"
                  >
                    Upload Document
                  </Button>
                )}

                {docUploaded && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Document submitted for review
                  </div>
                )}
              </div>

              {/* Pending review notice */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-400 text-sm font-medium">What happens next?</p>
                <p className="text-white/60 text-sm mt-1">
                  Our team will review your profile and ID within 24–48 hours.
                  You&apos;ll be notified once approved and your profile goes live.
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-white/10">
            <Button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="bg-white/10 hover:bg-white/20"
              disabled={currentStep === 0}
            >
              Back
            </Button>

            {isLastStep ? (
              <Button onClick={handleFinish}>
                Go to Dashboard
              </Button>
            ) : (
              <Button onClick={handleNext} isLoading={saving || uploadingAvatar}>
                {currentStep === 2 && avatarFile && !avatarPreview?.startsWith('https')
                  ? 'Upload & Continue'
                  : 'Continue'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
