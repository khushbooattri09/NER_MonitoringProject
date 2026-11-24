import React, {useState} from 'react';
import {Satellite} from 'lucide-react';

interface SatellitePipelineHeaderProps {
  title: string;
  subtitle: string;
  techLine: string;
}

const SATELLITE_IMG_SRC = '/src/assets/images/satellite_dem_analysis_1795166607078.jpg';

export const SatellitePipelineHeader: React.FC<SatellitePipelineHeaderProps> = ({
  title,
  subtitle,
  techLine,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 text-white">
      {!imgFailed ? (
        <img
          src={SATELLITE_IMG_SRC}
          alt="Earth observation satellite perspective of Himalayan ridges and river valleys"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-slate-900 via-teal-950 to-sky-950 flex items-center justify-end pr-10"
        >
          <Satellite className="w-28 h-28 text-teal-400/20" />
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/80 to-slate-900/55"
      />

      <div className="relative z-10 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-mono text-teal-300">{techLine}</p>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">{title}</h2>
          <p className="text-xs text-slate-200 leading-relaxed">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};
