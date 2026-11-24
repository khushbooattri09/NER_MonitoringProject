import React from 'react';
import {AlertTriangle, ShieldAlert} from 'lucide-react';
import type {AlertsResponse} from '../types/landslide';

interface AlertsPanelProps {
  alerts: AlertsResponse | null;
  onSelectLocation: (state: string, district: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({alerts, onSelectLocation}) => {
  const mlAlerts = alerts?.ml_high_risk_alerts ?? [];
  const ruleAlerts = alerts?.rule_based_advisories ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Early Warning &amp; High-Risk Alerts
          </h2>
          <p className="text-xs text-slate-500">
            Trained Random Forest HIGH-risk classifications are displayed separately from rule-based rainfall threshold checks
          </p>
        </div>
        {alerts && (
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            Weather feed: {alerts.weather_source} · Checked {new Date(alerts.generated_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Machine Learning HIGH Risk Predictions */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-700" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">
                ML High-Risk Predictions (Scikit-learn)
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-red-700">
              {mlAlerts.length} active
            </span>
          </div>

          {mlAlerts.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {mlAlerts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLocation(item.state, item.district)}
                  className="w-full text-left p-3 bg-red-50/70 hover:bg-red-50 border border-red-200 rounded-md transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-red-900">
                      HIGH RISK · {item.district}, {item.state}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-red-700">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-red-800">{item.message}</p>
                  <div className="text-[11px] font-mono text-red-700">
                    Model: {item.source_label}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600">
              No HIGH-risk ML predictions logged in recent monitoring runs.
            </div>
          )}
        </div>

        {/* 2. Separate Rule-Based Weather Threshold Advisories */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-900">
                Rule-Based Rainfall &amp; Slope Advisories
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-amber-700">
              {ruleAlerts.length} triggered
            </span>
          </div>

          {ruleAlerts.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {ruleAlerts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLocation(item.state, item.district)}
                  className="w-full text-left p-3 bg-amber-50/70 hover:bg-amber-50 border border-amber-200 rounded-md transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-amber-900">
                      {item.risk_level} · {item.district}, {item.state}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-amber-800">
                      7d Rain: {item.rainfall_mm.toFixed(1)} mm
                    </span>
                  </div>
                  <p className="text-xs text-amber-900">{item.message}</p>
                  <div className="text-[11px] font-mono text-amber-700">
                    {item.source_label}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600">
              All 8 NER state capital monitoring stations are currently below IMD heavy-rainfall rule thresholds.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
