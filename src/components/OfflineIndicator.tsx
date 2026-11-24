import React from 'react';
import {RefreshCw, WifiOff} from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  usingOfflineCache: boolean;
  lastSyncedAt: string | null;
  backendReachable: boolean;
  onRetryConnection: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOnline,
  usingOfflineCache,
  lastSyncedAt,
  backendReachable,
  onRetryConnection,
}) => {
  if (isOnline && backendReachable && !usingOfflineCache) {
    return null;
  }

  const timeLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : null;

  return (
    <div
      role="status"
      className="bg-slate-900 text-white border border-slate-700 rounded-md px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
    >
      <div className="flex items-start sm:items-center gap-2.5">
        <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <div>
          <span className="font-semibold text-amber-300">
            {!isOnline ? 'Offline Mode Active' : 'FastAPI Backend Reconnecting'}
          </span>
          <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>
          <span className="text-slate-200">
            {usingOfflineCache
              ? `Displaying cached backend snapshot${timeLabel ? ` synced at ${timeLabel}` : ''}. Live upload, training, and inference require an active backend link.`
              : 'Attempting to establish live connection to the FastAPI geospatial & ML backend.'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetryConnection}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-200 rounded transition-colors whitespace-nowrap shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Reconnect</span>
      </button>
    </div>
  );
};
