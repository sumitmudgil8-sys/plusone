'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

export default function VerifyPage() {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selected.type)) {
      setError('Please upload a JPG, PNG, WebP, or PDF file');
      return;
    }

    // Validate size (5MB max)
    if (selected.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB');
      return;
    }

    setError('');
    setFile(selected);

    // Show preview for images
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      // Upload to Cloudinary via /api/upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'document');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error ?? 'Upload failed');
        return;
      }

      // Save govtIdUrl to client profile
      const saveRes = await fetch('/api/client/govt-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ govtIdUrl: uploadData.data.url }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setError(saveData.error ?? 'Failed to save ID');
        return;
      }

      setUploaded(true);
      toast.success('Government ID uploaded successfully');

      // Redirect to pending page after a short delay
      setTimeout(() => router.push('/client/pending'), 1500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold text-gold mb-2">Plus One</h1>
          <p className="text-white/60 mt-1 text-sm">
            Upload your government-issued ID for verification
          </p>
        </div>

        <Card className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs text-green-400">Account</span>
            </div>
            <div className="w-8 h-px bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                <span className="text-xs font-bold text-gold">2</span>
              </div>
              <span className="text-xs text-gold">ID Upload</span>
            </div>
            <div className="w-8 h-px bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-xs text-white/30">3</span>
              </div>
              <span className="text-xs text-white/30">Review</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="font-medium text-white">Upload a government-issued ID</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex gap-2">
                <span className="text-gold shrink-0">&#8226;</span>
                <span>Aadhaar Card, PAN Card, Passport, or Driving License</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gold shrink-0">&#8226;</span>
                <span>Clear photo or scan — all details must be readable</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gold shrink-0">&#8226;</span>
                <span>JPG, PNG, WebP, or PDF — max 5MB</span>
              </li>
            </ul>
          </div>

          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!file ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-white/15 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-gold/30 hover:bg-gold/[0.02] transition-colors"
            >
              <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-white/50">Click to select your ID document</span>
            </button>
          ) : (
            <div className="space-y-3">
              {preview && (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={preview} alt="ID preview" className="w-full max-h-48 object-contain bg-black/30" />
                </div>
              )}
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-5 h-5 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-white/70 truncate">{file.name}</span>
                </div>
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="text-white/40 hover:text-white/70 text-xs shrink-0"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {uploaded ? (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-400 text-sm font-medium">
                ID uploaded. Redirecting to review status...
              </p>
            </div>
          ) : (
            <Button
              onClick={handleUpload}
              isLoading={uploading}
              disabled={!file}
              className="w-full"
            >
              Upload &amp; Continue
            </Button>
          )}

          <p className="text-xs text-white/30 text-center">
            Your ID is stored securely and is only used for identity verification.
          </p>
        </Card>
      </div>
    </div>
  );
}
