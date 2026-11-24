import React, {useCallback, useEffect, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  Droplets,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Thermometer,
} from 'lucide-react';
import {landslideApi} from '../services/api';
import {
  formatRiskLabel,
  type LivePredictResponse,
  type LiveWeatherReading,
  type StateMetadata,
} from '../types/landslide';

interface LiveMonitorPanelProps {
  states: StateMetadata[];
  selectedState: string;
  selectedDistrict: string;
  onLocationChange: (state: string, district: string) => void;
  onPredictionCreated: () => void;
}

const RISK_STYLES = {
  LOW: {
    container: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    bar: 'bg-emerald-600',
    Icon: CheckCircle2,
  },
  MODERATE: {
    container: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    bar: 'bg-amber-600',
    Icon: AlertTriangle,
  },
  HIGH: {
    container: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    bar: 'bg-red-700',
    Icon: ShieldAlert,
  },
};

export const LiveMonitorPanel: React.FC<LiveMonitorPanelProps> = ({
  states,
  selectedState,
  selectedDistrict,
  onLocationChange,
  onPredictionCreated,
}) => {
  const effectiveState =
    selectedState !== 'All' ? selectedState : states[0]?.state ?? 'Meghalaya';
  const stateObj = states.find((s) => s.state === effectiveState) ?? states[0];
  const districts = stateObj?.districts ?? ['East Khasi Hills'];
  const effectiveDistrict =
    selectedDistrict !== 'All' && districts.includes(selectedDistrict)
      ? selectedDistrict
      : districts[0] ?? 'East Khasi Hills';

  const [weather, setWeather] = useState<LiveWeatherReading | null>(null);
  const [livePred, setLivePred] = useState<LivePredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const runLiveSync = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await landslideApi.predictWithLiveWeather(
          effectiveState,
          effectiveDistrict,
          'random_forest',
          forceRefresh,
        );
        setWeather(res.weather);
        setLivePred(res);
        setSecondsLeft(60);
        onPredictionCreated();
      } catch (err) {
        try {
          const w = await landslideApi.getLiveWeather(
            effectiveState,
            effectiveDistrict,
            forceRefresh,
          );
          setWeather(w);
        } catch {
          // ignore secondary error
        }
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to fetch live weather or run prediction.',
        );
      } finally {
        setLoading(false);
      }
    },
    [effectiveState, effectiveDistrict, onPredictionCreated],
  );

  useEffect(() => {
    void runLiveSync(false);
  }, [runLiveSync]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void runLiveSync(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, runLiveSync]);

  const pred = livePred?.prediction;
  const riskLabel = pred ? formatRiskLabel(pred.predicted_class) : 'LOW';
  const riskStyle = RISK_STYLES[riskLabel];
  const RiskIcon = riskStyle.Icon;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Real-Time Weather &amp; AI Landslide Risk Prediction
          </h2>
          <p className="text-xs text-slate-500">
            Live Open-Meteo environmental feed passed directly into the Joblib-saved Random Forest classifier
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="live-state" className="sr-only">
              Monitoring State
            </label>
            <select
              id="live-state"
              value={effectiveState}
              onChange={(e) => {
                const nextSt = e.target.value;
                const firstDist = states.find((s) => s.state === nextSt)?.districts[0] ?? 'All';
                onLocationChange(nextSt, firstDist);
              }}
              className="h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
            >
              {states.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state}
                </option>
              ))}
            </select>

            <label htmlFor="live-district" className="sr-only">
              Monitoring District
            </label>
            <select
              id="live-district"
              value={effectiveDistrict}
              onChange={(e) => onLocationChange(effectiveState, e.target.value)}
              className="h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`h-9 px-3 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              autoRefresh
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-white border-slate-300 text-slate-600'
            }`}
          >
            {autoRefresh ? `Auto-Refresh: ${secondsLeft}s` : 'Auto-Refresh: Off'}
          </button>

          <button
            type="button"
            onClick={() => void runLiveSync(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{loading ? 'Updating...' : 'Refresh & Predict'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Live Weather Monitoring */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Live Environmental Conditions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {effectiveDistrict}, {effectiveState}
                  {weather && (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums">
                        {weather.latitude.toFixed(2)}°N, {weather.longitude.toFixed(2)}°E
                      </span>
                    </>
                  )}
                </p>
              </div>
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  weather?.is_demo_fallback ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {weather ? (weather.is_demo_fallback ? 'Demo Fallback' : 'Live Weather API') : 'Syncing...'}
              </span>
            </div>

            {weather ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-md">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>7-Day Rainfall</span>
                    <CloudRain className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                    {weather.rainfall_7d_mm.toFixed(1)} mm
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                    Current: {weather.current_rainfall_mm.toFixed(1)} mm · 24h: {weather.rainfall_24h_mm.toFixed(1)} mm
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-md">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Temperature</span>
                    <Thermometer className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                    {weather.temperature_c.toFixed(1)} °C
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {weather.weather_summary}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-md">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Humidity</span>
                    <Droplets className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                    {weather.humidity_pct.toFixed(0)}%
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Relative 2m humidity</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-md">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Soil Moisture</span>
                    <Gauge className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                  </div>
                  <div className="text-xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                    {weather.soil_moisture_available && weather.soil_moisture_pct !== null
                      ? `${weather.soil_moisture_pct.toFixed(1)}%`
                      : 'Unavailable'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {weather.soil_moisture_available
                      ? '0–7 cm satellite feed'
                      : 'Not reported; ML uses median'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                Fetching live weather reading...
              </div>
            )}
          </div>

          {weather && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                Terrain: <span className="font-mono tabular-nums text-slate-700">{weather.elevation_m.toFixed(0)} m</span> elev ·{' '}
                <span className="font-mono tabular-nums text-slate-700">{weather.slope_deg.toFixed(1)}°</span> slope
              </span>
              <span className="font-mono tabular-nums">
                Source: {weather.source} · {new Date(weather.observed_at).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Column 2: ML Risk Prediction & Influencing Factors */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 flex flex-col justify-between space-y-4">
          {pred ? (
            <>
              <div className="space-y-4">
                <div className={`p-4 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${riskStyle.container}`}>
                  <div className="flex items-start gap-3">
                    <RiskIcon className={`w-6 h-6 shrink-0 mt-0.5 ${riskStyle.text}`} aria-hidden="true" />
                    <div>
                      <div className="text-xs text-slate-600">
                        AI Model Prediction · {pred.model_name} (Joblib)
                      </div>
                      <div className={`text-2xl font-bold tracking-tight ${riskStyle.text}`}>
                        {riskLabel} LANDSLIDE RISK
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5">
                        {pred.district}, {pred.state} · Predicted at{' '}
                        <span className="font-mono tabular-nums">
                          {new Date(pred.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end gap-1 shrink-0 text-right">
                    <div className="text-[11px] text-slate-600">Confidence Split</div>
                    <div className="text-xs font-mono tabular-nums font-semibold text-slate-900">
                      LOW {((pred.probabilities.Low ?? 0) * 100).toFixed(0)}% · MOD{' '}
                      {((pred.probabilities.Medium ?? 0) * 100).toFixed(0)}% · HIGH{' '}
                      {((pred.probabilities.High ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Main Factors Influencing Prediction */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 mb-2">
                    Main Factors Influencing This ML Prediction
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {pred.influencing_factors.map((f) => (
                      <div
                        key={f.feature}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-md text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">{f.label}</span>
                          <span className="font-mono tabular-nums text-sky-700 font-semibold">
                            {f.value_display}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between gap-2">
                          <span className="truncate">{f.impact_note}</span>
                          <span className="font-mono tabular-nums text-slate-500 shrink-0">
                            Weight {f.importance_pct}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Separate Rule-Based Threshold Advisory */}
              {pred.rule_advisory && (
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">
                      {pred.rule_advisory.title}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {pred.rule_advisory.reasons.join(' ')}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-semibold shrink-0 ${
                      pred.rule_advisory.level === 'WARNING'
                        ? 'text-red-700'
                        : pred.rule_advisory.level === 'WATCH'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                    }`}
                  >
                    Rule Check: {pred.rule_advisory.level}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              Running Random Forest inference on live environmental telemetry...
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
