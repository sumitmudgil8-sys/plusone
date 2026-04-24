'use client';

import Link from 'next/link';
import { EXPERIENCE_CATEGORIES } from '@/lib/experiences';

export default function ExperiencesPage() {
  return (
    <div className="space-y-8 pb-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Experiences</h1>
        <p className="text-white/50 text-sm mt-1">Curated places in Delhi NCR — with a verified Plus One</p>
      </div>

      {/* Category cards — full list */}
      <div className="grid grid-cols-2 gap-3">
        {EXPERIENCE_CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/client/experiences/${cat.id}`}
            className="group relative rounded-2xl p-4 border transition-all active:scale-[0.97] hover:brightness-110"
            style={{ background: cat.color, borderColor: cat.borderColor }}
          >
            <span className="text-3xl leading-none block mb-2.5">{cat.emoji}</span>
            <p className="text-white font-semibold text-[13px] leading-tight">{cat.label}</p>
            <p className="text-white/40 text-[11px] mt-1 leading-tight line-clamp-2">{cat.tagline}</p>
            <p
              className="text-[10px] font-semibold mt-2.5"
              style={{ color: cat.textColor }}
            >
              {cat.places.length} places &rarr;
            </p>
          </Link>
        ))}
      </div>

      {/* Featured picks from each category */}
      <section className="space-y-8">
        <h2 className="text-white font-semibold text-[15px]">Featured picks</h2>

        {EXPERIENCE_CATEGORIES.map((cat) => (
          <div key={cat.id} className="space-y-3">
            {/* Category sub-header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.emoji}</span>
                <h3 className="text-white font-semibold text-[14px]">{cat.label}</h3>
              </div>
              <Link
                href={`/client/experiences/${cat.id}`}
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: cat.textColor }}
              >
                See all &rarr;
              </Link>
            </div>

            {/* Top 2 places horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {cat.places.slice(0, 3).map((place) => (
                <div
                  key={place.id}
                  className="shrink-0 w-60 rounded-xl border p-3.5 space-y-1.5"
                  style={{ background: cat.color, borderColor: cat.borderColor }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white font-semibold text-[13px] leading-tight">{place.name}</p>
                    <span
                      className="text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ color: cat.textColor }}
                    >
                      {place.priceRange}
                    </span>
                  </div>
                  <p className="text-white/40 text-[11px]">{place.area}</p>
                  <p className="text-white/55 text-[11px] leading-relaxed line-clamp-2">{place.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <div className="relative rounded-2xl overflow-hidden border border-gold/10">
        <div className="absolute inset-0 bg-gold-subtle" />
        <div className="relative flex items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-bold text-white">Ready to go?</p>
            <p className="text-[11px] text-white/30 mt-0.5">Browse all verified Plus One partners</p>
          </div>
          <Link
            href="/client/browse"
            className="shrink-0 bg-gold text-charcoal text-[11px] font-bold px-4 py-2.5 rounded-full hover:bg-gold-hover active:scale-[0.96] transition-all shadow-gold-sm"
          >
            Find Partners
          </Link>
        </div>
      </div>
    </div>
  );
}
