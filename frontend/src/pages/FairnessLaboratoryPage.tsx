import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { ProcessItem, CompareResponse, SimulationResponse, ObservationFairnessItem } from '../types';
import {
  Scale, Clock, RefreshCw, Info, CheckCircle,
  AlertCircle, ArrowRight, TrendingUp, Users, Play, HelpCircle
} from 'lucide-react';

interface FairnessLaboratoryProps {
  currentProcesses: ProcessItem[];
  onNavigate: (tab: string) => void;
}

export const FairnessLaboratoryPage: React.FC<FairnessLaboratoryProps> = ({
  currentProcesses,
  onNavigate
}) => {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [quantum, setQuantum] = useState<number>(2);
  const [observationTime, setObservationTime] = useState<number>(10);
  const [selectedAlgo, setSelectedAlgo] = useState<string>('RR');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const schedulersList = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'RR'];

  // Run full simulation comparison across all 5 schedulers
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

      // Determine appropriate default observation time (50% of makespan)
      const makespans = Object.values(res.results)
        .map(r => r?.metrics?.makespan || 0)
        .filter(m => m > 0);
      const maxMs = makespans.length > 0 ? Math.max(...makespans) : 20;
      setObservationTime(Math.max(1, Math.floor(maxMs / 2)));
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentProcesses.length > 0) {
      runComparison();
    }
  }, [quantum]);

  // Compute maximum makespan across all schedulers to bound observation time slider
  const maxMakespan = useMemo(() => {
    if (!data) return 50;
    const msList = Object.values(data.results).map(r => r?.metrics?.makespan || 0);
    return Math.max(...msList, 10);
  }, [data]);

  // Helper: compute per-process service received up to time T from an execution trace
  const computeServiceAtTime = (sim: SimulationResponse, T: number): Record<number, number> => {
    const serviceMap: Record<number, number> = {};
    for (const p of sim.processes) {
      serviceMap[p.pid] = 0;
    }
    if (!sim.trace) return serviceMap;

    for (const interval of sim.trace) {
      if (interval.is_idle || interval.pid < 0) continue;
      if (interval.start_time >= T) break;

      const effStart = interval.start_time;
      const effEnd = Math.min(interval.end_time, T);
      if (effEnd > effStart) {
        serviceMap[interval.pid] = (serviceMap[interval.pid] || 0) + (effEnd - effStart);
      }
    }
    return serviceMap;
  };

  // Helper: compute Jain's index from a list of values
  const computeJainsIndex = (values: number[]): { index: number; isDefined: boolean } => {
    const n = values.length;
    if (n === 0) return { index: 0, isDefined: false };
    const sum = values.reduce((acc, v) => acc + v, 0);
    if (sum === 0) return { index: 0, isDefined: false };
    const sumSq = values.reduce((acc, v) => acc + v * v, 0);
    if (sumSq === 0) return { index: 0, isDefined: false };
    return { index: (sum * sum) / (n * sumSq), isDefined: true };
  };

  // Compute dynamic fairness across all 5 schedulers at current observationTime T
  const dynamicFairnessAtT = useMemo(() => {
    if (!data) return {};

    const T = observationTime;
    const res: Record<string, {
      cpuFairness: number;
      progressFairness: number;
      isCpuDefined: boolean;
      isProgressDefined: boolean;
      arrivedCount: number;
      completedCount: number;
      perProcess: Array<{
        pid: number;
        arrival: number;
        demand: number;
        service: number;
        progress: number;
        remaining: number;
        status: string;
      }>;
    }> = {};

    for (const s of schedulersList) {
      const sim = data.results[s];
      if (!sim || !sim.processes) continue;

      const serviceMap = computeServiceAtTime(sim, T);
      const arrivedProcs = sim.processes.filter(p => p.arrival_time <= T);
      const nArrived = arrivedProcs.length;

      let completedCount = 0;
      const cpuVals: number[] = [];
      const progressVals: number[] = [];
      const procRows = [];

      for (const p of sim.processes) {
        const isArrived = p.arrival_time <= T;
        const srv = serviceMap[p.pid] || 0;
        const demand = p.burst_time;
        const progress = demand > 0 ? Math.min(srv / demand, 1.0) : 0;
        const remaining = Math.max(0, demand - srv);

        let status = 'Not Arrived';
        if (isArrived) {
          if (srv >= demand) {
            status = 'Completed';
            completedCount++;
          } else if (srv > 0) {
            status = 'In Progress';
          } else {
            status = 'Waiting';
          }
          cpuVals.push(srv);
          progressVals.push(progress);
        }

        procRows.push({
          pid: p.pid,
          arrival: p.arrival_time,
          demand,
          service: srv,
          progress,
          remaining,
          status
        });
      }

      const cpuJain = computeJainsIndex(cpuVals);
      const progJain = computeJainsIndex(progressVals);

      res[s] = {
        cpuFairness: cpuJain.index,
        progressFairness: progJain.index,
        isCpuDefined: cpuJain.isDefined,
        isProgressDefined: progJain.isDefined,
        arrivedCount: nArrived,
        completedCount,
        perProcess: procRows
      };
    }

    return res;
  }, [data, observationTime]);

  // Find best progress fairness at current observationTime
  const bestProgressAlgo = useMemo(() => {
    let topAlgo = 'RR';
    let topVal = -1;
    for (const s of schedulersList) {
      const val = dynamicFairnessAtT[s]?.progressFairness ?? -1;
      if (val > topVal) {
        topVal = val;
        topAlgo = s;
      }
    }
    return topAlgo;
  }, [dynamicFairnessAtT]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Fairness Laboratory: Dual Jain's Index Analysis
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Rigorous evaluation of Raw CPU Allocation Equality versus Demand-Relative Progress Equality at configurable observation windows.
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
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Re-simulate Workload
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-100)', color: 'var(--red-600)', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Observation Time Interactive Control Panel */}
      <div className="card" style={{ borderLeft: '4px solid var(--blue-600)' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="var(--blue-600)" />
              Observation Time Window Controller (T)
            </div>
            <div className="card-subtitle">
              Adjust the slider or pick a preset fraction of makespan to calculate runtime fairness from actual execution traces.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: '25% Makespan', frac: 0.25 },
              { label: '50% Makespan', frac: 0.50 },
              { label: '75% Makespan', frac: 0.75 },
              { label: '100% (Complete)', frac: 1.0 }
            ].map(preset => {
              const targetT = Math.max(1, Math.round(maxMakespan * preset.frac));
              return (
                <button
                  key={preset.label}
                  className={`btn btn-sm ${observationTime === targetT ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setObservationTime(targetT)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 0' }}>
          <div style={{ flex: 1 }}>
            <input
              type="range"
              min={1}
              max={maxMakespan}
              value={observationTime}
              onChange={e => setObservationTime(parseInt(e.target.value) || 1)}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--navy-500)', marginTop: 4 }}>
              <span>T = 1 tick (Early arrival)</span>
              <span>T = {Math.round(maxMakespan / 2)} ticks (Mid-run concurrency)</span>
              <span>T = {maxMakespan} ticks (Full makespan completion)</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', padding: '6px 14px', borderRadius: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Observation Time:</span>
            <input
              type="number"
              min={1}
              max={maxMakespan}
              value={observationTime}
              onChange={e => setObservationTime(Math.min(maxMakespan, Math.max(1, parseInt(e.target.value) || 1)))}
              className="form-control"
              style={{ width: 80, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--navy-600)' }}>ticks</span>
          </div>
        </div>

        {/* Population Status Indicator */}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
            <Users size={15} color="var(--blue-600)" />
            <span>Eligible Process Population: <strong>{dynamicFairnessAtT['FCFS']?.arrivedCount ?? 0} of {currentProcesses.length} processes arrived</strong> (Arrival Time &le; {observationTime})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--navy-600)' }}>
            <Info size={15} />
            <span>Same process population is strictly enforced across all five scheduling policies at time T.</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual Fairness Cards at Time T */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Side-by-Side Fairness Indices at T = {observationTime} ticks</div>
            <div className="card-subtitle">
              Comparing Raw CPU Allocation Fairness J(x) against Demand-Relative Progress Fairness J(F).
            </div>
          </div>
          <span className="badge badge-green">
            Top Progress Fairness: {bestProgressAlgo} (J = {dynamicFairnessAtT[bestProgressAlgo]?.progressFairness.toFixed(4)})
          </span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheduler</th>
                <th>Type</th>
                <th style={{ textAlign: 'center' }}>Raw CPU Fairness J(x)</th>
                <th style={{ textAlign: 'center' }}>Progress Fairness J(F)</th>
                <th style={{ textAlign: 'center' }}>Completed at T</th>
                <th>Fairness Behavior at T = {observationTime}</th>
              </tr>
            </thead>
            <tbody>
              {schedulersList.map(s => {
                const f = dynamicFairnessAtT[s];
                if (!f) return null;
                const isTop = s === bestProgressAlgo && f.progressFairness > 0;

                let behaviorDesc = '';
                if (f.arrivedCount === f.completedCount && f.arrivedCount > 0) {
                  behaviorDesc = 'All arrived processes completed; progress fairness reaches 1.0.';
                } else if (s === 'RR') {
                  behaviorDesc = 'Time-slicing continuously distributes CPU service, preserving high progress fairness.';
                } else if (s === 'SRTF') {
                  behaviorDesc = 'Prioritizes shortest remaining jobs, rapidly completing short tasks.';
                } else if (s === 'FCFS') {
                  behaviorDesc = 'Non-preemptive queue; waiting jobs receive 0 service during long bursts.';
                } else if (s === 'SJF') {
                  behaviorDesc = 'Non-preemptive shortest job execution; waiting tasks have 0 progress.';
                } else {
                  behaviorDesc = 'Priority-ordered dispatch without preemption.';
                }

                return (
                  <tr key={s} style={{ background: isTop ? 'var(--green-50)' : undefined }}>
                    <td>
                      <strong>{s}</strong> {s === 'RR' ? `(q=${quantum})` : ''}
                      {isTop && <span style={{ marginLeft: 6, color: 'var(--green-600)' }}>★ Top Fair</span>}
                    </td>
                    <td>
                      <span className={`badge ${s === 'RR' || s === 'SRTF' ? 'badge-blue' : 'badge-gray'}`}>
                        {s === 'RR' || s === 'SRTF' ? 'Preemptive' : 'Non-Preemptive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontWeight: 600 }}>
                          {f.isCpuDefined ? f.cpuFairness.toFixed(4) : 'Undefined'}
                        </span>
                        {f.isCpuDefined && (
                          <div style={{ width: 70, height: 4, background: 'var(--surface-secondary)', borderRadius: 2 }}>
                            <div style={{ width: `${Math.round(f.cpuFairness * 100)}%`, height: '100%', background: 'var(--navy-600)', borderRadius: 2 }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: isTop ? 'var(--green-700)' : 'var(--blue-700)' }}>
                          {f.isProgressDefined ? f.progressFairness.toFixed(4) : 'Undefined'}
                        </span>
                        {f.isProgressDefined && (
                          <div style={{ width: 70, height: 4, background: 'var(--surface-secondary)', borderRadius: 2 }}>
                            <div
                              style={{
                                width: `${Math.round(f.progressFairness * 100)}%`,
                                height: '100%',
                                background: isTop ? 'var(--green-600)' : 'var(--blue-600)',
                                borderRadius: 2
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-purple">
                        {f.completedCount} / {f.arrivedCount}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--navy-600)' }}>
                      {behaviorDesc}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process-Level Lifecycle Breakdown at Time T */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Process-Level Service & Progress Allocation at T = {observationTime} ticks</div>
            <div className="card-subtitle">
              Inspect how individual processes receive CPU cycles X_i(T) and advance toward their demand D_i.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {schedulersList.map(s => (
              <button
                key={s}
                className={`btn btn-sm ${selectedAlgo === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedAlgo(s)}
              >
                {s} {s === 'RR' ? `(q=${quantum})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Arrival Time</th>
                <th>Total Demand (D_i)</th>
                <th>Service Received up to T (X_i)</th>
                <th>Demand Progress F_i(T)</th>
                <th>Remaining Demand at T</th>
                <th>State at T = {observationTime}</th>
              </tr>
            </thead>
            <tbody>
              {dynamicFairnessAtT[selectedAlgo]?.perProcess.map(row => {
                const progPct = Math.round(row.progress * 100);
                let badgeClass = 'badge-gray';
                if (row.status === 'Completed') badgeClass = 'badge-green';
                else if (row.status === 'In Progress') badgeClass = 'badge-blue';
                else if (row.status === 'Waiting') badgeClass = 'badge-orange';

                return (
                  <tr key={row.pid} style={{ opacity: row.status === 'Not Arrived' ? 0.45 : 1 }}>
                    <td><strong>P{row.pid}</strong></td>
                    <td>{row.arrival} ticks</td>
                    <td>{row.demand} ticks</td>
                    <td style={{ fontWeight: 600 }}>{row.service} ticks</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--surface-secondary)', borderRadius: 3, minWidth: 60 }}>
                          <div
                            style={{
                              width: `${progPct}%`,
                              height: '100%',
                              background: row.progress >= 1 ? 'var(--green-600)' : 'var(--blue-600)',
                              borderRadius: 3
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, width: 40 }}>
                          {progPct}%
                        </span>
                      </div>
                    </td>
                    <td>{row.remaining} ticks</td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Theoretical Grounding & Formula Explanation Card */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">1. Raw CPU-Allocation Fairness: J_raw(t)</div>
          </div>
          <div style={{ padding: '4px 0', fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 10 }}>
              Calculates strict parity of raw CPU ticks received by active processes up to observation time <em>t</em>:
            </p>
            <div style={{ background: 'var(--surface-secondary)', padding: '10px 14px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>
              J_raw(t) = [ (&sum; X_i(t) )^2 ] / [ n &times; &sum; (X_i(t))^2 ]
            </div>
            <ul style={{ paddingLeft: 18, listStyleType: 'disc' }}>
              <li><strong>Equal Allocation:</strong> J_raw = 1.0 when every arrived process receives identical CPU time.</li>
              <li><strong>Limitation:</strong> In workloads with unequal burst lengths, a policy that serves all processes proportionally will have lower J_raw simply because process demands differ.</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">2. Demand-Relative Progress Fairness: J_progress(t)</div>
          </div>
          <div style={{ padding: '4px 0', fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 10 }}>
              Measures equitable fraction of completed demand, normalizing for heterogeneous job sizes:
            </p>
            <div style={{ background: 'var(--surface-secondary)', padding: '10px 14px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 600, marginBottom: 10, textAlign: 'center' }}>
              F_i(t) = min( X_i(t) / D_i, 1.0 ) &rarr; J_progress(t) = [ (&sum; F_i(t) )^2 ] / [ n &times; &sum; (F_i(t))^2 ]
            </div>
            <ul style={{ paddingLeft: 18, listStyleType: 'disc' }}>
              <li><strong>Equitable Progress:</strong> J_progress = 1.0 when all processes have achieved the same fractional completion.</li>
              <li><strong>Completion Principle:</strong> When all processes complete, F_i = 1.0 &forall; i, so J_progress = 1.0 for all schedulers. Runtime differences appear only at intermediate observation times.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
