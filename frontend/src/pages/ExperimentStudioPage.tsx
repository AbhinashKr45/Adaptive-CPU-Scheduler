import React, { useState } from 'react';
import { api } from '../services/api';
import { ExperimentItem } from '../types';
import {
  Layers, Play, Download, CheckCircle,
  AlertTriangle, RefreshCw, BarChart2
} from 'lucide-react';

interface ExperimentStudioProps {
  onNavigate: (tab: string) => void;
  onSelectExperimentForAnalytics?: (exp: ExperimentItem) => void;
}

export const ExperimentStudioPage: React.FC<ExperimentStudioProps> = ({
  onNavigate,
  onSelectExperimentForAnalytics
}) => {
  const [expName, setExpName] = useState('Comparative Scheduler Evaluation');
  const [expDesc, setExpDesc] = useState('Paired multi-seed benchmark evaluating 5 algorithms');
  const [selectedSchedulers, setSelectedSchedulers] = useState<string[]>(['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'RR']);
  const [seedsInput, setSeedsInput] = useState('42, 43, 44, 45, 46, 47, 48, 49');
  const [processCount, setProcessCount] = useState<number>(10);
  const [meanBurst, setMeanBurst] = useState<number>(10);
  const [burstStd, setBurstStd] = useState<number>(5);
  const [burstDist, setBurstDist] = useState<string>('normal');
  const [arrivalDist, setArrivalDist] = useState<string>('uniform');
  const [skewLevel, setSkewLevel] = useState<string>('medium');
  const [rrQuantum, setRrQuantum] = useState<number>(2);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentExperiment, setCurrentExperiment] = useState<ExperimentItem | null>(null);

  const parsedSeeds = seedsInput
    .split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));

  const estimatedRuns = selectedSchedulers.length * parsedSeeds.length;

  const toggleScheduler = (s: string) => {
    if (selectedSchedulers.includes(s)) {
      if (selectedSchedulers.length > 1) {
        setSelectedSchedulers(selectedSchedulers.filter(item => item !== s));
      }
    } else {
      setSelectedSchedulers([...selectedSchedulers, s]);
    }
  };

  const handleLaunchExperiment = async () => {
    if (parsedSeeds.length === 0) {
      setError('Please provide at least one valid integer seed.');
      return;
    }
    if (selectedSchedulers.length === 0) {
      setError('Please select at least one scheduling algorithm.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const expRes = await api.runExperiment({
        name: expName,
        description: expDesc,
        schedulers: selectedSchedulers,
        seeds: parsedSeeds,
        workload_config: {
          process_count: processCount,
          mean_burst: meanBurst,
          burst_std: burstStd,
          burst_distribution: burstDist,
          arrival_distribution: arrivalDist,
          skew_level: skewLevel
        },
        rr_quantum: rrQuantum
      });
      setCurrentExperiment(expRes);
      if (onSelectExperimentForAnalytics) {
        onSelectExperimentForAnalytics(expRes);
      }
    } catch (err: any) {
      setError(err.message || 'Experiment execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Experiment Studio
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Configure and run paired multi-seed batch experiment matrices with automated statistical hypothesis testing.
          </p>
        </div>

        {currentExperiment && (
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={api.getExperimentCsvUrl(currentExperiment.id)}
              className="btn btn-secondary"
              download
            >
              <Download size={14} /> Export CSV
            </a>
            <a
              href={api.getExperimentJsonUrl(currentExperiment.id)}
              className="btn btn-secondary"
              download
            >
              <Download size={14} /> Export JSON
            </a>
            <button
              className="btn btn-accent"
              onClick={() => onNavigate('analytics')}
            >
              <BarChart2 size={16} /> View Research Analytics
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-100)', color: 'var(--red-600)', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Configuration Matrix */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">1. Experiment Parameters</div>
          </div>

          <div className="form-group">
            <label className="form-label">Experiment Name</label>
            <input
              type="text"
              className="form-control"
              value={expName}
              onChange={e => setExpName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Schedulers to Benchmark</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'RR'].map(s => {
                const isSelected = selectedSchedulers.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleScheduler(s)}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Random Seeds (Comma-separated for paired replication)</label>
            <input
              type="text"
              className="form-control"
              value={seedsInput}
              onChange={e => setSeedsInput(e.target.value)}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)', marginTop: 4 }}>
              Active seeds: {parsedSeeds.length} distinct workloads evaluated across each scheduler.
            </div>
          </div>

          {selectedSchedulers.includes('RR') && (
            <div className="form-group">
              <label className="form-label">Round Robin Quantum</label>
              <input
                type="number"
                min={1}
                max={20}
                className="form-control"
                value={rrQuantum}
                onChange={e => setRrQuantum(parseInt(e.target.value) || 2)}
              />
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">2. Workload Matrix Profile</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Process Count (N)</label>
              <input
                type="number"
                min={2}
                max={200}
                className="form-control"
                value={processCount}
                onChange={e => setProcessCount(parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Burst Distribution</label>
              <select className="form-control" value={burstDist} onChange={e => setBurstDist(e.target.value)}>
                <option value="normal">Normal (Gaussian)</option>
                <option value="exponential">Exponential (Short-Heavy)</option>
                <option value="pareto">Pareto (Right-Skewed)</option>
                <option value="uniform">Uniform</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mean Burst (μ)</label>
              <input
                type="number"
                min={1}
                className="form-control"
                value={meanBurst}
                onChange={e => setMeanBurst(parseFloat(e.target.value) || 10)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Burst Std Dev (σ)</label>
              <input
                type="number"
                min={0.5}
                className="form-control"
                value={burstStd}
                onChange={e => setBurstStd(parseFloat(e.target.value) || 5)}
              />
            </div>
          </div>

          {/* Matrix Estimation Summary */}
          <div style={{ background: 'var(--surface-secondary)', padding: 14, borderRadius: 8, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--navy-600)' }}>Estimated Matrix Executions:</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--blue-600)' }}>
                  {estimatedRuns} simulation runs
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleLaunchExperiment}
                disabled={loading || estimatedRuns === 0}
              >
                <Play size={16} /> Launch Experiment Matrix
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Experiment Results Table */}
      {currentExperiment && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Batch Summary Statistics ({currentExperiment.name})</div>
              <div className="card-subtitle">
                {currentExperiment.seeds.length} seeds × {currentExperiment.schedulers.length} policies = {currentExperiment.seeds.length * currentExperiment.schedulers.length} total C executions
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheduler</th>
                  <th>Avg Waiting (Mean ± CI)</th>
                  <th>Avg Turnaround (Mean ± CI)</th>
                  <th>Avg Response (Mean ± CI)</th>
                  <th>Throughput (Mean)</th>
                  <th>Jain's CPU Fairness</th>
                  <th>Progress Fairness</th>
                </tr>
              </thead>
              <tbody>
                {currentExperiment.schedulers.map(s => {
                  const sStats = currentExperiment.summary[s];
                  if (!sStats) return null;

                  const wait = sStats['avg_waiting_time'];
                  const tat = sStats['avg_turnaround_time'];
                  const resp = sStats['avg_response_time'];
                  const tp = sStats['throughput'];
                  const jainCpu = sStats['jain_fairness_cpu'];
                  const jainProg = sStats['jain_fairness_progress'];

                  return (
                    <tr key={s}>
                      <td><span className="badge badge-blue">{s}</span></td>
                      <td>
                        <strong>{wait?.mean.toFixed(2)}</strong> ± {(wait?.ci_high - wait?.mean).toFixed(2)}
                        <div style={{ fontSize: '0.7rem', color: 'var(--navy-500)' }}>[{wait?.ci_low.toFixed(2)}, {wait?.ci_high.toFixed(2)}]</div>
                      </td>
                      <td>
                        <strong>{tat?.mean.toFixed(2)}</strong> ± {(tat?.ci_high - tat?.mean).toFixed(2)}
                      </td>
                      <td>
                        <strong>{resp?.mean.toFixed(2)}</strong> ± {(resp?.ci_high - resp?.mean).toFixed(2)}
                      </td>
                      <td>{tp?.mean.toFixed(4)}</td>
                      <td>{jainCpu?.mean.toFixed(4)}</td>
                      <td>{jainProg?.mean.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
