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
 * GET /api/venues/search?q=cafe+near+connaught+place&lat=28.63&lng=77.21
 *
 * Proxies to Google Places Text Search so the API key stays server-side.
 * Returns up to 5 restaurant/cafe results.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const lat = parseFloat(searchParams.get('lat') || '28.6139');
  const lng = parseFloat(searchParams.get('lng') || '77.2090');

  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    // Fallback: return empty results if Google Places is not configured
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Venue search is not configured. You can type the venue name manually.',
    });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', `${query} restaurant OR cafe`);
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', '10000'); // 10 km
    url.searchParams.set('type', 'restaurant|cafe');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('region', 'in');

    const res = await fetch(url.toString(), { next: { revalidate: 300 } }); // cache 5 min
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json({ success: true, data: [] });
    }

    const places: PlaceResult[] = (data.results ?? []).slice(0, 5).map((p: Record<string, unknown>) => ({
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
