import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ProcessItem, TraceListItem, TraceDetails, TraceSampleResponse, TraceCompareSyntheticResponse } from '../types';
import {
  Upload, FileText, CheckCircle, Database, Play,
  FlaskConical, RefreshCw, BarChart2, Layers, AlertCircle
} from 'lucide-react';

interface TraceLabPageProps {
  onLoadWorkload: (procs: ProcessItem[]) => void;
  onNavigate: (tab: string) => void;
}

export const TraceLabPage: React.FC<TraceLabPageProps> = ({ onLoadWorkload, onNavigate }) => {
  const [traces, setTraces] = useState<TraceListItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<number | null>(null);
  const [traceDetails, setTraceDetails] = useState<TraceDetails | null>(null);

  // Upload state
  const [uploadMode, setUploadMode] = useState<'bundled' | 'file' | 'paste'>('bundled');
  const [pastedText, setPastedText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [traceName, setTraceName] = useState<string>('');
  const [outlierPercentile, setOutlierPercentile] = useState<number>(99.0);

  // Sampling options
  const [samplingMethod, setSamplingMethod] = useState<'random' | 'time_window'>('random');
  const [sampleCount, setSampleCount] = useState<number>(20);
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [sampleSeed, setSampleSeed] = useState<number>(42);
  const [windowStart, setWindowStart] = useState<number>(0);
  const [sampleResult, setSampleResult] = useState<TraceSampleResponse | null>(null);

  // Synthetic comparison
  const [comparisonResult, setComparisonResult] = useState<TraceCompareSyntheticResponse | null>(null);
  const [comparing, setComparing] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadTracesList();
  }, []);

  const loadTracesList = async () => {
    try {
      const list = await api.listTraces();
      setTraces(list);
      if (list.length > 0 && !selectedTraceId) {
        selectTrace(list[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const selectTrace = async (id: number) => {
    setSelectedTraceId(id);
    setLoading(true);
    setError(null);
    try {
      const details = await api.getTraceDetails(id);
      setTraceDetails(details);
      setSampleResult(null);
      setComparisonResult(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load trace details');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBundled = async (fmt: 'swf' | 'csv') => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const formData = new FormData();
      formData.append('sample_bundled', fmt);
      formData.append('outlier_percentile', outlierPercentile.toString());
      const res = await api.uploadTrace(formData);
      setSuccessMsg(`Loaded bundled ${fmt.toUpperCase()} trace successfully (${res.cleaned_jobs_count} valid jobs)!`);
      await loadTracesList();
      selectTrace(res.id);
    } catch (err: any) {
      setError(err.message || 'Failed to load bundled trace');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFileOrText = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('outlier_percentile', outlierPercentile.toString());
      if (traceName) formData.append('name', traceName);

      if (uploadMode === 'file') {
        if (!selectedFile) throw new Error('Please select a file to upload');
        formData.append('file', selectedFile);
      } else {
        if (!pastedText.trim()) throw new Error('Please paste trace content');
        formData.append('raw_text', pastedText);
      }

      const res = await api.uploadTrace(formData);
      setSuccessMsg(`Trace "${res.name}" parsed and cleaned successfully (${res.cleaned_jobs_count} jobs)!`);
      setPastedText('');
      setSelectedFile(null);
      await loadTracesList();
      selectTrace(res.id);
    } catch (err: any) {
      setError(err.message || 'Trace upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleWorkload = async () => {
    if (!selectedTraceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.sampleTraceWorkload(selectedTraceId, {
        method: samplingMethod,
        count: sampleCount,
        scale_factor: scaleFactor,
        seed: sampleSeed,
        window_start_tick: windowStart,
        save_as_workload: true
      });
      setSampleResult(res);
      setSuccessMsg(`Sampled ${res.process_count} processes (Seed: ${sampleSeed}, Scale: ${scaleFactor}s/tick).`);
    } catch (err: any) {
      setError(err.message || 'Sampling failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCompareSynthetic = async () => {
    if (!selectedTraceId) return;
    setComparing(true);
    setError(null);
    try {
      const res = await api.compareTraceWithSynthetic(selectedTraceId, {
        seed: sampleSeed,
        sampling_count: sampleCount,
        scale_factor: scaleFactor
      });
      setComparisonResult(res);
      setSuccessMsg('Synthetic calibration grid search completed successfully!');
    } catch (err: any) {
      setError(err.message || 'Distribution comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const handleSendToSimulator = (procs: ProcessItem[]) => {
    onLoadWorkload(procs);
    onNavigate('simulator');
  };

  const handleSendToLaboratory = (procs: ProcessItem[]) => {
    onLoadWorkload(procs);
    onNavigate('laboratory');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trace Laboratory & Ingestion Pipeline</h1>
          <p className="page-subtitle">
            Ingest Standard Workload Format (SWF) and CSV job traces, execute cleaning and discretization,
            extract heavy-tail metrics, and calibrate synthetic generators.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: Trace Ingestion & Repository */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Upload Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={18} /> Ingest Workload Trace
            </div>
            <div className="tab-group" style={{ display: 'flex', gap: 4 }}>
              <button
                className={`btn btn-sm ${uploadMode === 'bundled' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setUploadMode('bundled')}
              >
                Bundled Samples
              </button>
              <button
                className={`btn btn-sm ${uploadMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setUploadMode('file')}
              >
                Upload File
              </button>
              <button
                className={`btn btn-sm ${uploadMode === 'paste' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setUploadMode('paste')}
              >
                Paste Text
              </button>
            </div>
          </div>

          <div className="card-body">
            {uploadMode === 'bundled' && (
              <div>
                <p style={{ fontSize: '0.88rem', color: 'var(--navy-600)', marginBottom: 16 }}>
                  Load bundled deterministic traces generated from real cluster workload distributions:
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleUploadBundled('swf')}
                    disabled={loading}
                  >
                    <Database size={16} /> Load Standard Workload Format (SWF)
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleUploadBundled('csv')}
                    disabled={loading}
                  >
                    <FileText size={16} /> Load Generic CSV Trace
                  </button>
                </div>
                <div style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--navy-500)' }}>
                  Bundled traces are generated with fixed seed 4242 and include log-normal burst demands and gamma arrivals.
                </div>
              </div>
            )}

            {(uploadMode === 'file' || uploadMode === 'paste') && (
              <form onSubmit={handleUploadFileOrText}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Trace Display Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., KTH SP2 Supercomputer Trace"
                    value={traceName}
                    onChange={(e) => setTraceName(e.target.value)}
                  />
                </div>

                {uploadMode === 'file' ? (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Select .swf or .csv file</label>
                    <input
                      type="file"
                      className="form-input"
                      accept=".swf,.csv,.txt"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Paste Raw Content (SWF or CSV)</label>
                    <textarea
                      className="form-input"
                      rows={5}
                      placeholder="Paste lines from an SWF file or CSV..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Outlier Capping Percentile (0 to 100)</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.5"
                    min="50"
                    max="100"
                    value={outlierPercentile}
                    onChange={(e) => setOutlierPercentile(parseFloat(e.target.value) || 99.0)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <RefreshCw className="spin" size={16} /> : <Upload size={16} />} Parse & Clean Trace
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Trace Selector & Repository */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Stored Workload Traces ({traces.length})</div>
          </div>
          <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {traces.length === 0 ? (
              <div style={{ color: 'var(--navy-500)', fontSize: '0.9rem', textAlign: 'center', padding: '30px 0' }}>
                No traces uploaded yet. Click &quot;Load Standard Workload Format (SWF)&quot; to begin.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {traces.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => selectTrace(t.id)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: t.id === selectedTraceId ? '2px solid var(--blue-600)' : '1px solid var(--border)',
                      background: t.id === selectedTraceId ? 'var(--blue-50, #f0f7ff)' : 'var(--surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--navy-500)' }}>
                        {t.filename} &bull; {t.cleaned_jobs_count} valid jobs &bull; {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="badge badge-blue">{t.format.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cleaning Report & Features Table */}
      {traceDetails && (
        <div style={{ marginBottom: 24 }}>
          {/* Cleaning Report */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">Cleaning & Verification Report: {traceDetails.name}</div>
              <span className="badge badge-green">Pipeline Validated</span>
            </div>
            <div className="card-body">
              <div className="grid-4" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-label">Raw Total Jobs</div>
                  <div className="stat-value">{traceDetails.cleaning_report.total_raw_jobs}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Dropped (Invalid/Missing)</div>
                  <div className="stat-value" style={{ color: 'var(--red-600)' }}>
                    {traceDetails.cleaning_report.dropped_missing_values +
                     traceDetails.cleaning_report.dropped_negative_submit +
                     traceDetails.cleaning_report.dropped_non_positive_runtime}
                  </div>
                  <div className="stat-sub">Non-pos RT / Neg submit / NaN</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Capped Outliers</div>
                  <div className="stat-value">{traceDetails.cleaning_report.capped_outliers}</div>
                  <div className="stat-sub">Capped at {traceDetails.cleaning_report.outlier_runtime_threshold}s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Cleaned Jobs Count</div>
                  <div className="stat-value" style={{ color: 'var(--green-600)' }}>
                    {traceDetails.cleaned_jobs_count}
                  </div>
                  <div className="stat-sub">Ready for sampling</div>
                </div>
              </div>

              {/* Steps log */}
              <details style={{ fontSize: '0.82rem', color: 'var(--navy-600)', cursor: 'pointer' }}>
                <summary style={{ fontWeight: 600 }}>View Cleaning Pipeline Audit Log</summary>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {traceDetails.cleaning_report.steps_log.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          {/* Workload Distribution Features */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">Empirical Trace Characteristics & Features</div>
            </div>
            <div className="card-body">
              <div className="grid-4">
                <div className="stat-card">
                  <div className="stat-label">Burst Mean & Median</div>
                  <div className="stat-value">{traceDetails.features.burst_mean}s</div>
                  <div className="stat-sub">Median: {traceDetails.features.burst_median}s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Burst Variability (CV)</div>
                  <div className="stat-value">{traceDetails.features.burst_cv}</div>
                  <div className="stat-sub">Skewness: {traceDetails.features.burst_skewness}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Heavy-Tail Index (Hill α)</div>
                  <div className="stat-value" style={{ color: traceDetails.features.heavy_tail_index < 2.0 ? 'var(--red-600)' : 'var(--blue-600)' }}>
                    {traceDetails.features.heavy_tail_index}
                  </div>
                  <div className="stat-sub">{traceDetails.features.heavy_tail_index < 2.0 ? 'Heavy-tailed bursts' : 'Light-tailed bursts'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Arrival Span & Burstiness</div>
                  <div className="stat-value">{traceDetails.features.burstiness}</div>
                  <div className="stat-sub">Span: {traceDetails.features.arrival_span}s | Mean IA: {traceDetails.features.mean_inter_arrival_time}s</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sampling & Simulator Dispatch */}
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {/* Sampling panel */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Reproducible Sampling to Simulation Ticks</div>
              </div>
              <div className="card-body">
                <div className="grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Sampling Method</label>
                    <select
                      className="form-input"
                      value={samplingMethod}
                      onChange={(e) => setSamplingMethod(e.target.value as any)}
                    >
                      <option value="random">Seeded Random Sampling (Preserves Arrival Order)</option>
                      <option value="time_window">Contiguous Time Window</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Process Count (N)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="5"
                      max="100"
                      value={sampleCount}
                      onChange={(e) => setSampleCount(parseInt(e.target.value) || 20)}
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Scale Factor (Seconds per Tick)</label>
                    <input
                      type="number"
                      className="form-input"
                      step="0.1"
                      min="0.1"
                      value={scaleFactor}
                      onChange={(e) => setScaleFactor(parseFloat(e.target.value) || 1.0)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Random Seed (Reproducibility)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={sampleSeed}
                      onChange={(e) => setSampleSeed(parseInt(e.target.value) || 42)}
                    />
                  </div>
                </div>

                {samplingMethod === 'time_window' && (
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Window Start Tick</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={windowStart}
                      onChange={(e) => setWindowStart(parseInt(e.target.value) || 0)}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={handleSampleWorkload} disabled={loading}>
                    <FlaskConical size={16} /> Sample Simulator Workload
                  </button>
                  <button className="btn btn-outline" onClick={handleCompareSynthetic} disabled={comparing}>
                    {comparing ? <RefreshCw className="spin" size={16} /> : <BarChart2 size={16} />} Calibrate Synthetic
                  </button>
                </div>
              </div>
            </div>

            {/* Sampling preview & Loss */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Sampling Result & Information Loss</div>
              </div>
              <div className="card-body">
                {sampleResult ? (
                  <div>
                    <div style={{ marginBottom: 12, padding: 10, background: 'var(--navy-50, #f8fafc)', borderRadius: 6, fontSize: '0.85rem' }}>
                      <strong>Discretization Loss:</strong> {sampleResult.scaling_loss.note}
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>
                      Sampled {sampleResult.processes.length} Processes:
                    </div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>PID</th>
                            <th>Arrival</th>
                            <th>Burst</th>
                            <th>Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sampleResult.processes.map((p) => (
                            <tr key={p.pid}>
                              <td>P{p.pid}</td>
                              <td>{p.arrival_time}</td>
                              <td>{p.burst_time}</td>
                              <td>{p.priority}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleSendToSimulator(sampleResult.processes)}
                      >
                        <Play size={16} /> Send to Simulator
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => handleSendToLaboratory(sampleResult.processes)}
                      >
                        <FlaskConical size={16} /> Send to Laboratory
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--navy-500)', fontSize: '0.9rem' }}>
                    Click &quot;Sample Simulator Workload&quot; to generate an integer-tick workload.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Distribution Comparison Card */}
          {comparisonResult && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div className="card-title">Kolmogorov–Smirnov & Wasserstein Distribution Fit</div>
                <span className="badge badge-purple">Grid Search Optimal Fit</span>
              </div>
              <div className="card-body">
                <div className="grid-4" style={{ marginBottom: 16 }}>
                  <div className="stat-card">
                    <div className="stat-label">Burst Wasserstein Distance</div>
                    <div className="stat-value">{comparisonResult.comparison_stats.burst_wasserstein}</div>
                    <div className="stat-sub">KS p-value: {comparisonResult.comparison_stats.burst_ks_pvalue}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Arrival Wasserstein Distance</div>
                    <div className="stat-value">{comparisonResult.comparison_stats.inter_arrival_wasserstein}</div>
                    <div className="stat-sub">KS p-value: {comparisonResult.comparison_stats.inter_arrival_ks_pvalue}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Composite Distance Score</div>
                    <div className="stat-value" style={{ color: 'var(--blue-600)' }}>
                      {comparisonResult.best_composite_distance}
                    </div>
                    <div className="stat-sub">Lower is closer fit</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Calibrated Model</div>
                    <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                      {comparisonResult.best_generator_params.burst_distribution}
                    </div>
                    <div className="stat-sub">
                      Arrivals: {comparisonResult.best_generator_params.arrival_distribution} (μ={comparisonResult.best_generator_params.mean_burst})
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSendToSimulator(comparisonResult.synthetic_processes)}
                  >
                    <Play size={16} /> Simulate Calibrated Synthetic Workload
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => onNavigate('experiments')}
                  >
                    <Layers size={16} /> Open in Experiment Studio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
