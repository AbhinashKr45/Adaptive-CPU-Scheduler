import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ProcessItem, PresetConfig, WorkloadResponse } from '../types';
import {
  Plus, Trash2, Save, Download, Upload, Play,
  BarChart2, RefreshCw, Sparkles, Check, AlertTriangle
} from 'lucide-react';

interface WorkloadLaboratoryProps {
  currentProcesses: ProcessItem[];
  setCurrentProcesses: (procs: ProcessItem[]) => void;
  onNavigate: (tab: string) => void;
}

export const WorkloadLaboratoryPage: React.FC<WorkloadLaboratoryProps> = ({
  currentProcesses,
  setCurrentProcesses,
  onNavigate
}) => {
  const [presets, setPresets] = useState<PresetConfig[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('balanced');
  const [savedWorkloads, setSavedWorkloads] = useState<WorkloadResponse[]>([]);

  // Generator parameters
  const [processCount, setProcessCount] = useState<number>(10);
  const [seed, setSeed] = useState<number>(42);
  const [arrivalDist, setArrivalDist] = useState<string>('uniform');
  const [burstDist, setBurstDist] = useState<string>('normal');
  const [meanBurst, setMeanBurst] = useState<number>(10);
  const [burstStd, setBurstStd] = useState<number>(4);
  const [skewLevel, setSkewLevel] = useState<string>('medium');
  const [maxArrival, setMaxArrival] = useState<number>(20);

  // Workload persistence
  const [workloadName, setWorkloadName] = useState<string>('Generated Workload');
  const [workloadDesc, setWorkloadDesc] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // New process input
  const [newPid, setNewPid] = useState<number>(1);
  const [newArrival, setNewArrival] = useState<number>(0);
  const [newBurst, setNewBurst] = useState<number>(5);
  const [newPriority, setNewPriority] = useState<number>(1);

  useEffect(() => {
    loadPresetsAndWorkloads();
  }, []);

  useEffect(() => {
    if (currentProcesses.length > 0) {
      const maxExistingPid = Math.max(...currentProcesses.map(p => p.pid), 0);
      setNewPid(maxExistingPid + 1);
    } else {
      setNewPid(1);
    }
  }, [currentProcesses]);

  const loadPresetsAndWorkloads = async () => {
    try {
      const [presetsData, wlsData] = await Promise.all([
        api.getPresets(),
        api.listWorkloads()
      ]);
      setPresets(presetsData);
      setSavedWorkloads(wlsData);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleGeneratePreset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.generatePreset(selectedPreset, processCount, seed);
      setCurrentProcesses(res.processes);
      setWorkloadName(`Preset: ${selectedPreset} (N=${processCount}, Seed=${seed})`);
    } catch (e: any) {
      setError(e.message || 'Failed to generate preset workload');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCustom = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.generateCustomWorkload({
        process_count: processCount,
        seed: seed,
        arrival_distribution: arrivalDist,
        burst_distribution: burstDist,
        mean_burst: meanBurst,
        burst_std: burstStd,
        skew_level: skewLevel,
        max_arrival: maxArrival,
        priority_distribution: 'uniform'
      });
      setCurrentProcesses(res.processes);
      setWorkloadName(`Custom: ${burstDist} burst (N=${processCount}, Seed=${seed})`);
    } catch (e: any) {
      setError(e.message || 'Failed to generate custom workload');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProcess = () => {
    if (newPid <= 0 || newBurst <= 0 || newArrival < 0) {
      setError('Invalid process values: PID and Burst must be > 0, Arrival >= 0.');
      return;
    }
    if (currentProcesses.some(p => p.pid === newPid)) {
      setError(`Process with PID ${newPid} already exists. Process IDs must be unique.`);
      return;
    }
    setError(null);
    const updated = [
      ...currentProcesses,
      { pid: newPid, arrival_time: newArrival, burst_time: newBurst, priority: newPriority }
    ].sort((a, b) => a.arrival_time - b.arrival_time || a.pid - b.pid);

    setCurrentProcesses(updated);
  };

  const handleRemoveProcess = (pid: number) => {
    setCurrentProcesses(currentProcesses.filter(p => p.pid !== pid));
  };

  const handleProcessChange = (index: number, field: keyof ProcessItem, value: number) => {
    const updated = [...currentProcesses];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentProcesses(updated);
  };

  const handleSaveToDb = async () => {
    if (currentProcesses.length === 0) {
      setError('Cannot save empty workload.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.createWorkload({
        name: workloadName || 'Saved Workload',
        description: workloadDesc,
        processes: currentProcesses,
        generator_config: { seed, processCount, arrivalDist, burstDist }
      });
      setSaveSuccess('Workload successfully saved to database!');
      setTimeout(() => setSaveSuccess(null), 3000);
      loadPresetsAndWorkloads();
    } catch (e: any) {
      setError(e.message || 'Failed to save workload');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSaved = (wl: WorkloadResponse) => {
    setCurrentProcesses(wl.processes);
    setWorkloadName(wl.name);
    setWorkloadDesc(wl.description || '');
  };

  const handleDeleteSaved = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteWorkload(id);
      setSavedWorkloads(savedWorkloads.filter(w => w.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete workload');
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProcesses, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${workloadName.replace(/\s+/g, '_')}.json`);
    dlAnchorElem.click();
  };

  const handleExportCsv = () => {
    let csvContent = "pid,arrival_time,burst_time,priority\n";
    currentProcesses.forEach(p => {
      csvContent += `${p.pid},${p.arrival_time},${p.burst_time},${p.priority}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${workloadName.replace(/\s+/g, '_')}.csv`);
    link.click();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setCurrentProcesses(parsed);
          setWorkloadName(file.name.replace(/\.[^/.]+$/, ""));
          setError(null);
        } else if (parsed.processes && Array.isArray(parsed.processes)) {
          setCurrentProcesses(parsed.processes);
          setWorkloadName(parsed.name || file.name.replace(/\.[^/.]+$/, ""));
          setError(null);
        } else {
          setError("Invalid JSON format. Expected process array.");
        }
      } catch (err) {
        setError("Error parsing JSON file.");
      }
    };
    reader.readAsText(file);
  };

  // Empirical workload characteristics
  const bursts = currentProcesses.map(p => p.burst_time);
  const meanB = bursts.length > 0 ? bursts.reduce((a, b) => a + b, 0) / bursts.length : 0;
  const variance = bursts.length > 1 ? bursts.reduce((acc, b) => acc + Math.pow(b - meanB, 2), 0) / bursts.length : 0;
  const stdB = Math.sqrt(variance);
  const cvB = meanB > 0 ? (stdB / meanB) : 0;

  // Validation
  const hasDuplicatePids = new Set(currentProcesses.map(p => p.pid)).size !== currentProcesses.length;
  const hasInvalidBursts = currentProcesses.some(p => p.burst_time <= 0);
  const hasNegativeArrivals = currentProcesses.some(p => p.arrival_time < 0);
  const isWorkloadValid = currentProcesses.length > 0 && !hasDuplicatePids && !hasInvalidBursts && !hasNegativeArrivals;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Workload Laboratory
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Create, configure, synthesize, import, and persist CPU workloads with statistical controls.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => onNavigate('simulator')}
            disabled={!isWorkloadValid}
          >
            <Play size={16} /> Open in Simulator
          </button>
          <button
            className="btn btn-accent"
            onClick={() => onNavigate('comparison')}
            disabled={!isWorkloadValid}
          >
            <BarChart2 size={16} /> Compare All Schedulers
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-100)', color: 'var(--red-600)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div style={{ padding: 12, background: 'var(--green-100)', color: 'var(--green-600)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={18} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Generation & Presets Controls */}
      <div className="grid-2">
        {/* Preset Selector */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Research Workload Presets</div>
            <span className="badge badge-blue">Standardized</span>
          </div>

          <div className="form-group">
            <label className="form-label">Select Predefined Preset</label>
            <select
              className="form-control"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
            >
              {presets.map(p => (
                <option key={p.key} value={p.key}>{p.name}</option>
              ))}
            </select>
            {presets.find(p => p.key === selectedPreset) && (
              <p style={{ fontSize: '0.78rem', color: 'var(--navy-500)', marginTop: 6 }}>
                {presets.find(p => p.key === selectedPreset)?.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Process Count (N)</label>
              <input
                type="number"
                className="form-control"
                min={1}
                max={500}
                value={processCount}
                onChange={(e) => setProcessCount(parseInt(e.target.value) || 10)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Random Seed</label>
              <input
                type="number"
                className="form-control"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleGeneratePreset} disabled={loading} style={{ width: '100%' }}>
            <Sparkles size={16} /> Generate Preset Workload
          </button>
        </div>

        {/* Custom Synthesizer */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Statistical Workload Synthesizer</div>
            <span className="badge badge-purple">Parametric</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Arrival Pattern</label>
              <select className="form-control" value={arrivalDist} onChange={e => setArrivalDist(e.target.value)}>
                <option value="uniform">Uniform Random</option>
                <option value="staggered">Staggered (Linear)</option>
                <option value="bursty">Bursty / Clustered</option>
                <option value="simultaneous">Simultaneous (t=0)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Burst Distribution</label>
              <select className="form-control" value={burstDist} onChange={e => setBurstDist(e.target.value)}>
                <option value="normal">Normal (Gaussian)</option>
                <option value="exponential">Exponential (Short-Heavy)</option>
                <option value="pareto">Pareto (Right-Skewed)</option>
                <option value="uniform">Uniform Bounded</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Mean Burst (μ)</label>
              <input type="number" className="form-control" min={1} value={meanBurst} onChange={e => setMeanBurst(parseFloat(e.target.value) || 10)} />
            </div>

            <div className="form-group">
              <label className="form-label">Burst Std Dev (σ)</label>
              <input type="number" className="form-control" min={0.5} step={0.5} value={burstStd} onChange={e => setBurstStd(parseFloat(e.target.value) || 4)} />
            </div>
          </div>

          <button className="btn btn-secondary" onClick={handleGenerateCustom} disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            <RefreshCw size={16} /> Synthesize Workload with Parameters
          </button>
        </div>
      </div>

      {/* Live Characteristics Banner */}
      <div className="card" style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-600)' }}>CURRENT WORKLOAD CHARACTERISTICS</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', marginTop: 2 }}>
              {workloadName} ({currentProcesses.length} processes)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--navy-500)', textTransform: 'uppercase' }}>Mean Burst</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{meanB.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--navy-500)', textTransform: 'uppercase' }}>Std Dev (σ)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stdB.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--navy-500)', textTransform: 'uppercase' }}>Variability (CV)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: cvB > 1.0 ? 'var(--orange-600)' : 'var(--blue-600)' }}>
                {cvB.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Process Table & Editor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Process Definitions ({currentProcesses.length})</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportJson}>
              <Download size={14} /> Export JSON
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
              <Download size={14} /> Export CSV
            </button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Import File
              <input type="file" accept=".json,.csv" onChange={handleImportJson} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Manual Process Adder Form */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, padding: 12, background: 'var(--surface-secondary)', borderRadius: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>PID</label>
            <input type="number" className="form-control" value={newPid} onChange={e => setNewPid(parseInt(e.target.value) || 1)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Arrival Time</label>
            <input type="number" className="form-control" min={0} value={newArrival} onChange={e => setNewArrival(parseInt(e.target.value) || 0)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Burst Time</label>
            <input type="number" className="form-control" min={1} value={newBurst} onChange={e => setNewBurst(parseInt(e.target.value) || 1)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Priority (Lower=Higher)</label>
            <input type="number" className="form-control" min={1} value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value) || 1)} />
          </div>
          <button className="btn btn-primary" onClick={handleAddProcess}>
            <Plus size={16} /> Add Process
          </button>
        </div>

        {/* Process List Table */}
        {currentProcesses.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PID</th>
                  <th>Arrival Time</th>
                  <th>CPU Burst</th>
                  <th>Priority</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentProcesses.map((p, idx) => (
                  <tr key={idx}>
                    <td><strong>P{p.pid}</strong></td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 80, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                        value={p.arrival_time}
                        onChange={e => handleProcessChange(idx, 'arrival_time', parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 80, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                        value={p.burst_time}
                        onChange={e => handleProcessChange(idx, 'burst_time', parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 80, padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }}
                        value={p.priority}
                        onChange={e => handleProcessChange(idx, 'priority', parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemoveProcess(p.pid)}
                        title="Delete process"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No processes in workload. Add a process or generate from a preset.</div>
        )}

        {/* Save Workload Bar */}
        <div style={{ display: 'flex', gap: 12, marginTop: 18, alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Workload Name"
            value={workloadName}
            onChange={e => setWorkloadName(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <button className="btn btn-primary" onClick={handleSaveToDb} disabled={loading || !isWorkloadValid}>
            <Save size={16} /> Save Workload to Database
          </button>
        </div>
      </div>

      {/* Saved Workloads Gallery */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Saved Workloads Gallery ({savedWorkloads.length})</div>
        </div>
        {savedWorkloads.length > 0 ? (
          <div className="grid-3">
            {savedWorkloads.map(w => (
              <div
                key={w.id}
                className="stat-card"
                style={{ cursor: 'pointer', border: '1px solid var(--border)' }}
                onClick={() => handleLoadSaved(w)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{w.name}</div>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ padding: '2px 6px' }}
                    onClick={(e) => handleDeleteSaved(w.id, e)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--navy-500)', marginTop: 4 }}>
                  {w.process_count} processes | Mean burst: {w.characteristics.mean_burst} | CV: {w.characteristics.cv_burst}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No saved workloads in database yet. Save one above!</div>
        )}
      </div>
    </div>
  );
};
