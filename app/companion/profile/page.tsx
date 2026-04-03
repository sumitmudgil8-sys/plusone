'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CompanionImageRecord {
  id: string;
  imageUrl: string;
  publicId: string | null;
  createdAt: string;
}

interface ProfileFormData {
  name: string;
  bio: string;
  hourlyRate: number;
  avatarUrl: string;
  availability: string[];
}

export default function CompanionProfilePage() {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    bio: '',
    hourlyRate: 2000,
    avatarUrl: '',
    availability: [],
  });

  const [images, setImages] = useState<CompanionImageRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUser();
    fetchImages();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        const profile = data.user.companionProfile;
        if (profile) {
          setFormData({
            name: profile.name ?? '',
            bio: profile.bio ?? '',
            hourlyRate: profile.hourlyRate ?? 2000,
            avatarUrl: profile.avatarUrl ?? '',
            availability: JSON.parse(profile.availability ?? '[]'),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
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
    } catch {
      // non-fatal
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userRecord = user as { id?: string } | null;
      const res = await fetch(`/api/users/${userRecord?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          bio: formData.bio,
          hourlyRate: formData.hourlyRate,
          avatarUrl: formData.avatarUrl,
          availability: JSON.stringify(formData.availability),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const addAvailability = (date: string) => {
    if (date && !formData.availability.includes(date)) {
      setFormData({
        ...formData,
        availability: [...formData.availability, date].sort(),
      });
    }
  };

  const removeAvailability = (date: string) => {
    setFormData({
      ...formData,
      availability: formData.availability.filter((d) => d !== date),
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Only JPG, PNG, and WebP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB');
      return;
    }

    setUploadError('');
    setUploading(true);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/companion/images', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error ?? 'Upload failed');
        return;
      }
      setImages((prev) => [data.data.image, ...prev]);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const res = await fetch(`/api/companion/images/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== id));
      }
    } catch {
      // non-fatal
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const profileData = user as { companionProfile?: { isApproved?: boolean } } | null;
  const isApproved = profileData?.companionProfile?.isApproved;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-white/60">Manage your companion profile</p>
      </div>

      {/* Approval Status */}
      <Card
        className={`
          ${isApproved ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}
        `}
      >
        <div className="flex items-center gap-3">
          <div
            className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${isApproved ? 'bg-success/20' : 'bg-warning/20'}
            `}
          >
            <svg
              className={`w-5 h-5 ${isApproved ? 'text-success' : 'text-warning'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isApproved ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
          <div>
            <p className="font-medium text-white">
              {isApproved ? 'Profile Approved' : 'Awaiting Approval'}
            </p>
            <p className="text-sm text-white/60">
              {isApproved
                ? 'Your profile is visible to clients'
                : 'An admin will review your profile soon'}
            </p>
          </div>
        </div>
      </Card>

      {/* Profile Form */}
      <Card>
        <h2 className="font-medium text-white mb-4">Profile Information</h2>
        <div className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
              placeholder="Tell clients about yourself..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1.5">
              Hourly Rate (₹)
            </label>
            <input
              type="number"
              value={formData.hourlyRate}
              onChange={(e) =>
                setFormData({ ...formData, hourlyRate: parseInt(e.target.value) || 0 })
              }
              className="w-full bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <Input
            label="Avatar URL"
            value={formData.avatarUrl}
            onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
            placeholder="https://example.com/avatar.jpg"
          />

          {formData.avatarUrl && (
            <div className="mt-2">
              <p className="text-sm text-white/60 mb-2">Preview:</p>
              <img
                src={formData.avatarUrl}
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          <Button className="w-full" isLoading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </Card>

      {/* Image Gallery */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium text-white">Gallery</h2>
            <p className="text-xs text-white/40 mt-0.5">JPG, PNG, WebP · Max 5 MB each</p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            isLoading={uploading}
            className="text-sm py-1.5 px-3"
          >
            + Upload Image
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {uploadError && (
          <p className="text-sm text-red-400 mb-3">{uploadError}</p>
        )}

        {images.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">
            No images yet. Upload your first photo.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden bg-charcoal-surface">
                <img
                  src={img.imageUrl}
                  alt="Gallery"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  title="Delete image"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Availability */}
      <Card>
        <h2 className="font-medium text-white mb-4">Availability</h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="date"
              onChange={(e) => addAvailability(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 bg-charcoal border border-charcoal-border text-white rounded-lg px-4 py-2"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(formData.availability || []).map((date: string) => (
              <span
                key={date}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gold/20 text-gold rounded-full text-sm"
              >
                {new Date(date).toLocaleDateString()}
                <button
                  onClick={() => removeAvailability(date)}
                  className="hover:text-white"
                >
                  <span className="sr-only">Remove</span>
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
