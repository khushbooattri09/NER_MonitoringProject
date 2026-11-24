import React, {useState} from 'react';
import {Download} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white text-slate-900 border border-slate-200 p-5 space-y-3">
              <h3 className="text-base font-semibold">Install NER Landslide Monitor</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> button in the Safari toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong> to use cached maps and
                models offline.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
