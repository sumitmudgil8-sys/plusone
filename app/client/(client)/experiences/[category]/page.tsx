'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { EXPERIENCE_CATEGORIES } from '@/lib/experiences';

export default function ExperienceCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.category as string;

  const category = EXPERIENCE_CATEGORIES.find((c) => c.id === categoryId);

  if (!category) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40">Experience not found.</p>
        <Link href="/client/experiences" className="text-gold text-sm mt-3 inline-block">
          Back to Experiences
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div
        className="rounded-2xl p-5 border"
        style={{ background: category.color, borderColor: category.borderColor }}
      >
        <span className="text-4xl leading-none block mb-3">{category.emoji}</span>
        <h1 className="text-2xl font-bold text-white">{category.label}</h1>
        <p className="text-white/50 text-sm mt-1">{category.tagline}</p>
        <p className="text-[11px] font-medium mt-3" style={{ color: category.textColor }}>
          {category.places.length} curated places in Delhi NCR
        </p>
      </div>

      {/* Places list */}
      <section className="space-y-3">
        <h2 className="text-white font-semibold text-[14px]">Where to go</h2>

        {category.places.map((place, idx) => (
          <div
            key={place.id}
            className="rounded-2xl border p-4 space-y-2.5"
            style={{ background: category.color, borderColor: category.borderColor }}
          >
            {/* Name row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                  style={{ background: category.borderColor, color: category.textColor }}
                >
                  {idx + 1}
                </span>
                <div>
                  <p className="text-white font-semibold text-[14px] leading-tight">{place.name}</p>
                  <p className="text-white/45 text-[11px] mt-0.5 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {place.area}
                  </p>
                </div>
              </div>
              <span
                className="text-[12px] font-bold shrink-0 mt-0.5"
                style={{ color: category.textColor }}
              >
                {place.priceRange}
              </span>
            </div>

            {/* Description */}
            <p className="text-white/60 text-[12px] leading-relaxed">{place.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: category.borderColor, color: category.textColor }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Maps link */}
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + place.area)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Maps
            </a>
          </div>
        ))}
      </section>

      {/* Sticky Find a Plus One CTA */}
      <div className="fixed bottom-[72px] inset-x-0 px-4 z-30">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/client/browse?experience=${category.id}`}
            className="flex items-center justify-center gap-2 w-full bg-gold text-charcoal font-bold text-[14px] py-4 rounded-2xl shadow-gold-md hover:bg-gold-hover active:scale-[0.98] transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Find a Plus One for {category.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
