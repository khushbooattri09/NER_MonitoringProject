import React from 'react';
import {AlertTriangle, Database, RotateCcw} from 'lucide-react';
import type {StateMetadata, SusceptibilityClass} from '../types/landslide';

interface RegionFilterBarProps {
  states: StateMetadata[];
  selectedState: string;
  selectedDistrict: string;
  selectedRiskFilter: 'All' | SusceptibilityClass;
  onStateChange: (state: string) => void;
  onDistrictChange: (district: string) => void;
  onRiskFilterChange: (risk: 'All' | SusceptibilityClass) => void;
  onResetFilters: () => void;
  activeDatasetName: string;
  isDemonstration: boolean;
  provenanceNotice: string;
}

export const RegionFilterBar: React.FC<RegionFilterBarProps> = ({
  states,
  selectedState,
  selectedDistrict,
  selectedRiskFilter,
  onStateChange,
  onDistrictChange,
  onRiskFilterChange,
  onResetFilters,
  activeDatasetName,
  isDemonstration,
  provenanceNotice,
}) => {
  const availableDistricts = React.useMemo(() => {
    if (selectedState === 'All') {
      return states.flatMap((s) => s.districts);
    }
    const found = states.find((s) => s.state === selectedState);
    return found ? found.districts : [];
  }, [states, selectedState]);

  const riskOptions: ('All' | SusceptibilityClass)[] = ['All', 'Low', 'Medium', 'High'];

  return (
    <section className="space-y-4">
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-md border text-xs ${
          isDemonstration
            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5">
          {isDemonstration ? (
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          ) : (
            <Database className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          )}
          <p className="leading-relaxed">
            <span className="font-semibold">
              {isDemonstration ? 'Demonstration Mode Active' : 'Historical / Field Dataset Active'}
            </span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-mono">{activeDatasetName}</span>
            <span className="mx-1.5" aria-hidden="true">—</span>
            <span>{provenanceNotice}</span>
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
          <div>
            <label htmlFor="ner-state-select" className="block text-xs font-medium text-slate-600 mb-1.5">
              North Eastern State (8 States)
            </label>
            <select
              id="ner-state-select"
              value={selectedState}
              onChange={(e) => {
                onStateChange(e.target.value);
                onDistrictChange('All');
              }}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="All">All 8 NER States</option>
              {states.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ner-district-select" className="block text-xs font-medium text-slate-600 mb-1.5">
              District Selection
            </label>
            <select
              id="ner-district-select"
              value={selectedDistrict}
              onChange={(e) => onDistrictChange(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="All">All Districts</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-600 mb-1.5">
              Susceptibility Class Filter
            </span>
            <div className="inline-flex w-full h-10 p-1 bg-slate-100 rounded-md border border-slate-200">
              {riskOptions.map((risk) => {
                const active = selectedRiskFilter === risk;
                return (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => onRiskFilterChange(risk)}
                    className={`flex-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {risk === 'High' ? 'HIGH' : risk === 'Medium' ? 'MOD' : risk === 'Low' ? 'LOW' : 'All'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {(selectedState !== 'All' || selectedDistrict !== 'All' || selectedRiskFilter !== 'All') && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </section>
  );
};
