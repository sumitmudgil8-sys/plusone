'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CompanionCard } from '@/components/companion/CompanionCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/favorites');
      const data = await res.json();
      setFavorites(data.favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = (companionId: string) => {
    setFavorites((prev) => prev.filter((f) => f.companionId !== companionId));
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
        <h1 className="text-2xl font-bold text-white">Favorites</h1>
        <p className="text-white/60">Your saved companions</p>
      </div>

      {favorites.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-white/60 mb-4">No favorites yet</p>
          <Link href="/client/browse">
            <Button>Browse Companions</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(favorites as any[]).map((fav) => (
            <CompanionCard
              key={fav.companion.id}
              id={fav.companion.id}
              name={fav.companion.companionProfile.name}
              bio={fav.companion.companionProfile.bio}
              hourlyRate={fav.companion.companionProfile.hourlyRate}
              avatarUrl={fav.companion.companionProfile.avatarUrl}
              images={JSON.parse(fav.companion.companionProfile.images || '[]')}
              distance={0} // Would need to calculate
              isFavorited={true}
              accessible={true} // Assume favorites are accessible
              formattedPrice={`₹${fav.companion.companionProfile.hourlyRate}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
