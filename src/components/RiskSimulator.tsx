import React, {useEffect, useState} from 'react';
import {AlertCircle, Calculator, CloudRain} from 'lucide-react';
import {landslideApi} from '../services/api';
import {
  formatRiskLabel,
  type PredictResponse,
  type StateMetadata,
  type SusceptibilityClass,
} from '../types/landslide';

interface RiskSimulatorProps {
  states: StateMetadata[];
  defaultState: string;
  defaultDistrict: string;
}

const RISK_STYLE: Record<SusceptibilityClass, {text: string; bg: string; border: string}> = {
  Low: {text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200'},
  Medium: {text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200'},
  High: {text: 'text-red-800', bg: 'bg-red-50', border: 'border-red-200'},
};

export const RiskSimulator: React.FC<RiskSimulatorProps> = ({
  states,
  defaultState,
  defaultDistrict,
}) => {
  const initialState =
    defaultState !== 'All' ? defaultState : states[0]?.state ?? 'Meghalaya';
  const initialDistrictList =
    states.find((s) => s.state === initialState)?.districts ?? [];
  const initialDistrict =
    defaultDistrict !== 'All' && initialDistrictList.includes(defaultDistrict)
      ? defaultDistrict
      : initialDistrictList[0] ?? 'East Khasi Hills';

  const [stateName, setStateName] = useState(initialState);
  const [districtName, setDistrictName] = useState(initialDistrict);
  const [modelKey, setModelKey] = useState<'random_forest' | 'decision_tree' | 'logistic_regression'>(
    'random_forest',
  );
  const [rainfall, setRainfall] = useState(140);
  const [temperature, setTemperature] = useState(21.5);
  const [humidity, setHumidity] = useState(86);
  const [elevation, setElevation] = useState(1450);
  const [slope, setSlope] = useState(29.5);
  const [soilMoisture, setSoilMoisture] = useState(44);

  const [submitting, setSubmitting] = useState(false);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [history, setHistory] = useState<PredictResponse[]>([]);

  useEffect(() => {
    landslideApi.getPredictionHistory().then((r) => setHistory(r.data)).catch(() => {});
  }, []);

  const districtsForState =
    states.find((s) => s.state === stateName)?.districts ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const pred = await landslideApi.predictSusceptibility({
        model_key: modelKey,
        state: stateName,
        district: districtName,
        rainfall_mm: rainfall,
        temperature_c: temperature,
        humidity_pct: humidity,
        elevation_m: elevation,
        slope_deg: slope,
        soil_moisture_pct: soilMoisture,
        ndvi: 0.42,
        distance_to_road_m: 180,
        weather_source: 'Manual What-If Input',
      });
      setResult(pred);
      const updatedHist = await landslideApi.getPredictionHistory();
      setHistory(updatedHist.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Prediction request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePredictFromLiveWeather = async () => {
    setLiveSyncing(true);
    setErrorMsg(null);
    try {
      const res = await landslideApi.predictWithLiveWeather(
        stateName,
        districtName,
        modelKey,
        true,
      );
      setRainfall(res.weather.rainfall_7d_mm);
      setTemperature(res.weather.temperature_c);
      setHumidity(res.weather.humidity_pct);
      setElevation(res.weather.elevation_m);
      setSlope(res.weather.slope_deg);
      if (res.weather.soil_moisture_pct !== null) {
        setSoilMoisture(res.weather.soil_moisture_pct);
      }
      setResult(res.prediction);
      const updatedHist = await landslideApi.getPredictionHistory();
      setHistory(updatedHist.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Live weather prediction failed.');
    } finally {
      setLiveSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-md p-5 space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Landslide Risk Predictor (Joblib ML Engine)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Load real-time weather from Open-Meteo or test custom environmental parameters
              </p>
            </div>
            <button
              type="button"
              onClick={handlePredictFromLiveWeather}
              disabled={liveSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition-colors whitespace-nowrap"
            >
              <CloudRain className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{liveSyncing ? 'Fetching Live...' : 'Predict from Live Weather'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pred-state" className="block text-xs font-medium text-slate-700 mb-1">
                NER State
              </label>
              <select
                id="pred-state"
                value={stateName}
                onChange={(e) => {
                  const nextState = e.target.value;
                  setStateName(nextState);
                  const firstDist = states.find((s) => s.state === nextState)?.districts[0] ?? '';
                  setDistrictName(firstDist);
                }}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
              >
                {states.map((s) => (
                  <option key={s.state} value={s.state}>
                    {s.state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pred-district" className="block text-xs font-medium text-slate-700 mb-1">
                District
              </label>
              <select
                id="pred-district"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
              >
                {districtsForState.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="pred-model" className="block text-xs font-medium text-slate-700 mb-1">
              Trained Scikit-learn Model
            </label>
            <select
              id="pred-model"
              value={modelKey}
              onChange={(e) => setModelKey(e.target.value as typeof modelKey)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md"
            >
              <option value="random_forest">Random Forest Classifier</option>
              <option value="decision_tree">Decision Tree Classifier</option>
              <option value="logistic_regression">Logistic Regression</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="inp-rain" className="block text-[11px] font-medium text-slate-600 mb-1">
                7-Day Rainfall (mm)
              </label>
              <input
                id="inp-rain"
                type="number"
                step="5"
                min={0}
                max={12000}
                value={rainfall}
                onChange={(e) => setRainfall(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="inp-temp" className="block text-[11px] font-medium text-slate-600 mb-1">
                Temperature (°C)
              </label>
              <input
                id="inp-temp"
                type="number"
                step="0.5"
                min={-30}
                max={55}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="inp-hum" className="block text-[11px] font-medium text-slate-600 mb-1">
                Humidity (%)
              </label>
              <input
                id="inp-hum"
                type="number"
                step="1"
                min={0}
                max={100}
                value={humidity}
                onChange={(e) => setHumidity(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="inp-soil" className="block text-[11px] font-medium text-slate-600 mb-1">
                Soil Moisture (%)
              </label>
              <input
                id="inp-soil"
                type="number"
                step="1"
                min={0}
                max={100}
                value={soilMoisture}
                onChange={(e) => setSoilMoisture(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="inp-elev" className="block text-[11px] font-medium text-slate-600 mb-1">
                Elevation (m)
              </label>
              <input
                id="inp-elev"
                type="number"
                step="10"
                min={0}
                max={9000}
                value={elevation}
                onChange={(e) => setElevation(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="inp-slope" className="block text-[11px] font-medium text-slate-600 mb-1">
                Slope (°)
              </label>
              <input
                id="inp-slope"
                type="number"
                step="0.5"
                min={0}
                max={89}
                value={slope}
                onChange={(e) => setSlope(Number(e.target.value))}
                className="w-full h-9 px-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-md transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{submitting ? 'Running ML Inference...' : 'Predict Risk Level'}</span>
          </button>
        </form>

        {/* Output Card */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-md p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">ML Prediction Result</h3>
          {result ? (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-md border ${RISK_STYLE[result.predicted_class].bg} ${RISK_STYLE[result.predicted_class].border}`}
              >
                <div className="text-xs text-slate-600">
                  {result.district}, {result.state} · {result.model_name} ·{' '}
                  <span className="font-mono tabular-nums">
                    {new Date(result.created_at).toLocaleString()}
                  </span>
                </div>
                <div className={`text-2xl font-bold mt-1 ${RISK_STYLE[result.predicted_class].text}`}>
                  {formatRiskLabel(result.predicted_class)} RISK
                </div>
              </div>

              <div className="space-y-2">
                {(['Low', 'Medium', 'High'] as SusceptibilityClass[]).map((cls) => {
                  const prob = (result.probabilities[cls] ?? 0) * 100;
                  return (
                    <div key={cls} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{formatRiskLabel(cls)}</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {prob.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            cls === 'High'
                              ? 'bg-red-700'
                              : cls === 'Medium'
                                ? 'bg-amber-600'
                                : 'bg-emerald-700'
                          }`}
                          style={{width: `${prob}%`}}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {result.influencing_factors && result.influencing_factors.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-800">
                    Main Influencing Factors
                  </div>
                  {result.influencing_factors.map((f) => (
                    <div key={f.feature} className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {f.label}: <span className="font-mono text-slate-900">{f.value_display}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {f.importance_pct}% weight
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {result.rule_advisory && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                  <div className="font-semibold text-slate-800">
                    {result.rule_advisory.title} ({result.rule_advisory.level})
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {result.rule_advisory.reasons.join(' ')}
                  </p>
                  <p className="text-[11px] text-slate-500">{result.rule_advisory.notice}</p>
                </div>
              )}

              <div className="flex items-start gap-2 text-[11px] text-slate-600">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{result.disclaimer}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Click &quot;Predict from Live Weather&quot; or submit custom environmental parameters to compute risk probabilities using the saved Joblib model.
            </p>
          )}
        </div>
      </div>

      {/* Full SQLite Prediction History */}
      <div className="bg-white border border-slate-200 rounded-md p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Prediction History Log (SQLite Database)
            </h3>
            <p className="text-xs text-slate-500">
              Every live and simulated prediction with environmental inputs and timestamps
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {history.length} recent records
          </span>
        </div>

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2 text-left">Timestamp</th>
                  <th className="py-2 text-left">Location</th>
                  <th className="py-2 text-right">Rainfall</th>
                  <th className="py-2 text-right">Temp / Hum</th>
                  <th className="py-2 text-left pl-4">Model</th>
                  <th className="py-2 text-left">Risk Level</th>
                  <th className="py-2 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.prediction_id} className="hover:bg-slate-50">
                    <td className="py-2 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 font-medium text-slate-900">
                      {h.district}, {h.state}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {h.rainfall_mm != null ? `${h.rainfall_mm.toFixed(1)} mm` : '—'}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {h.temperature_c != null ? `${h.temperature_c.toFixed(1)}°C` : '—'} /{' '}
                      {h.humidity_pct != null ? `${h.humidity_pct.toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2 pl-4 text-slate-600">
                      {h.model_name.replace(' Classifier', '')}
                    </td>
                    <td className={`py-2 font-semibold ${RISK_STYLE[h.predicted_class].text}`}>
                      {formatRiskLabel(h.predicted_class)}
                    </td>
                    <td className="py-2 text-right font-mono text-slate-500">
                      {h.weather_source || (h.is_demonstration_model ? 'Demo' : 'Live/Local')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No predictions saved to SQLite yet.</p>
        )}
      </div>
    </div>
  );
};
