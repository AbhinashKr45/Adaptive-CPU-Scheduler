import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { OverviewData } from '../types';
import {
  FlaskConical, Play, BarChart2, Layers,
  CheckCircle, ArrowRight, RefreshCw, Cpu
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (tab: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load system overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <div>
      {/* Hero Banner & Purpose Section */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 100%)', color: '#fff', border: 'none', padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59, 130, 246, 0.2)', padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', color: 'var(--blue-400)', fontWeight: 600, marginBottom: 12 }}>
            <Cpu size={14} /> Authoritative Discrete-Event Research Platform
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1.25, marginBottom: 10 }}>
            Adaptive OS CPU Scheduling & Performance Analysis
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--navy-200)', lineHeight: 1.6, marginBottom: 18 }}>
            Operating systems face an inevitable trade-off between <strong>raw throughput efficiency</strong> and <strong>runtime allocation fairness</strong>.
            This research platform simulates <strong>five classic CPU scheduling algorithms</strong> using an authoritative C engine,
            evaluates multi-dimensional performance and dual <strong>Jain's Fairness Indices</strong>, and dynamically predicts the optimal policy for varying workloads.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '9px 18px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={() => onNavigate('simulator')}
            >
              <Play size={16} /> Start Simulation
            </button>
            <button
              className="btn"
              style={{ background: '#fff', color: 'var(--navy-900)', padding: '9px 18px', fontSize: '0.9rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onClick={() => onNavigate('comparison')}
            >
              <BarChart2 size={16} /> Compare Schedulers
            </button>
            <button
              className="btn"
              style={{ background: 'rgba(255, 255, 255, 0.12)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '9px 16px', fontSize: '0.9rem' }}
              onClick={() => onNavigate('fairness')}
            >
              Fairness Lab
            </button>
            <button
              className="btn"
              style={{ background: 'rgba(255, 255, 255, 0.12)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '9px 16px', fontSize: '0.9rem' }}
              onClick={() => onNavigate('guide')}
            >
              Methodology Guide
            </button>
          </div>
        </div>
      </div>

      {/* 6-Step Research Workflow Bar */}
      <div className="card" style={{ marginBottom: 24, padding: '14px 20px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Standard Research Workflow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          {[
            { step: '1', title: 'Create Workload', tab: 'laboratory' },
            { step: '2', title: 'Run 5 Schedulers', tab: 'simulator' },
            { step: '3', title: 'Compare Metrics', tab: 'comparison' },
            { step: '4', title: 'Analyze Fairness', tab: 'fairness' },
            { step: '5', title: 'Adaptive Recommendation', tab: 'recommendation' },
            { step: '6', title: 'Experiment Studio', tab: 'experiments' },
          ].map((item, idx, arr) => (
            <React.Fragment key={item.step}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, transition: 'background 0.15s' }}
                onClick={() => onNavigate(item.tab)}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--blue-600)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.step}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-800)' }}>{item.title}</span>
              </div>
              {idx < arr.length - 1 && <ArrowRight size={14} color="var(--navy-400)" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Five Schedulers & Fairness Overview */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Five Core Scheduling Policies</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.83rem', color: 'var(--navy-700)' }}>
            <div style={{ padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 6 }}>
              <strong>1. FCFS (First-Come, First-Served):</strong> Non-preemptive FIFO dispatch. Highly susceptible to the convoy effect when long jobs arrive first.
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 6 }}>
              <strong>2. SJF (Shortest Job First):</strong> Non-preemptive optimal waiting time for simultaneous arrivals (Smith's rule). May cause long-job starvation.
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 6 }}>
              <strong>3. SRTF (Shortest Remaining Time First):</strong> Preemptive shortest-remaining dispatch. Minimizes average response & waiting times under staggered arrivals.
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 6 }}>
              <strong>4. Priority Scheduling:</strong> Non-preemptive priority queue (lower value = higher priority). Prioritizes critical system tasks.
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 6 }}>
              <strong>5. Round Robin (RR):</strong> Preemptive time-slicing with configurable quantum. Maximizes interactive fairness at the cost of context switch overhead.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Understanding Dual Jain Fairness vs. Performance</div>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 10 }}>
              Operating system researchers evaluate fairness through two complementary formulations:
            </p>
            <div style={{ marginBottom: 12 }}>
              <strong>Raw Allocation Fairness J_raw(t):</strong> Measures whether active processes receive an equal count of CPU cycles up to observation time <em>t</em>.
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>Demand-Relative Progress Fairness J_progress(t):</strong> Measures whether processes make equitable fractional progress relative to their own unique burst demands: <code>F_i(t) = min(X_i/D_i, 1.0)</code>.
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--blue-50)', borderRadius: 6, borderLeft: '3px solid var(--blue-600)', fontSize: '0.8rem', color: 'var(--navy-800)' }}>
              <strong>The Performance-Fairness Trade-off:</strong> Greedy policies (SJF/SRTF) achieve superior turnaround times by starving long jobs, while Round Robin provides democratic progress equality at the cost of extra context switches.
            </div>
          </div>
        </div>
      </div>

      {/* Database Highlights */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Saved Workloads</div>
          <div className="stat-value" style={{ color: 'var(--blue-600)' }}>
            {data ? data.workload_count : '...'}
          </div>
          <div className="stat-sub">Persisted workload configurations</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Simulations Executed</div>
          <div className="stat-value" style={{ color: 'var(--orange-600)' }}>
            {data ? data.simulation_count : '...'}
          </div>
          <div className="stat-sub">Authoritative C engine runs</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Batch Experiments</div>
          <div className="stat-value" style={{ color: 'var(--navy-900)' }}>
            {data ? data.experiment_count : '...'}
          </div>
          <div className="stat-sub">Paired statistical research matrices</div>
        </div>
      </div>

      {/* Core Workflow Shortcuts */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Research Workflows</div>
            <div className="card-subtitle">Launch simulation, comparison, or batch experiments</div>
          </div>
        </div>
        <div className="grid-4">
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s' }}
            onClick={() => onNavigate('laboratory')}
          >
            <div style={{ color: 'var(--blue-600)', marginBottom: 8 }}><FlaskConical size={24} /></div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Workload Lab</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--navy-500)', marginTop: 4 }}>
              Design manual or random workloads with skew and burst dispersion controls.
            </p>
          </div>

          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s' }}
            onClick={() => onNavigate('simulator')}
          >
            <div style={{ color: 'var(--orange-600)', marginBottom: 8 }}><Play size={24} /></div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Scheduler Simulator</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--navy-500)', marginTop: 4 }}>
              Execute FCFS, SJF, SRTF, Priority, or RR with interactive Gantt timeline.
            </p>
          </div>

          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s' }}
            onClick={() => onNavigate('comparison')}
          >
            <div style={{ color: 'var(--green-600)', marginBottom: 8 }}><BarChart2 size={24} /></div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Scheduler Comparison</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--navy-500)', marginTop: 4 }}>
              Benchmark all 5 algorithms side-by-side with Jain's fairness metrics.
            </p>
          </div>

          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s' }}
            onClick={() => onNavigate('experiments')}
          >
            <div style={{ color: 'var(--purple-600)', marginBottom: 8 }}><Layers size={24} /></div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Experiment Studio</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--navy-500)', marginTop: 4 }}>
              Run paired multi-seed matrices with Cohen's d effect sizes and hypothesis tests.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Simulation Runs and Experiments */}
      <div className="grid-2">
        {/* Recent Simulations */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Simulation Runs</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('history')}>
              View All <ArrowRight size={12} />
            </button>
          </div>
          {data && data.recent_simulations.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Workload</th>
                    <th>Algorithm</th>
                    <th>Avg Wait</th>
                    <th>CPU Util</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_simulations.map(s => (
                    <tr key={s.id}>
                      <td>#{s.id}</td>
                      <td><strong>{s.workload_name}</strong></td>
                      <td><span className="badge badge-blue">{s.algorithm} {s.quantum > 0 ? `(q=${s.quantum})` : ''}</span></td>
                      <td>{s.avg_waiting_time.toFixed(2)}</td>
                      <td>{(s.cpu_utilization * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No simulation runs recorded yet. Start in the Simulator!</div>
          )}
        </div>

        {/* Recent Experiments */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Saved Batch Experiments</div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('experiments')}>
              New Batch <ArrowRight size={12} />
            </button>
          </div>
          {data && data.recent_experiments.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Experiment Name</th>
                    <th>Schedulers</th>
                    <th>Seeds</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_experiments.map(e => (
                    <tr key={e.id}>
                      <td>#{e.id}</td>
                      <td><strong>{e.name}</strong></td>
                      <td>{e.schedulers.join(', ')}</td>
                      <td><span className="badge badge-purple">{e.seed_count} seeds</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No experiments executed yet. Create an experiment matrix!</div>
          )}
        </div>
      </div>
    </div>
  );
};
