import React, {useState} from 'react';
import {ArrowUpRight, Mountain} from 'lucide-react';

interface TerrainPhotoStripProps {
  selectedState: string;
  onSelectState: (state: string) => void;
}

interface TerrainCardItem {
  state: string;
  title: string;
  subtitle: string;
  metricsMeta: string;
  imageSrc: string;
  alt: string;
}

const TERRAIN_CARDS: TerrainCardItem[] = [
  {
    state: 'Sikkim',
    title: 'Eastern Himalayan Steep Corridors',
    subtitle: 'Sikkim · High-relief alpine ridges & hill highway cut-slopes',
    metricsMeta: 'Elevation 1,300–2,400 m · Steep Gradient Zone',
    imageSrc: '/src/assets/images/terrain_sikkim_slopes_1795166605935.jpg',
    alt: 'Steep Himalayan mountain slopes and retaining walls in Sikkim',
  },
  {
    state: 'Meghalaya',
    title: 'Khasi Plateau Monsoon Escarpment',
    subtitle: 'Meghalaya · Intense orographic rainfall & saturated basalt slopes',
    metricsMeta: 'Annual Rainfall >3,500 mm · High Pore-Pressure Zone',
    imageSrc: '/src/assets/images/terrain_meghalaya_monsoon_1795166606902.jpg',
    alt: 'Khasi Hills monsoon escarpment and waterfalls in Meghalaya',
  },
  {
    state: 'Assam',
    title: 'Brahmaputra Foothills & Barail Range',
    subtitle: 'Assam & Nagaland · Valley-to-ridge transitions & Dima Hasao hills',
    metricsMeta: 'Mixed Alluvial-Hill Terrain · Road Corridor Monitoring',
    imageSrc: '/src/assets/images/terrain_assam_monitoring_1795166605217.jpg',
    alt: 'Forested foothills and river valley transitions in Assam',
  },
];

export const TerrainPhotoStrip: React.FC<TerrainPhotoStripProps> = ({
  selectedState,
  onSelectState,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            NER Physiographic Zones & Terrain Context
          </h2>
          <p className="text-xs text-slate-500">
            Select a physiographic zone to filter regional telemetry, map boundaries, and environmental charts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TERRAIN_CARDS.map((card) => {
          const isSelected = selectedState === card.state;
          const imgError = failedImages[card.state];

          return (
            <button
              key={card.state}
              type="button"
              onClick={() => onSelectState(isSelected ? 'All' : card.state)}
              className={`group relative text-left rounded-lg overflow-hidden border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                isSelected
                  ? 'border-sky-600 ring-2 ring-sky-600/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative aspect-[4/3] w-full bg-slate-800 overflow-hidden">
                {!imgError ? (
                  <img
                    src={card.imageSrc}
                    alt={card.alt}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({...prev, [card.state]: true}))
                    }
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 via-sky-900 to-emerald-900 flex items-center justify-center">
                    <Mountain className="w-12 h-12 text-sky-300/40" />
                  </div>
                )}

                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent"
                />

                <div className="absolute inset-x-0 bottom-0 p-4 text-white space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-sky-300">
                      {isSelected ? `${card.state} · Active Filter` : `Filter: ${card.state}`}
                    </span>
                    <ArrowUpRight
                      className="w-4 h-4 text-white/80 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-200 line-clamp-1">{card.subtitle}</p>
                  <div className="text-[11px] font-mono text-emerald-300 pt-0.5">
                    {card.metricsMeta}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
