import type {
  AlertsResponse,
  DatasetSummary,
  DatasetUploadResponse,
  EnvironmentalProfilesResponse,
  LivePredictResponse,
  LiveWeatherReading,
  ModelEvaluation,
  NerGeoJsonCollection,
  PredictRequest,
  PredictResponse,
  RegionOverviewResponse,
} from '../types/landslide';

const CACHE_PREFIX = 'ner_offline_cache_v1:';
const LAST_SYNC_KEY = 'ner_offline_last_sync_at';

interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

function saveCache<T>(key: string, data: T): void {
  try {
    const now = new Date().toISOString();
    const payload: CacheEnvelope<T> = {data, cachedAt: now};
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
    localStorage.setItem(LAST_SYNC_KEY, now);
  } catch {
    // Ignore quota errors in restricted storage modes
  }
}

function loadCache<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function getLastSyncedTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = 2): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status === 503 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Network unavailable');
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithRetry(url, options);
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        message = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
      }
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function requestReadWithOfflineFallback<T>(
  cacheKey: string,
  url: string,
): Promise<{data: T; fromCache: boolean}> {
  try {
    const data = await requestJson<T>(url);
    saveCache(cacheKey, data);
    return {data, fromCache: false};
  } catch (err) {
    const cached = loadCache<T>(cacheKey);
    if (cached) {
      return {data: cached.data, fromCache: true};
    }
    throw err;
  }
}

export const landslideApi = {
  health: () => requestJson<{status: string; service: string}>('/api/health'),

  getRegionOverview: async (state?: string, district?: string) => {
    const params = new URLSearchParams();
    if (state && state !== 'All') params.set('state', state);
    if (district && district !== 'All') params.set('district', district);
    const qs = params.toString();
    return requestReadWithOfflineFallback<RegionOverviewResponse>(
      `overview:${qs || 'all'}`,
      `/api/regions/overview${qs ? `?${qs}` : ''}`,
    );
  },

  getNerGeoJson: async (state?: string) => {
    const params = new URLSearchParams();
    if (state && state !== 'All') params.set('state', state);
    const qs = params.toString();
    return requestReadWithOfflineFallback<NerGeoJsonCollection>(
      `geojson:${qs || 'all'}`,
      `/api/regions/geojson${qs ? `?${qs}` : ''}`,
    );
  },

  getEnvironmentalProfiles: async (state?: string, district?: string) => {
    const params = new URLSearchParams();
    if (state && state !== 'All') params.set('state', state);
    if (district && district !== 'All') params.set('district', district);
    const qs = params.toString();
    return requestReadWithOfflineFallback<EnvironmentalProfilesResponse>(
      `env:${qs || 'all'}`,
      `/api/regions/environmental${qs ? `?${qs}` : ''}`,
    );
  },

  getLiveWeather: async (state: string, district?: string, refresh = false) => {
    const params = new URLSearchParams({state});
    if (district && district !== 'All') params.set('district', district);
    if (refresh) params.set('refresh', 'true');
    return requestJson<LiveWeatherReading>(`/api/weather/live?${params.toString()}`);
  },

  getAllStatesLiveWeather: (refresh = false) =>
    requestJson<LiveWeatherReading[]>(`/api/weather/states${refresh ? '?refresh=true' : ''}`),

  listDatasets: () =>
    requestReadWithOfflineFallback<DatasetSummary[]>('datasets:list', '/api/datasets'),

  uploadDataset: async (file: File, datasetName?: string): Promise<DatasetUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (datasetName && datasetName.trim()) {
      formData.append('dataset_name', datasetName.trim());
    }
    return requestJson<DatasetUploadResponse>('/api/datasets/upload', {
      method: 'POST',
      body: formData,
    });
  },

  activateDataset: (datasetId: number) =>
    requestJson<DatasetSummary>(`/api/datasets/${datasetId}/activate`, {method: 'POST'}),

  resetDemonstrationDataset: () =>
    requestJson<DatasetSummary>('/api/datasets/reset-demo', {method: 'POST'}),

  getModelEvaluations: (datasetId?: number) =>
    requestReadWithOfflineFallback<ModelEvaluation[]>(
      `models:${datasetId ?? 'active'}`,
      datasetId ? `/api/models/evaluations?dataset_id=${datasetId}` : '/api/models/evaluations',
    ),

  trainModels: (testSize = 0.25, randomState = 42, datasetId?: number) =>
    requestJson<{
      dataset_id: number;
      dataset_name: string;
      is_demonstration_trained: boolean;
      models: ModelEvaluation[];
    }>('/api/models/train', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        dataset_id: datasetId ?? null,
        test_size: testSize,
        random_state: randomState,
      }),
    }),

  predictSusceptibility: (payload: PredictRequest) =>
    requestJson<PredictResponse>('/api/predictions/predict', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    }),

  predictWithLiveWeather: (state: string, district: string, modelKey = 'random_forest', forceRefresh = false) =>
    requestJson<LivePredictResponse>('/api/predictions/predict-live', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        state,
        district,
        model_key: modelKey,
        force_refresh: forceRefresh,
      }),
    }),

  getPredictionHistory: () =>
    requestReadWithOfflineFallback<PredictResponse[]>('predictions:history', '/api/predictions/history'),

  getAlerts: () =>
    requestReadWithOfflineFallback<AlertsResponse>('predictions:alerts', '/api/predictions/alerts'),
};
