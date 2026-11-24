import React, {useEffect, useRef, useState} from 'react';
import L from 'leaflet';
import {Maximize2} from 'lucide-react';
import {
  formatRiskLabel,
  type DistrictSummary,
  type NerGeoJsonCollection,
  type ObservationItem,
  type SusceptibilityClass,
} from '../types/landslide';

interface NerRiskMapProps {
  geojson: NerGeoJsonCollection | null;
  observations: ObservationItem[];
  districtSummaries: DistrictSummary[];
  selectedState: string;
  selectedDistrict: string;
  riskFilter: 'All' | SusceptibilityClass;
  onSelectState: (state: string) => void;
  onSelectDistrict: (state: string, district: string) => void;
}

type BasemapMode = 'terrain' | 'street' | 'vector';

const RISK_COLORS: Record<SusceptibilityClass, string> = {
  Low: '#15803d',
  Medium: '#b45309',
  High: '#b91c1c',
};

const NER_CENTER: [number, number] = [26.05, 92.65];
const NER_ZOOM = 6;

const BASEMAP_CONFIG: Record<Exclude<BasemapMode, 'vector'>, {url: string; attribution: string}> = {
  terrain: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, USGS, NOAA',
  },
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

export const NerRiskMap: React.FC<NerRiskMapProps> = ({
  geojson,
  observations,
  districtSummaries,
  selectedState,
  selectedDistrict,
  riskFilter,
  onSelectState,
  onSelectDistrict,
}) => {
  const [basemap, setBasemap] = useState<BasemapMode>('terrain');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NER_CENTER,
      zoom: NER_ZOOM,
      minZoom: 5,
      maxZoom: 13,
      zoomControl: true,
    });

    mapInstanceRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      geoLayerRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
      tileLayerRef.current = null;
    }

    if (basemap === 'vector') {
      return;
    }

    const cfg = BASEMAP_CONFIG[basemap];
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 18,
    }).addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
  }, [basemap]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geojson) return;

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
    }

    const layer = L.geoJSON(geojson as unknown as GeoJSON.GeoJsonObject, {
      style: (feature) => {
        const props = feature?.properties;
        const stName = props?.state as string;
        const dom = (props?.dominant_susceptibility as SusceptibilityClass) || 'Low';
        const isSelected = selectedState === 'All' || selectedState === stName;
        const color = RISK_COLORS[dom] || '#0369a1';

        return {
          color: isSelected ? '#0f172a' : '#64748b',
          weight: selectedState === stName ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: isSelected ? 0.28 : 0.08,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const p = feature.properties;
        const provenanceTag = p.is_demonstration ? 'Demonstration Data' : 'Historical / Field Dataset';
        const riskText = formatRiskLabel(p.dominant_susceptibility);
        featureLayer.bindPopup(
          `<div style="font-family: 'Plus Jakarta Sans', sans-serif; min-width: 210px;">
            <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">
              ${p.state} (${p.code})
            </div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
              Capital: ${p.capital} · ${provenanceTag}
            </div>
            <div style="font-family: 'IBM Plex Mono', monospace; font-size: 11px; line-height: 1.6; color: #1e293b;">
              <div>Baseline Risk: <strong>${riskText}</strong></div>
              <div>High-Risk Share: ${p.high_risk_share_pct}%</div>
              <div>Mean Rainfall: ${p.mean_rainfall_mm} mm</div>
              <div>Mean Elevation: ${p.mean_elevation_m} m</div>
              <div>Mean Slope: ${p.mean_slope_deg}°</div>
              <div>Observations: ${p.observation_count}</div>
            </div>
          </div>`,
        );

        featureLayer.on('click', () => {
          onSelectState(p.state);
        });
      },
    }).addTo(map);

    geoLayerRef.current = layer;

    if (selectedState !== 'All') {
      const targetFeature = layer.getLayers().find((l) => {
        const f = (l as L.GeoJSON & {feature?: {properties?: {state?: string}}}).feature;
        return f?.properties?.state === selectedState;
      });
      if (targetFeature && 'getBounds' in targetFeature) {
        map.fitBounds((targetFeature as L.Polygon).getBounds(), {padding: [28, 28], maxZoom: 9});
      }
    } else {
      map.setView(NER_CENTER, NER_ZOOM);
    }
  }, [geojson, selectedState, onSelectState]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    if (!markerLayer) return;
    markerLayer.clearLayers();

    const filteredObs = observations.filter(
      (obs) => riskFilter === 'All' || obs.susceptibility_class === riskFilter,
    );

    filteredObs.forEach((obs) => {
      const color = RISK_COLORS[obs.susceptibility_class] || '#0369a1';
      const marker = L.circleMarker([obs.latitude, obs.longitude], {
        radius: selectedDistrict !== 'All' ? 6.5 : 4.5,
        color: '#ffffff',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.9,
      });
      marker.bindTooltip(
        `<div style="font-family: 'IBM Plex Mono', monospace; font-size: 11px;">
          <strong>${obs.district}, ${obs.state}</strong><br/>
          Risk: ${formatRiskLabel(obs.susceptibility_class)} | Slope: ${obs.slope_deg}°<br/>
          Rain: ${obs.rainfall_mm} mm | Elev: ${obs.elevation_m} m
        </div>`,
        {direction: 'top'},
      );
      marker.on('click', () => {
        onSelectDistrict(obs.state, obs.district);
      });
      marker.addTo(markerLayer);
    });

    districtSummaries.forEach((d) => {
      if (riskFilter !== 'All' && d.dominant_susceptibility !== riskFilter) return;
      const isFocused = selectedDistrict === d.district;
      if (isFocused || selectedState !== 'All') {
        const ring = L.circleMarker([d.latitude, d.longitude], {
          radius: isFocused ? 11 : 7,
          color: '#0f172a',
          weight: isFocused ? 2 : 1,
          fillOpacity: 0,
          dashArray: '3 3',
        });
        ring.addTo(markerLayer);
      }
    });
  }, [observations, districtSummaries, riskFilter, selectedState, selectedDistrict, onSelectDistrict]);

  const handleResetView = () => {
    mapInstanceRef.current?.setView(NER_CENTER, NER_ZOOM);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            North Eastern Region Susceptibility Map
          </h2>
          <p className="text-xs text-slate-500">
            All 8 NER states · Click any state boundary or district marker to inspect live weather &amp; risk
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#15803d]" aria-hidden="true" />
              LOW
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#b45309]" aria-hidden="true" />
              MODERATE
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#b91c1c]" aria-hidden="true" />
              HIGH
            </span>
          </div>

          <div className="inline-flex p-0.5 bg-slate-100 rounded border border-slate-200 text-[11px]">
            {(
              [
                {id: 'terrain', label: 'Terrain'},
                {id: 'street', label: 'Street'},
                {id: 'vector', label: 'No Tiles'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBasemap(opt.id)}
                className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  basemap === opt.id
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors whitespace-nowrap"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[420px] lg:min-h-[500px]">
        <div ref={mapContainerRef} className="w-full h-full min-h-[420px] lg:min-h-[500px] z-10" />
      </div>
    </div>
  );
};
