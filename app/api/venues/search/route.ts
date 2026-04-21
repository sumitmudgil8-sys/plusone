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
}

/**
 * GET /api/venues/search?location=Connaught+Place+Delhi
 *
 * Uses Google Places API (New) — Text Search endpoint.
 * Requires "Places API (New)" enabled in Google Cloud Console.
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
    return NextResponse.json({ success: false, error: 'not_configured', data: [] });
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating',
      },
      body: JSON.stringify({
        textQuery: `restaurants and cafes near ${location}`,
        pageSize: 8,
        languageCode: 'en',
        regionCode: 'IN',
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Google Places API (New) error:', res.status, err);
      return NextResponse.json({ success: false, error: `HTTP_${res.status}`, data: [] });
    }

    const data = await res.json();

    const places: PlaceResult[] = (data.places ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: (p.displayName as { text: string })?.text ?? '',
      address: p.formattedAddress as string ?? '',
      lat: (p.location as { latitude: number })?.latitude ?? 0,
      lng: (p.location as { longitude: number })?.longitude ?? 0,
      rating: p.rating as number | undefined,
    }));

    return NextResponse.json({ success: true, data: places });
  } catch (error) {
    console.error('Venue search error:', error);
    return NextResponse.json({ success: false, error: 'network_error', data: [] });
  }
}
