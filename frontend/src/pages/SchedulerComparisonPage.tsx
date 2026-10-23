import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ProcessItem, CompareResponse, SimulationResponse } from '../types';
import { GanttChart } from '../components/GanttChart';
import {
  BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight,
  Eye, CheckCircle, AlertCircle
} from 'lucide-react';

interface SchedulerComparisonProps {
  currentProcesses: ProcessItem[];
  onNavigate: (tab: string) => void;
}

export const SchedulerComparisonPage: React.FC<SchedulerComparisonProps> = ({
  currentProcesses,
  onNavigate
}) => {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [quantum, setQuantum] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectAlgo, setInspectAlgo] = useState<string | null>(null);

  const runComparison = async () => {
    if (currentProcesses.length === 0) {
      setError('No processes loaded. Please configure processes in the Workload Laboratory.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.compareSchedulers(currentProcesses, quantum);
      setData(res);
      if (!inspectAlgo && Object.keys(res.results).length > 0) {
        setInspectAlgo(Object.keys(res.results)[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentProcesses.length > 0) {
      runComparison();
    }
  }, [quantum]);

  const schedulersList = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'RR'];

  // Metric definitions explaining directionality
  const metricSpecs = [
    { key: 'avg_waiting_time', label: 'Avg Waiting Time', unit: 'ticks', direction: 'lower', desc: 'Lower is better. Total time waiting in ready queue.' },
    { key: 'avg_turnaround_time', label: 'Avg Turnaround', unit: 'ticks', direction: 'lower', desc: 'Lower is better. Total elapsed time from arrival to completion.' },
    { key: 'avg_response_time', label: 'Avg Response Time', unit: 'ticks', direction: 'lower', desc: 'Lower is better. Delay until first CPU dispatch.' },
    { key: 'throughput', label: 'Throughput', unit: 'proc/tick', direction: 'higher', desc: 'Higher is better. Completed processes per unit time.' },
    { key: 'cpu_utilization', label: 'CPU Utilization', unit: '%', direction: 'higher', desc: 'Higher is better. Percentage of time CPU was busy.' },
    { key: 'context_switches', label: 'Context Switches', unit: 'count', direction: 'lower', desc: 'Lower is better. Overhead penalty of switching tasks.' },
    { key: 'jain_fairness_cpu', label: "Jain's CPU Fairness", unit: 'index', direction: 'higher', desc: "Higher is better (max 1.0). Equality of raw CPU service." },
    { key: 'jain_fairness_progress', label: 'Progress Fairness', unit: 'index', direction: 'higher', desc: 'Higher is better (max 1.0). Demand-relative progress equality.' },
    { key: 'starvation_ratio', label: 'Starvation Ratio', unit: 'ratio', direction: 'lower', desc: 'Lower is better (1.0 = ideal). Max Wait / Avg Wait disparity.' }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Scheduler Comparison Matrix
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Direct paired evaluation of all five scheduling policies on the identical workload.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>RR Quantum:</label>
            <input
              type="number"
              min={1}
              max={20}
              className="form-control"
              style={{ width: 70, padding: '4px 6px' }}
              value={quantum}
              onChange={e => setQuantum(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <button className="btn btn-primary" onClick={runComparison} disabled={loading || currentProcesses.length === 0}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Re-run Comparison
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-100)', color: 'var(--red-600)', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Comparison Master Table */}
      {data && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Side-by-Side Performance Dimensions</div>
            <span className="badge badge-blue">Evaluated on {currentProcesses.length} processes</span>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Performance Dimension</th>
                  <th>Direction</th>
                  {schedulersList.map(s => (
                    <th key={s} style={{ textAlign: 'center' }}>
                      {s} {s === 'RR' ? `(q=${quantum})` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricSpecs.map(m => {
                  const isHigherBetter = m.direction === 'higher';
                  // Find best value among schedulers
                  const values = schedulersList.map(s => {
                    const res = data.results[s];
                    return res && res.metrics ? (res.metrics as any)[m.key] : null;
                  }).filter(v => v !== null && typeof v === 'number');

                  const bestVal = values.length > 0 ? (isHigherBetter ? Math.max(...values) : Math.min(...values)) : null;

                  return (
                    <tr key={m.key}>
                      <td>
                        <strong>{m.label}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--navy-500)' }}>{m.desc}</div>
                      </td>
                      <td>
                        {isHigherBetter ? (
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <ArrowUpRight size={11} /> Higher is better
                          </span>
                        ) : (
                          <span className="badge badge-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <ArrowDownRight size={11} /> Lower is better
                          </span>
                        )}
                      </td>
                      {schedulersList.map(s => {
                        const res = data.results[s];
                        const val = res && res.metrics ? (res.metrics as any)[m.key] : null;
                        const isBest = val !== null && bestVal !== null && Math.abs(val - bestVal) < 1e-4;

                        let displayVal = '-';
                        if (val !== null && typeof val === 'number') {
                          if (m.key === 'cpu_utilization') displayVal = `${(val * 100).toFixed(1)}%`;
                          else if (m.key === 'throughput') displayVal = val.toFixed(4);
                          else if (m.key.startsWith('jain')) displayVal = val.toFixed(4);
                          else if (Number.isInteger(val)) displayVal = val.toString();
                          else displayVal = val.toFixed(2);
                        }

                        return (
                          <td key={s} style={{ textAlign: 'center', background: isBest ? 'var(--blue-50)' : undefined }}>
                            <span style={{ fontWeight: isBest ? 700 : 500, color: isBest ? 'var(--blue-700)' : undefined }}>
                              {displayVal}
                            </span>
                            {isBest && <span style={{ marginLeft: 4, color: 'var(--blue-600)' }}>★</span>}
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

      {/* Observation-Time Fairness Trajectory */}
      {data && (() => {
        const obsList = Object.values(data.results).find(r => r.observation_fairness && r.observation_fairness.length > 0)?.observation_fairness;
        if (!obsList || obsList.length === 0) return null;

        return (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Observation-Time Fairness Trajectory (Runtime Progress Equality)</div>
                <div className="card-subtitle">
                  Calculates Jain's progress fairness J(F) at intermediate execution times T from actual execution traces.
                </div>
              </div>
              <span className="badge badge-purple">{obsList.length} Observation Windows</span>
            </div>

            <div style={{ padding: '10px 16px', background: 'var(--blue-50)', borderRadius: 6, marginBottom: 14, fontSize: '0.82rem', color: 'var(--navy-800)', borderLeft: '3px solid var(--blue-600)' }}>
              <strong>Research Note:</strong> Fully completed workloads generally reach demand-relative progress fairness of 1.0 (since all processes finish their burst).
              Intermediate observation points reveal which schedulers maintain concurrent progress fairness during execution versus non-preemptive policies that hold jobs in waiting state with zero progress.
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Observation Time (T)</th>
                    <th>Arrived / Completed</th>
                    {schedulersList.map(s => (
                      <th key={s} style={{ textAlign: 'center' }}>
                        {s} J(F) Progress
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {obsList.map((obs, idx) => {
                    const t = obs.observation_time;

                    // Collect values across schedulers for this observation point
                    const sVals = schedulersList.map(s => {
                      const otf = data.results[s]?.observation_fairness?.[idx];
                      return otf ? otf.jain_fairness_progress : null;
                    });
                    const maxVal = Math.max(...sVals.filter((v): v is number => v !== null));

                    return (
                      <tr key={t}>
                        <td>
                          <strong>T = {t} ticks</strong>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--navy-600)' }}>
                          {obs.processes_arrived} arrived, {obs.processes_completed} done
                        </td>
                        {schedulersList.map((s, sIdx) => {
                          const val = sVals[sIdx];
                          const isTop = val !== null && Math.abs(val - maxVal) < 1e-4 && val > 0;

                          return (
                            <td key={s} style={{ textAlign: 'center', background: isTop ? 'var(--green-50)' : undefined }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span style={{ fontWeight: isTop ? 700 : 500, color: isTop ? 'var(--green-700)' : undefined }}>
                                  {val !== null ? val.toFixed(4) : '-'}
                                  {isTop && <span style={{ marginLeft: 3, color: 'var(--green-600)' }}>★</span>}
                                </span>
                                {val !== null && (
                                  <div style={{ width: 60, height: 4, background: 'var(--surface-secondary)', borderRadius: 2 }}>
                                    <div
                                      style={{
                                        width: `${Math.round(val * 100)}%`,
                                        height: '100%',
                                        background: isTop ? 'var(--green-600)' : 'var(--navy-400)',
                                        borderRadius: 2
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
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
        );
      })()}

      {/* Gantt Inspection of Selected Policy */}
      {data && inspectAlgo && data.results[inspectAlgo] && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Eye size={18} /> Inspect Execution Trace: {inspectAlgo}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {schedulersList.map(s => (
                <button
                  key={s}
                  className={`btn btn-sm ${inspectAlgo === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setInspectAlgo(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <GanttChart
            trace={data.results[inspectAlgo].trace}
            makespan={data.results[inspectAlgo].metrics.makespan}
          />
        </div>
      )}
    </div>
  );
};
