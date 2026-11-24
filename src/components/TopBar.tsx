import React from 'react';
import {Database} from 'lucide-react';
import {PWAInstallButton} from './PWAInstallButton';

export type DashboardTab = 'overview' | 'environmental' | 'models' | 'predictor' | 'datasets';

interface TopBarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onUploadClick: () => void;
}

const NAV_ITEMS: {id: DashboardTab; label: string}[] = [
  {id: 'overview', label: 'Overview'},
  {id: 'environmental', label: 'Analytics'},
  {id: 'models', label: 'ML Models'},
  {id: 'predictor', label: 'Predictor'},
];

export const TopBar: React.FC<TopBarProps> = ({activeTab, onSelectTab, onUploadClick}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          className="text-left text-base sm:text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
        >
          NER Landslide Monitor
        </button>

        <nav
          aria-label="Primary dashboard sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none ${
                  isActive
                    ? 'border-sky-400 text-white font-semibold'
                    : 'border-transparent text-slate-300 hover:text-white hover:border-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onUploadClick}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              activeTab === 'datasets'
                ? 'bg-sky-500 text-white'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Datasets</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="Mobile dashboard sections"
        className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto border-t border-slate-800"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
