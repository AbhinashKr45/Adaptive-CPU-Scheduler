import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ProcessItem, SimulationResponse } from '../types';
import { GanttChart } from '../components/GanttChart';
import { MetricsCards } from '../components/MetricsCards';
import { ProcessTable } from '../components/ProcessTable';
import {
  Play, RefreshCw, BarChart2, Layers,
  Clock, AlertCircle, CheckCircle
} from 'lucide-react';

interface SchedulerSimulatorProps {
  currentProcesses: ProcessItem[];
  onNavigate: (tab: string) => void;
}

export const SchedulerSimulatorPage: React.FC<SchedulerSimulatorProps> = ({
  currentProcesses,
  onNavigate
}) => {
  const [algorithm, setAlgorithm] = useState<string>('FCFS');
  const [quantum, setQuantum] = useState<number>(2);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const algorithms = [
    { id: 'FCFS', name: 'First-Come, First-Served', preemptive: false, desc: 'Non-preemptive queue ordered strictly by earliest arrival time.' },
    { id: 'SJF', name: 'Shortest Job First', preemptive: false, desc: 'Non-preemptive policy selecting the eligible job with minimal CPU burst.' },
    { id: 'SRTF', name: 'Shortest Remaining Time First', preemptive: true, desc: 'Preemptive policy dynamically running the job with shortest remaining time.' },
    { id: 'PRIORITY', name: 'Priority Scheduling', preemptive: false, desc: 'Non-preemptive policy selecting highest priority (lowest numerical value).' },
    { id: 'RR', name: 'Round Robin', preemptive: true, desc: 'Preemptive time-sliced circular FIFO queue with configurable time quantum.' }
  ];

  const handleRunSimulation = async () => {
    if (currentProcesses.length === 0) {
      setError('No processes loaded. Please configure processes in the Workload Laboratory.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.runSimulation({
        algorithm,
        quantum,
        processes: currentProcesses,
        workload_name: `${algorithm} Simulation`
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation execution failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentProcesses.length > 0 && !result) {
      handleRunSimulation();
    }
  }, [algorithm, quantum]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Scheduler Simulator
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Direct interactive execution on the authoritative single-CPU C scheduling engine.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('laboratory')}>
            Edit Workload ({currentProcesses.length} procs)
          </button>
          <button className="btn btn-accent" onClick={() => onNavigate('comparison')}>
            <BarChart2 size={16} /> Compare All Schedulers
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-100)', color: 'var(--red-600)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Scheduler Selection & Parameters Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Select Scheduling Algorithm</div>
          {algorithm === 'RR' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Quantum (q):</label>
              <input
                type="number"
                min={1}
                max={50}
                className="form-control"
                style={{ width: 80, padding: '4px 8px' }}
                value={quantum}
                onChange={e => setQuantum(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          {algorithms.map(algo => {
            const isSelected = algorithm === algo.id;
            return (
              <div
                key={algo.id}
                onClick={() => setAlgorithm(algo.id)}
                style={{
                  border: isSelected ? '2px solid var(--blue-600)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--blue-50)' : 'var(--surface)',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isSelected ? 'var(--blue-600)' : 'var(--navy-900)' }}>
                    {algo.id}
                  </span>
                  <span className={`badge ${algo.preemptive ? 'badge-orange' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>
                    {algo.preemptive ? 'Preemptive' : 'Non-Preempt'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--navy-600)', marginTop: 6, lineHeight: 1.3 }}>
                  {algo.desc}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--navy-600)' }}>
            Workload: <strong>{currentProcesses.length} processes</strong> ready for simulation.
          </div>
          <button className="btn btn-primary" onClick={handleRunSimulation} disabled={loading || currentProcesses.length === 0}>
            <Play size={16} /> Run {algorithm} Simulation
          </button>
        </div>
      </div>

      {/* Results View */}
      {result && (
        <>
          {/* Aggregate Performance Cards */}
          <MetricsCards metrics={result.metrics} />

          {/* Interactive Gantt Chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={18} /> Interactive Execution Gantt Chart
              </div>
              <span className="badge badge-green">
                Makespan: {result.metrics.makespan} units | Total Busy: {result.metrics.total_busy_time} units
              </span>
            </div>
            <GanttChart trace={result.trace} makespan={result.metrics.makespan} />
          </div>

          {/* Per-Process Metrics Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Process Execution Lifecycles & Metrics</div>
            </div>
            <ProcessTable processes={result.processes} />
          </div>
        </>
      )}
    </div>
  );
};
