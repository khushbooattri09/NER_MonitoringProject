import {useCallback, useEffect, useState} from 'react';
import {Activity, AlertTriangle, CheckCircle2, ShieldAlert} from 'lucide-react';
import {AlertsPanel} from './components/AlertsPanel';
import {DatasetManager} from './components/DatasetManager';
import {EnvironmentalCharts} from './components/EnvironmentalCharts';
import {LiveMonitorPanel} from './components/LiveMonitorPanel';
import {ModelDashboard} from './components/ModelDashboard';
import {NerRiskMap} from './components/NerRiskMap';
import {OfflineIndicator} from './components/OfflineIndicator';
import {RegionFilterBar} from './components/RegionFilterBar';
import {RiskSimulator} from './components/RiskSimulator';
import {SatellitePipelineHeader} from './components/SatellitePipelineHeader';
import {TerrainHeroBanner} from './components/TerrainHeroBanner';
import {TerrainPhotoStrip} from './components/TerrainPhotoStrip';
import {TopBar, type DashboardTab} from './components/TopBar';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {getLastSyncedTimestamp, landslideApi} from './services/api';
import {
  formatRiskLabel,
  type AlertsResponse,
  type DatasetSummary,
  type EnvironmentalProfilesResponse,
  type ModelEvaluation,
  type NerGeoJsonCollection,
  type RegionOverviewResponse,
  type SusceptibilityClass,
} from './types/landslide';

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');
  const [riskFilter, setRiskFilter] = useState<'All' | SusceptibilityClass>('All');

  const [overview, setOverview] = useState<RegionOverviewResponse | null>(null);
  const [geojson, setGeojson] = useState<NerGeoJsonCollection | null>(null);
  const [environmental, setEnvironmental] = useState<EnvironmentalProfilesResponse | null>(null);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [evaluations, setEvaluations] = useState<ModelEvaluation[]>([]);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState<boolean>(false);
  const [backendReachable, setBackendReachable] = useState<boolean>(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => getLastSyncedTimestamp());

  const loadRegionData = useCallback(async (stateVal: string, districtVal: string) => {
    setLoading(true);
    setApiError(null);
    try {
      const [ov, gj, env] = await Promise.all([
        landslideApi.getRegionOverview(stateVal, districtVal),
        landslideApi.getNerGeoJson(stateVal),
        landslideApi.getEnvironmentalProfiles(stateVal, districtVal),
      ]);
      setOverview(ov.data);
      setGeojson(gj.data);
      setEnvironmental(env.data);

      const isCached = ov.fromCache || gj.fromCache || env.fromCache;
      setUsingOfflineCache(isCached);
      setBackendReachable(!isCached);
      setLastSyncedAt(getLastSyncedTimestamp());
    } catch (err) {
      setBackendReachable(false);
      setApiError(err instanceof Error ? err.message : 'Unable to reach FastAPI backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    try {
      const [dsList, modelList, alertsRes] = await Promise.all([
        landslideApi.listDatasets(),
        landslideApi.getModelEvaluations(),
        landslideApi.getAlerts(),
      ]);
      setDatasets(dsList.data);
      setEvaluations(modelList.data);
      setAlerts(alertsRes.data);
      if (dsList.fromCache || modelList.fromCache || alertsRes.fromCache) {
        setUsingOfflineCache(true);
        setBackendReachable(false);
      }
      setLastSyncedAt(getLastSyncedTimestamp());
    } catch (err) {
      setBackendReachable(false);
      setApiError(err instanceof Error ? err.message : 'Failed to load datasets or model runs.');
    }
  }, []);

  const refreshAlerts = useCallback(() => {
    landslideApi
      .getAlerts()
      .then((res) => setAlerts(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRegionData(selectedState, selectedDistrict);
  }, [selectedState, selectedDistrict, loadRegionData]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Auto-reconnect when coming back online or when backend recovers
  useEffect(() => {
    if (!isOnline) {
      setBackendReachable(false);
      return;
    }
    if (backendReachable && !usingOfflineCache) return;

    const timer = setInterval(() => {
      landslideApi
        .health()
        .then(() => {
          setBackendReachable(true);
          setUsingOfflineCache(false);
          void loadRegionData(selectedState, selectedDistrict);
          void loadAdminData();
        })
        .catch(() => {
          // Stay in cached mode until backend responds
        });
    }, 5000);

    return () => clearInterval(timer);
  }, [
    isOnline,
    backendReachable,
    usingOfflineCache,
    selectedState,
    selectedDistrict,
    loadRegionData,
    loadAdminData,
  ]);

  const handleDatasetChanged = async () => {
    await Promise.all([loadRegionData(selectedState, selectedDistrict), loadAdminData()]);
  };

  const handleRetrainModels = async (testSize: number, randomState: number) => {
    const res = await landslideApi.trainModels(
      testSize,
      randomState,
      overview?.active_dataset_id ?? undefined,
    );
    setEvaluations(res.models);
  };

  const handleManualReconnect = () => {
    void loadRegionData(selectedState, selectedDistrict);
    void loadAdminData();
  };

  const totalObs = overview?.total_observations ?? 0;
  const highCount = overview?.class_distribution.High ?? 0;
  const medCount = overview?.class_distribution.Medium ?? 0;
  const lowCount = overview?.class_distribution.Low ?? 0;
  const districtCount = overview?.district_summaries.length ?? 0;
  const latestUpdateLabel = overview?.latest_data_update
    ? new Date(overview.latest_data_update).toLocaleString()
    : 'Syncing...';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onUploadClick={() => setActiveTab('datasets')}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <OfflineIndicator
          isOnline={isOnline}
          usingOfflineCache={usingOfflineCache}
          lastSyncedAt={lastSyncedAt}
          backendReachable={backendReachable}
          onRetryConnection={handleManualReconnect}
        />

        {activeTab === 'overview' && (
          <TerrainHeroBanner
            activeDatasetName={overview?.active_dataset_name ?? 'Loading...'}
            isDemonstration={overview?.is_demonstration ?? false}
            totalObservations={totalObs}
            highRiskCount={highCount}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'datasets' && (
          <SatellitePipelineHeader
            techLine="GeoPandas · Rasterio GeoTIFF DEM · SQLite Registry"
            title="Geospatial Dataset Ingestion & Preprocessing Pipeline"
            subtitle="Inspect the historical NER landslide + ERA5-Land dataset, or upload field inventory CSVs, GeoJSON boundaries, or GeoTIFF elevation models to retrain all Joblib models."
          />
        )}

        {activeTab === 'models' && (
          <SatellitePipelineHeader
            techLine="Scikit-learn · Joblib · Logistic Regression · Decision Tree · Random Forest"
            title="Machine Learning Model Evaluation & Diagnostics"
            subtitle="Compare training accuracy, testing accuracy, weighted precision, recall, F1-score, confusion matrix, and normalized feature influence."
          />
        )}

        {apiError && !overview && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-center justify-between gap-4">
            <span>Backend connection error: {apiError}</span>
            <button
              type="button"
              onClick={handleManualReconnect}
              className="px-3 py-1.5 font-semibold bg-white border border-red-300 rounded hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        <RegionFilterBar
          states={overview?.states ?? []}
          selectedState={selectedState}
          selectedDistrict={selectedDistrict}
          selectedRiskFilter={riskFilter}
          onStateChange={setSelectedState}
          onDistrictChange={setSelectedDistrict}
          onRiskFilterChange={setRiskFilter}
          onResetFilters={() => {
            setSelectedState('All');
            setSelectedDistrict('All');
            setRiskFilter('All');
          }}
          activeDatasetName={overview?.active_dataset_name ?? 'Loading...'}
          isDemonstration={overview?.is_demonstration ?? false}
          provenanceNotice={overview?.provenance_notice ?? 'Connecting to backend...'}
        />

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Overview KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                <div className="h-1 bg-sky-600" aria-hidden="true" />
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">Monitored Locations</div>
                    <div className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
                      {districtCount}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      {totalObs} records · {selectedState === 'All' ? '8 NER States' : selectedState}
                    </div>
                  </div>
                  <div className="p-2 rounded-md bg-sky-50 text-sky-700 shrink-0">
                    <Activity className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                <div className="h-1 bg-red-600" aria-hidden="true" />
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">HIGH Risk Records</div>
                    <div className="text-2xl font-mono tabular-nums font-bold text-red-700 mt-1">
                      {highCount}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      {totalObs > 0 ? `${((highCount / totalObs) * 100).toFixed(1)}% of selection` : '0.0%'}
                    </div>
                  </div>
                  <div className="p-2 rounded-md bg-red-50 text-red-700 shrink-0">
                    <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                <div className="h-1 bg-amber-500" aria-hidden="true" />
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">MODERATE Risk Records</div>
                    <div className="text-2xl font-mono tabular-nums font-bold text-amber-700 mt-1">
                      {medCount}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      {totalObs > 0 ? `${((medCount / totalObs) * 100).toFixed(1)}% of selection` : '0.0%'}
                    </div>
                  </div>
                  <div className="p-2 rounded-md bg-amber-50 text-amber-700 shrink-0">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                <div className="h-1 bg-emerald-600" aria-hidden="true" />
                <div className="p-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">LOW Risk &amp; Last Sync</div>
                    <div className="text-2xl font-mono tabular-nums font-bold text-emerald-700 mt-1">
                      {lowCount}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums truncate max-w-[190px]">
                      Updated: {latestUpdateLabel}
                    </div>
                  </div>
                  <div className="p-2 rounded-md bg-emerald-50 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>

            {/* Real-Time Weather & Live ML Prediction */}
            <LiveMonitorPanel
              states={overview?.states ?? []}
              selectedState={selectedState}
              selectedDistrict={selectedDistrict}
              onLocationChange={(st, dist) => {
                setSelectedState(st);
                setSelectedDistrict(dist);
              }}
              onPredictionCreated={refreshAlerts}
            />

            {/* Dedicated Early Warning & High-Risk Alerts Section */}
            <AlertsPanel
              alerts={alerts}
              onSelectLocation={(st, dist) => {
                setSelectedState(st);
                setSelectedDistrict(dist);
              }}
            />

            {/* Interactive 8-State NER Map + District Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-7">
                <NerRiskMap
                  geojson={geojson}
                  observations={environmental?.observations ?? []}
                  districtSummaries={overview?.district_summaries ?? []}
                  selectedState={selectedState}
                  selectedDistrict={selectedDistrict}
                  riskFilter={riskFilter}
                  onSelectState={(st) => {
                    setSelectedState(st);
                    setSelectedDistrict('All');
                  }}
                  onSelectDistrict={(st, dist) => {
                    setSelectedState(st);
                    setSelectedDistrict(dist);
                  }}
                />
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      District Risk &amp; Terrain Summary
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click any district row to inspect live weather and historical charts
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-600">
                    {districtCount} districts
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[500px]">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                      <tr>
                        <th className="px-3 py-2 text-left">District / State</th>
                        <th className="px-3 py-2 text-right">Mean Rain</th>
                        <th className="px-3 py-2 text-right">Slope</th>
                        <th className="px-3 py-2 text-left pl-3">Baseline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(overview?.district_summaries ?? [])
                        .filter(
                          (d) => riskFilter === 'All' || d.dominant_susceptibility === riskFilter,
                        )
                        .map((d) => {
                          const isSelected = selectedDistrict === d.district;
                          const clsColor =
                            d.dominant_susceptibility === 'High'
                              ? 'text-red-700'
                              : d.dominant_susceptibility === 'Medium'
                                ? 'text-amber-700'
                                : 'text-emerald-700';
                          return (
                            <tr
                              key={`${d.state}-${d.district}`}
                              onClick={() => {
                                setSelectedState(d.state);
                                setSelectedDistrict(d.district);
                              }}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-slate-900">{d.district}</div>
                                <div className="text-[11px] text-slate-500">{d.state}</div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                                {d.mean_rainfall_mm} mm
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                                {d.mean_slope_deg}°
                              </td>
                              <td className={`px-3 py-2.5 pl-3 font-semibold ${clsColor}`}>
                                {formatRiskLabel(d.dominant_susceptibility)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Regional Terrain Photographic Context */}
            <TerrainPhotoStrip
              selectedState={selectedState}
              onSelectState={(st) => {
                setSelectedState(st);
                setSelectedDistrict('All');
              }}
            />

            {/* Environmental & Historical Trends Charts */}
            <EnvironmentalCharts data={environmental} loading={loading} />
          </div>
        )}

        {activeTab === 'environmental' && (
          <div className="space-y-6">
            <TerrainPhotoStrip
              selectedState={selectedState}
              onSelectState={(st) => {
                setSelectedState(st);
                setSelectedDistrict('All');
              }}
            />
            <EnvironmentalCharts data={environmental} loading={loading} />
          </div>
        )}

        {activeTab === 'datasets' && (
          <DatasetManager datasets={datasets} onDatasetChanged={handleDatasetChanged} />
        )}

        {activeTab === 'models' && (
          <ModelDashboard
            evaluations={evaluations}
            loading={loading}
            missingValuesImputed={overview?.missing_values_imputed ?? 0}
            limitations={overview?.limitations ?? []}
            onRetrain={handleRetrainModels}
          />
        )}

        {activeTab === 'predictor' && (
          <RiskSimulator
            states={overview?.states ?? []}
            defaultState={selectedState}
            defaultDistrict={selectedDistrict}
          />
        )}
      </main>

      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 py-4 px-4 sm:px-6 text-xs">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            SIH 26001 · AI-Based Landslide Risk Prediction and Monitoring Using Machine Learning for NER
          </span>
          <span className="font-mono text-sky-300">
            Scikit-learn · Joblib · Open-Meteo Live Weather · GeoPandas · Rasterio · SQLite
          </span>
        </div>
      </footer>
    </div>
  );
}
