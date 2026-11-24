import React, {useState} from 'react';
import {AlertCircle, Play} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {formatRiskLabel, type ModelEvaluation} from '../types/landslide';

interface ModelDashboardProps {
  evaluations: ModelEvaluation[];
  loading: boolean;
  missingValuesImputed?: number;
  limitations?: string[];
  onRetrain: (testSize: number, randomState: number) => Promise<void>;
}

export const ModelDashboard: React.FC<ModelDashboardProps> = ({
  evaluations,
  loading,
  missingValuesImputed = 0,
  limitations = [],
  onRetrain,
}) => {
  const [selectedModelKey, setSelectedModelKey] = useState<string>('random_forest');
  const [testSizePct, setTestSizePct] = useState<number>(25);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [training, setTraining] = useState(false);

  const activeModel =
    evaluations.find((m) => m.model_key === selectedModelKey) ?? evaluations[0] ?? null;

  const handleTrainClick = async () => {
    setTraining(true);
    try {
      await onRetrain(testSizePct / 100, randomSeed);
    } finally {
      setTraining(false);
    }
  };

  if (loading && evaluations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-md p-8 text-center text-xs text-slate-500">
        Loading Scikit-learn model evaluation metrics...
      </div>
    );
  }

  if (evaluations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-md p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-900">
          No trained Scikit-learn evaluations available for the active dataset.
        </p>
        <button
          type="button"
          onClick={handleTrainClick}
          disabled={training}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-md"
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{training ? 'Training Classifiers...' : 'Train & Evaluate Models'}</span>
        </button>
      </div>
    );
  }

  const comparisonData = evaluations.map((m) => ({
    name: m.model_name.replace(' Classifier', ''),
    'Train Accuracy': Number((((m.train_accuracy ?? m.accuracy) * 100)).toFixed(1)),
    'Test Accuracy': Number((m.accuracy * 100).toFixed(1)),
    Precision: Number((m.precision_weighted * 100).toFixed(1)),
    Recall: Number((m.recall_weighted * 100).toFixed(1)),
    'F1-Score': Number((m.f1_weighted * 100).toFixed(1)),
  }));

  const maxMatrixVal = activeModel
    ? Math.max(1, ...activeModel.confusion_matrix.flat())
    : 1;

  return (
    <div className="space-y-6">
      {/* Training Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Scikit-learn Classification Evaluation (Joblib Persisted)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Metrics computed directly via stratified train/test split on{' '}
            <span className="font-mono">
              {activeModel?.is_demonstration_trained
                ? 'Demonstration Dataset'
                : 'NER Historical / Uploaded Dataset'}
            </span>
            {' · '}
            Train: <span className="font-mono tabular-nums">{activeModel?.train_samples}</span> samples · Test:{' '}
            <span className="font-mono tabular-nums">{activeModel?.test_samples}</span> samples
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="test-split-select" className="block text-[11px] font-medium text-slate-600 mb-1">
              Test Split
            </label>
            <select
              id="test-split-select"
              value={testSizePct}
              onChange={(e) => setTestSizePct(Number(e.target.value))}
              className="h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
            >
              <option value={20}>20% Test / 80% Train</option>
              <option value={25}>25% Test / 75% Train</option>
              <option value={30}>30% Test / 70% Train</option>
            </select>
          </div>

          <div>
            <label htmlFor="seed-input" className="block text-[11px] font-medium text-slate-600 mb-1">
              Random Seed
            </label>
            <input
              id="seed-input"
              type="number"
              min={1}
              max={9999}
              value={randomSeed}
              onChange={(e) => setRandomSeed(Number(e.target.value) || 42)}
              className="w-20 h-9 px-2.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
            />
          </div>

          <button
            type="button"
            onClick={handleTrainClick}
            disabled={training}
            className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{training ? 'Training...' : 'Retrain All 3 Models'}</span>
          </button>
        </div>
      </div>

      {/* 3 Model Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {evaluations.map((model) => {
          const isSelected = activeModel?.model_key === model.model_key;
          const accentBar =
            model.model_key === 'random_forest'
              ? 'bg-emerald-600'
              : model.model_key === 'decision_tree'
                ? 'bg-amber-600'
                : 'bg-sky-600';

          return (
            <button
              key={model.model_key}
              type="button"
              onClick={() => setSelectedModelKey(model.model_key)}
              className={`text-left bg-white rounded-md overflow-hidden border transition-all ${
                isSelected
                  ? 'border-sky-700 ring-2 ring-sky-600/25'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`h-1.5 w-full ${accentBar}`} aria-hidden="true" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{model.model_name}</h3>
                  <span
                    className={`text-[11px] font-mono font-semibold ${
                      isSelected ? 'text-sky-700' : 'text-slate-400'
                    }`}
                  >
                    {isSelected ? 'Inspecting' : 'Select'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100">
                  <div>
                    <div className="text-[11px] text-slate-500">Train Acc</div>
                    <div className="text-base font-mono tabular-nums font-semibold text-slate-900">
                      {(((model.train_accuracy ?? model.accuracy) * 100)).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Test Acc</div>
                    <div className="text-base font-mono tabular-nums font-semibold text-sky-700">
                      {(model.accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">F1-Score</div>
                    <div className="text-base font-mono tabular-nums font-semibold text-slate-900">
                      {(model.f1_weighted * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Precision</div>
                    <div className="text-sm font-mono tabular-nums font-medium text-slate-800">
                      {(model.precision_weighted * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Recall</div>
                    <div className="text-sm font-mono tabular-nums font-medium text-slate-800">
                      {(model.recall_weighted * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Comparative Chart & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-md p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Training vs. Testing Accuracy, Precision, Recall &amp; F1 (%)
            </h3>
            <p className="text-xs text-slate-500">
              Computed live from Scikit-learn metrics on stratified holdout split
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{top: 8, right: 12, left: -12, bottom: 4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 11, fill: '#334155'}} />
                <YAxis domain={[0, 100]} unit="%" tick={{fontSize: 11, fill: '#475569'}} />
                <Tooltip contentStyle={{fontSize: '12px', borderColor: '#cbd5e1'}} />
                <Legend wrapperStyle={{fontSize: '11px'}} />
                <Bar dataKey="Train Accuracy" fill="#475569" />
                <Bar dataKey="Test Accuracy" fill="#0f172a" />
                <Bar dataKey="Precision" fill="#0369a1" />
                <Bar dataKey="Recall" fill="#0d9488" />
                <Bar dataKey="F1-Score" fill="#d97706" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {activeModel && (
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-md p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Confusion Matrix — {activeModel.model_name}
              </h3>
              <p className="text-xs text-slate-500">
                Rows show actual risk class; columns show predicted risk class
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-500 font-medium">Actual \ Predicted</th>
                    {activeModel.class_labels.map((lbl) => (
                      <th key={lbl} className="p-2 text-center font-semibold text-slate-700">
                        {formatRiskLabel(lbl)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeModel.confusion_matrix.map((row, rowIdx) => {
                    const actualLabel = activeModel.class_labels[rowIdx];
                    return (
                      <tr key={actualLabel} className="border-t border-slate-100">
                        <td className="p-2 font-semibold text-slate-800">
                          {formatRiskLabel(actualLabel)}
                        </td>
                        {row.map((val, colIdx) => {
                          const intensity = val / maxMatrixVal;
                          const isDiag = rowIdx === colIdx;
                          const bgStyle = isDiag
                            ? `rgba(3, 105, 161, ${0.12 + intensity * 0.45})`
                            : `rgba(185, 28, 28, ${val > 0 ? 0.08 + intensity * 0.3 : 0.02})`;
                          return (
                            <td
                              key={`${rowIdx}-${colIdx}`}
                              style={{backgroundColor: bgStyle}}
                              className="p-3 text-center font-mono tabular-nums text-sm font-semibold text-slate-900 border border-white"
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Per-Class Metrics & Feature Importance */}
      {activeModel && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Per-Class Classification Report — {activeModel.model_name}
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2 text-left">Risk Class</th>
                  <th className="py-2 text-right">Precision</th>
                  <th className="py-2 text-right">Recall</th>
                  <th className="py-2 text-right">F1-Score</th>
                  <th className="py-2 text-right">Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeModel.per_class_metrics.map((m) => (
                  <tr key={m.label}>
                    <td className="py-2.5 font-semibold text-slate-900">
                      {formatRiskLabel(m.label)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {(m.precision * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {(m.recall * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {(m.f1_score * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {m.support}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Normalized Feature Influence — {activeModel.model_name}
            </h3>
            <div className="space-y-2.5">
              {activeModel.feature_importances.map((item) => (
                <div key={item.feature} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-700">{item.feature}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {(item.importance * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-sky-700"
                      style={{width: `${Math.min(100, item.importance * 100)}%`}}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data Cleaning & Limitations Disclosure */}
      <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertCircle className="w-4 h-4 text-sky-700" aria-hidden="true" />
          <span>Data Preprocessing, Missing Values &amp; Model Limitations</span>
        </div>
        <p className="text-xs text-slate-600">
          Missing numeric observations imputed via median strategy during ingestion:{' '}
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {missingValuesImputed}
          </span>{' '}
          cells. Model pipelines are saved with <span className="font-mono">joblib</span> and include a{' '}
          <span className="font-mono">SimpleImputer(strategy=&quot;median&quot;)</span> step for live sensor gaps.
        </p>
        {limitations.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
            {limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
