import React, {useState} from 'react';
import {Compass, Layers, Mountain} from 'lucide-react';
import type {DashboardTab} from './TopBar';

interface TerrainHeroBannerProps {
  activeDatasetName: string;
  isDemonstration: boolean;
  totalObservations: number;
  highRiskCount: number;
  onNavigate: (tab: DashboardTab) => void;
}

const HERO_IMG_SRC = '/src/assets/images/hero_ner_himalayas_1795166605200.jpg';

export const TerrainHeroBanner: React.FC<TerrainHeroBannerProps> = ({
  activeDatasetName,
  isDemonstration,
  totalObservations,
  highRiskCount,
  onNavigate,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 text-white">
      {!imgFailed ? (
        <img
          src={HERO_IMG_SRC}
          alt="Eastern Himalayan mountain slopes and hill roads across North East India"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-sky-950 to-emerald-950 flex items-center justify-end pr-12 opacity-90"
        >
          <Mountain className="w-40 h-40 text-sky-400/20" />
        </div>
      )}

      {/* Measured contrast scrim for WCAG AA+ readability */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/78 to-slate-900/45"
      />

      <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-9 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-sky-300">
            <span>SIH 26001</span>
            <span aria-hidden="true">·</span>
            <span>North Eastern Region Disaster Monitoring</span>
            <span aria-hidden="true">·</span>
            <span className={isDemonstration ? 'text-amber-300' : 'text-emerald-300'}>
              {isDemonstration ? 'Demonstration Benchmark' : 'User Field Dataset'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
            AI-Based Landslide Risk Prediction and Monitoring for NER
          </h1>

          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-xl">
            Geospatial susceptibility mapping across all eight North Eastern states powered by
            GeoPandas spatial joins, Rasterio DEM terrain slope extraction, and Scikit-learn
            multi-class risk evaluation.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('models')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md transition-colors whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Inspect ML Performance</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('predictor')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white/12 hover:bg-white/20 text-white border border-white/25 rounded-md transition-colors whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run Site Predictor</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3 lg:text-right shrink-0 bg-slate-950/55 border border-white/15 rounded-md px-4 py-3 backdrop-blur-xs">
          <div>
            <div className="text-[11px] text-slate-300">Active Source</div>
            <div className="text-xs font-mono font-medium text-white truncate max-w-[220px]">
              {activeDatasetName}
            </div>
          </div>
          <div className="flex lg:justify-end gap-5">
            <div>
              <div className="text-[11px] text-slate-300">Sites</div>
              <div className="text-base font-mono font-semibold text-sky-300">
                {totalObservations}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">High Risk</div>
              <div className="text-base font-mono font-semibold text-rose-300">
                {highRiskCount}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
