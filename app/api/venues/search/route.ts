import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  types: string[];
}

/**
 * GET /api/venues/search?location=Connaught+Place+Delhi
 *
 * Client enters a location (area/landmark/address). We search for
 * restaurants and cafes near that location via Google Places Text Search.
 * The API key stays server-side.
 *
 * Returns up to 8 restaurant/cafe results near the given location.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location')?.trim();

  if (!location || location.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Venue search is not configured. Add GOOGLE_PLACES_API_KEY to enable.',
    });
  }

  try {
    // Text Search automatically geocodes the location and finds nearby places
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', `restaurants and cafes near ${location}`);
    url.searchParams.set('type', 'restaurant');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('region', 'in');

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json({ success: true, data: [] });
    }

    const places: PlaceResult[] = (data.results ?? []).slice(0, 8).map((p: Record<string, unknown>) => ({
      id: p.place_id as string,
      name: p.name as string,
      address: p.formatted_address as string,
      lat: (p.geometry as Record<string, Record<string, number>>)?.location?.lat ?? 0,
      lng: (p.geometry as Record<string, Record<string, number>>)?.location?.lng ?? 0,
      rating: p.rating as number | undefined,
      types: (p.types as string[]) ?? [],
    }));

    return NextResponse.json({ success: true, data: places });
  } catch (error) {
    console.error('Venue search error:', error);
    return NextResponse.json({ success: true, data: [] });
  }
}
