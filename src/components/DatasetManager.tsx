import React, {useRef, useState} from 'react';
import {CheckCircle2, Download, FileUp, RotateCcw} from 'lucide-react';
import {landslideApi} from '../services/api';
import type {DatasetSummary, DatasetUploadResponse} from '../types/landslide';

interface DatasetManagerProps {
  datasets: DatasetSummary[];
  onDatasetChanged: () => Promise<void>;
}

export const DatasetManager: React.FC<DatasetManagerProps> = ({datasets, onDatasetChanged}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<DatasetUploadResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMsg(null);
    if (file && !datasetName) {
      setDatasetName(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a CSV, GeoJSON, or GeoTIFF (.tif) file to upload.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setUploadResult(null);
    try {
      const res = await landslideApi.uploadDataset(selectedFile, datasetName);
      setUploadResult(res);
      setSelectedFile(null);
      setDatasetName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await onDatasetChanged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Dataset upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: number) => {
    setActivatingId(id);
    setErrorMsg(null);
    try {
      await landslideApi.activateDataset(id);
      await onDatasetChanged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to activate dataset.');
    } finally {
      setActivatingId(null);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    setErrorMsg(null);
    try {
      await landslideApi.resetDemonstrationDataset();
      await onDatasetChanged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to restore demonstration dataset.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload & Preprocessing Panel */}
        <form
          onSubmit={handleUploadSubmit}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Dataset Upload & Geospatial Preprocessing
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload tabular inventory CSV files, vector GeoJSON boundaries, or GeoTIFF elevation rasters (.tif).
              Files are processed via Pandas, GeoPandas, and Rasterio, stored in SQLite, and used to retrain Scikit-learn models.
            </p>
          </div>

          <div>
            <label htmlFor="dataset-name-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Dataset Label (Optional)
            </label>
            <input
              id="dataset-name-input"
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g., GSI Sikkim Monsoon Inventory 2025"
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div>
            <label htmlFor="dataset-file-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Source File (.csv, .geojson, .json, .tif, .tiff)
            </label>
            <input
              ref={fileInputRef}
              id="dataset-file-input"
              type="file"
              accept=".csv,.geojson,.json,.tif,.tiff"
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {uploadResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>{uploadResult.message}</span>
              </div>
              <div className="font-mono text-[11px] text-emerald-800 pt-1">
                Processor: {String(uploadResult.preprocessing_report.processor || 'Pipeline')} · Rows:{' '}
                {uploadResult.dataset.row_count} · Imputed: {uploadResult.dataset.missing_values_imputed} · CRS:{' '}
                {uploadResult.dataset.crs}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
            >
              <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{uploading ? 'Processing & Training...' : 'Upload & Preprocess'}</span>
            </button>

            <a
              href="/api/datasets/sample-csv"
              download="ner_landslide_demonstration_template.csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download CSV Schema</span>
            </a>

            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{resetting ? 'Restoring...' : 'Restore Demo Dataset'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            Expected CSV columns: <span className="font-mono">state, district, latitude, longitude, rainfall_mm, elevation_m, slope_deg, soil_moisture_pct, ndvi, distance_to_road_m, susceptibility_class</span>. Missing elevation/slope values are sampled automatically from the Rasterio DEM.
          </div>
        </form>

        {/* Persisted Datasets Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 overflow-hidden">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              SQLite Dataset Registry
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch active dataset to update spatial layers, environmental charts, and ML training baselines
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 text-left">Dataset Name</th>
                  <th className="py-2.5 text-left">Format</th>
                  <th className="py-2.5 text-right">Rows</th>
                  <th className="py-2.5 text-right">Imputed</th>
                  <th className="py-2.5 text-left pl-4">Provenance</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datasets.map((ds) => (
                  <tr key={ds.id} className={ds.is_active ? 'bg-sky-50/40' : 'hover:bg-slate-50'}>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-900">{ds.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        CRS: {ds.crs || 'EPSG:4326'} · {new Date(ds.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-slate-700 uppercase">{ds.file_type}</td>
                    <td className="py-3 text-right font-mono text-slate-900">{ds.row_count}</td>
                    <td className="py-3 text-right font-mono text-slate-700">{ds.missing_values_imputed}</td>
                    <td className="py-3 pl-4">
                      <span
                        className={`font-medium ${
                          ds.is_demonstration ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {ds.is_demonstration ? 'Demonstration' : 'User Upload'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {ds.is_active ? (
                        <span className="text-xs font-semibold text-sky-700">Active</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActivate(ds.id)}
                          disabled={activatingId === ds.id}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
                        >
                          {activatingId === ds.id ? 'Loading...' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {datasets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No datasets stored in SQLite yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
