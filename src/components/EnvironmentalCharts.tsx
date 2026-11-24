import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type {EnvironmentalProfilesResponse} from '../types/landslide';

interface EnvironmentalChartsProps {
  data: EnvironmentalProfilesResponse | null;
  loading: boolean;
}

const SUSCEPTIBILITY_COLORS = {
  Low: '#15803d',
  Medium: '#b45309',
  High: '#b91c1c',
};

export const EnvironmentalCharts: React.FC<EnvironmentalChartsProps> = ({data, loading}) => {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="h-72 bg-white border border-slate-200 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.observations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-md p-8 text-center">
        <p className="text-sm font-medium text-slate-900">
          No environmental observations match the active filter.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Reset state/district filters or upload a new dataset.
        </p>
      </div>
    );
  }

  const lowPoints = data.observations.filter((o) => o.susceptibility_class === 'Low');
  const medPoints = data.observations.filter((o) => o.susceptibility_class === 'Medium');
  const highPoints = data.observations.filter((o) => o.susceptibility_class === 'High');

  return (
    <div className="space-y-6">
      {/* Historical Rainfall Trends & Landslide Occurrences */}
      {data.historical_trends && data.historical_trends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="h-1 bg-sky-700" aria-hidden="true" />
            <div className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Historical Rainfall &amp; Soil Moisture Trend
                </h3>
                <p className="text-xs text-slate-500">
                  Monthly ERA5-Land 7-day rainfall (mm) and soil moisture (%) across observed dates
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.historical_trends} margin={{top: 8, right: 10, left: -12, bottom: 4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{fontSize: 10, fill: '#475569'}} />
                    <YAxis yAxisId="left" tick={{fontSize: 11, fill: '#475569'}} unit="mm" />
                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11, fill: '#0d9488'}} unit="%" />
                    <Tooltip contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}} />
                    <Legend wrapperStyle={{fontSize: '11px'}} />
                    <Bar
                      yAxisId="left"
                      dataKey="mean_rainfall_mm"
                      name="Mean 7d Rainfall (mm)"
                      fill="#0369a1"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="mean_soil_moisture_pct"
                      name="Soil Moisture (%)"
                      stroke="#0d9488"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="h-1 bg-red-600" aria-hidden="true" />
            <div className="p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Historical Landslide &amp; Risk Occurrences Over Time
                </h3>
                <p className="text-xs text-slate-500">
                  Documented and seasonal observations grouped by LOW, MODERATE, and HIGH risk
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.historical_trends} margin={{top: 8, right: 8, left: -16, bottom: 4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{fontSize: 10, fill: '#475569'}} />
                    <YAxis tick={{fontSize: 11, fill: '#475569'}} />
                    <Tooltip contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}} />
                    <Legend wrapperStyle={{fontSize: '11px'}} />
                    <Bar dataKey="low_risk_events" name="LOW" stackId="a" fill={SUSCEPTIBILITY_COLORS.Low} />
                    <Bar dataKey="medium_risk_events" name="MODERATE" stackId="a" fill={SUSCEPTIBILITY_COLORS.Medium} />
                    <Bar dataKey="high_risk_events" name="HIGH" stackId="a" fill={SUSCEPTIBILITY_COLORS.High} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rainfall Histogram */}
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="h-1 bg-sky-600" aria-hidden="true" />
          <div className="p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Rainfall Distribution (mm)</h3>
              <p className="text-xs text-slate-500">
                Observations across precipitation bands · {data.is_demonstration ? 'Demo Data' : 'Historical/Field'}
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rainfall_bins} margin={{top: 8, right: 8, left: -16, bottom: 4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{fontSize: 10, fill: '#475569'}} />
                  <YAxis tick={{fontSize: 11, fill: '#475569'}} />
                  <Tooltip contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}} />
                  <Legend wrapperStyle={{fontSize: '11px'}} />
                  <Bar dataKey="Low" name="LOW" stackId="a" fill={SUSCEPTIBILITY_COLORS.Low} />
                  <Bar dataKey="Medium" name="MODERATE" stackId="a" fill={SUSCEPTIBILITY_COLORS.Medium} />
                  <Bar dataKey="High" name="HIGH" stackId="a" fill={SUSCEPTIBILITY_COLORS.High} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Elevation Histogram */}
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="h-1 bg-teal-600" aria-hidden="true" />
          <div className="p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Elevation Profile (m ASL)</h3>
              <p className="text-xs text-slate-500">
                DEM elevation bands by risk class
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.elevation_bins} margin={{top: 8, right: 8, left: -16, bottom: 4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{fontSize: 10, fill: '#475569'}} />
                  <YAxis tick={{fontSize: 11, fill: '#475569'}} />
                  <Tooltip contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}} />
                  <Legend wrapperStyle={{fontSize: '11px'}} />
                  <Bar dataKey="Low" name="LOW" stackId="a" fill={SUSCEPTIBILITY_COLORS.Low} />
                  <Bar dataKey="Medium" name="MODERATE" stackId="a" fill={SUSCEPTIBILITY_COLORS.Medium} />
                  <Bar dataKey="High" name="HIGH" stackId="a" fill={SUSCEPTIBILITY_COLORS.High} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Slope Histogram */}
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="h-1 bg-amber-500" aria-hidden="true" />
          <div className="p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Terrain Slope Angle (°)</h3>
              <p className="text-xs text-slate-500">
                DEM gradient distribution across monitoring sites
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slope_bins} margin={{top: 8, right: 8, left: -16, bottom: 4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{fontSize: 10, fill: '#475569'}} />
                  <YAxis tick={{fontSize: 11, fill: '#475569'}} />
                  <Tooltip contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}} />
                  <Legend wrapperStyle={{fontSize: '11px'}} />
                  <Bar dataKey="Low" name="LOW" stackId="a" fill={SUSCEPTIBILITY_COLORS.Low} />
                  <Bar dataKey="Medium" name="MODERATE" stackId="a" fill={SUSCEPTIBILITY_COLORS.Medium} />
                  <Bar dataKey="High" name="HIGH" stackId="a" fill={SUSCEPTIBILITY_COLORS.High} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Slope vs Rainfall Scatter */}
        <div className="bg-white border border-slate-200 rounded-md p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Slope (°) vs. Event Rainfall (mm) Correlation
            </h3>
            <p className="text-xs text-slate-500">
              Each point represents a historical observation in the selected region
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{top: 10, right: 16, bottom: 10, left: -6}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="slope_deg"
                  name="Slope"
                  unit="°"
                  tick={{fontSize: 11, fill: '#475569'}}
                />
                <YAxis
                  type="number"
                  dataKey="rainfall_mm"
                  name="Rainfall"
                  unit="mm"
                  tick={{fontSize: 11, fill: '#475569'}}
                />
                <ZAxis type="number" dataKey="elevation_m" range={[36, 120]} name="Elevation" unit="m" />
                <Tooltip
                  cursor={{strokeDasharray: '3 3'}}
                  contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}}
                />
                <Legend wrapperStyle={{fontSize: '11px'}} />
                <Scatter name="LOW Risk" data={lowPoints} fill={SUSCEPTIBILITY_COLORS.Low} />
                <Scatter name="MODERATE Risk" data={medPoints} fill={SUSCEPTIBILITY_COLORS.Medium} />
                <Scatter name="HIGH Risk" data={highPoints} fill={SUSCEPTIBILITY_COLORS.High} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* State-Level Mean Environmental Table */}
        <div className="bg-white border border-slate-200 rounded-md p-4 overflow-hidden">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              State-Level Environmental Summary (8 NER States)
            </h3>
            <p className="text-xs text-slate-500">
              Aggregated rainfall, elevation, slope, and high-risk occurrences
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2 text-left">State</th>
                  <th className="py-2 text-right">Records</th>
                  <th className="py-2 text-right">Mean Rain</th>
                  <th className="py-2 text-right">Mean Elev</th>
                  <th className="py-2 text-right">Mean Slope</th>
                  <th className="py-2 text-right">HIGH Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.state_aggregates.map((row) => (
                  <tr key={row.state} className="hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-900">{row.state}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">{row.total}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {row.mean_rainfall_mm} mm
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {row.mean_elevation_m} m
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                      {row.mean_slope_deg}°
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold text-red-700">
                      {row.high_risk_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
