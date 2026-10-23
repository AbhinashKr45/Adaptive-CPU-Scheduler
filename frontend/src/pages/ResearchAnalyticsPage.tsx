import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ExperimentItem } from '../types';
import {
  LineChart as LineChartIcon, BarChart2, Layers,
  TrendingDown, CheckCircle, AlertCircle, ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, ErrorBar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';

interface ResearchAnalyticsProps {
  activeExperiment: ExperimentItem | null;
  onNavigate: (tab: string) => void;
}

export const ResearchAnalyticsPage: React.FC<ResearchAnalyticsProps> = ({
  activeExperiment,
  onNavigate
}) => {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<number | null>(activeExperiment ? activeExperiment.id : null);
  const [currentExp, setCurrentExp] = useState<ExperimentItem | null>(activeExperiment);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExperiments();
  }, []);

  useEffect(() => {
    if (selectedExpId) {
      loadExperimentDetail(selectedExpId);
    }
  }, [selectedExpId]);

  const loadExperiments = async () => {
    try {
      const list = await api.listExperiments();
      setExperiments(list);
      if (!selectedExpId && list.length > 0) {
        setSelectedExpId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadExperimentDetail = async (id: number) => {
    setLoading(true);
    try {
      const exp = await api.getExperiment(id);
      setCurrentExp(exp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!currentExp && (!experiments || experiments.length === 0)) {
    return (
      <div className="card">
        <div className="empty-state">
          <LineChartIcon size={48} className="empty-icon" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--navy-800)', marginBottom: 8 }}>
            No Experiment Data Available
          </h3>
          <p style={{ maxWidth: 450, margin: '0 auto 20px', color: 'var(--navy-600)' }}>
            Research analytics requires experimental batches with multi-seed paired replications.
            Configure and run an experiment in the Studio first!
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('experiments')}>
            <Layers size={16} /> Open Experiment Studio
          </button>
        </div>
      </div>
    );
  }

  const schedulers = currentExp?.schedulers || [];
  const summary = currentExp?.summary || {};
  const pairedComps = currentExp?.paired_comparisons || {};

  // Maximum value for bar scaling
  const maxWaitMean = Math.max(
    ...schedulers.map(s => summary[s]?.avg_waiting_time?.ci_high || summary[s]?.avg_waiting_time?.mean || 1),
    1
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Research Statistical Analytics
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Rigorous statistical evaluation: 95% confidence intervals, Cohen's d effect sizes, and paired comparisons.
          </p>
        </div>

        {experiments.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Active Experiment:</label>
            <select
              className="form-control"
              style={{ width: 220 }}
              value={selectedExpId || ''}
              onChange={e => setSelectedExpId(parseInt(e.target.value))}
            >
              {experiments.map(e => (
                <option key={e.id} value={e.id}>{e.name} (#{e.id})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart 1: Recharts Interactive BarChart with 95% Confidence Intervals */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Mean Waiting Time with 95% Confidence Intervals (Recharts)</div>
            <div className="card-subtitle">
              Calculated via Student's t distribution over {currentExp?.seeds.length} paired seeds. Whisker lines represent [CI Low, CI High].
            </div>
          </div>
          <span className="badge badge-blue">Interactive Recharts</span>
        </div>

        <div style={{ height: 320, width: '100%', marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={schedulers.map(s => {
                const stats = summary[s]?.avg_waiting_time || {};
                const ciRange = stats.ci_high && stats.ci_low ? [stats.mean - stats.ci_low, stats.ci_high - stats.mean] : undefined;
                return {
                  name: s,
                  waiting_time: stats.mean || 0,
                  ci_low: stats.ci_low,
                  ci_high: stats.ci_high,
                  error: ciRange
                };
              })}
              margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--navy-600)" />
              <YAxis stroke="var(--navy-600)" label={{ value: 'Ticks', angle: -90, position: 'insideLeft', fill: 'var(--navy-500)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem' }}
                formatter={(val: any, name: any, item: any) => [
                  `${Number(val).toFixed(2)} ticks (95% CI: [${item.payload.ci_low?.toFixed(2)}, ${item.payload.ci_high?.toFixed(2)}])`,
                  'Avg Waiting Time'
                ]}
              />
              <Bar dataKey="waiting_time" fill="#2563eb" radius={[6, 6, 0, 0]}>
                <ErrorBar dataKey="error" width={4} strokeWidth={2} stroke="#ea580c" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Recharts Multi-Metric Comparative Performance */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Comparative Latency & Overhead Breakdown</div>
            <div className="card-subtitle">
              Side-by-side grouped evaluation of Waiting Time, Response Time, and Context Switches across all policies.
            </div>
          </div>
          <span className="badge badge-purple">Grouped Comparison</span>
        </div>

        <div style={{ height: 320, width: '100%', marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={schedulers.map(s => ({
                name: s,
                'Waiting Time': summary[s]?.avg_waiting_time?.mean || 0,
                'Response Time': summary[s]?.avg_response_time?.mean || 0,
                'Turnaround': summary[s]?.avg_turnaround_time?.mean || 0,
                'Context Switches': summary[s]?.context_switches?.mean || 0
              }))}
              margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--navy-600)" />
              <YAxis stroke="var(--navy-600)" />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem' }}
              />
              <Legend wrapperStyle={{ paddingTop: 10 }} />
              <Bar dataKey="Waiting Time" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Response Time" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Turnaround" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Context Switches" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Paired Statistical Comparisons against Baseline (FCFS) */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Paired Differences & Effect Sizes (vs FCFS Baseline)</div>
            <div className="card-subtitle">
              Paired t-test, Wilcoxon signed-rank test, and Cohen's d effect size on identical workload seeds.
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Comparison</th>
                <th>Sample (n)</th>
                <th>Mean Paired Diff (95% Bootstrap CI)</th>
                <th>Effect Size (Paired d_z / Hedges' g)</th>
                <th>t-test p (uncorr.)</th>
                <th>Holm Adjusted p</th>
                <th>Headline Significance (Holm α=0.05)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pairedComps).map(([compName, metricsMap]: [string, any]) => {
                const waitComp = metricsMap['avg_waiting_time'];
                if (!waitComp) return null;

                const isSigHolm = waitComp.significant_holm ?? waitComp.holm_bonferroni?.significant_holm ?? false;
                const isSigUncorr = waitComp.significant_uncorrected ?? waitComp.significant_at_05;
                const dz = waitComp.cohens_dz ?? waitComp.cohens_d;
                const g = waitComp.hedges_g ?? dz;
                let effectDesc = 'Negligible';
                if (Math.abs(dz) >= 0.8) effectDesc = 'Large';
                else if (Math.abs(dz) >= 0.5) effectDesc = 'Medium';
                else if (Math.abs(dz) >= 0.2) effectDesc = 'Small';

                const adjP = waitComp.holm_bonferroni?.adjusted_p;
                const ciLow = waitComp.ci_diff_low ?? waitComp.mean_diff;
                const ciHigh = waitComp.ci_diff_high ?? waitComp.mean_diff;

                return (
                  <tr key={compName}>
                    <td><strong>{compName.replace(/_/g, ' ')}</strong></td>
                    <td><span className="badge badge-gray">{waitComp.n ?? 'N/A'}</span></td>
                    <td style={{ color: waitComp.mean_diff < 0 ? 'var(--green-600)' : 'var(--red-600)', fontWeight: 600 }}>
                      {waitComp.mean_diff.toFixed(2)} ticks
                      <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)', fontWeight: 400 }}>
                        95% CI: [{ciLow.toFixed(2)}, {ciHigh.toFixed(2)}]
                      </div>
                    </td>
                    <td>
                      <strong>d_z={dz.toFixed(2)}</strong>, g={g.toFixed(2)}
                      <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>{effectDesc} effect</div>
                    </td>
                    <td>{waitComp.p_value_ttest.toFixed(4)}</td>
                    <td>{adjP !== undefined ? adjP.toFixed(4) : 'N/A'}</td>
                    <td>
                      {isSigHolm ? (
                        <span className="badge badge-green">Holm-Significant</span>
                      ) : isSigUncorr ? (
                        <span className="badge badge-orange" title="Significant uncorrected, but not under Holm-Bonferroni step-down">
                          Uncorr. only (p &lt; 0.05)
                        </span>
                      ) : (
                        <span className="badge badge-gray">Not Significant</span>
                      )}
                      {waitComp.note && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--navy-500)', marginTop: 4 }}>
                          {waitComp.note}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fairness & Context Switch Trade-Offs */}
      <div className="grid-2">
        {/* Fairness Comparison */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Jain's Fairness Index: Raw CPU vs Progress</div>
              <div className="card-subtitle">
                At final completion, J(F)=1.0 reflects total demand fulfillment; J(x) reflects process burst variation.
              </div>
            </div>
          </div>
          <div style={{ padding: '8px 12px', margin: '0 16px 12px', background: 'var(--surface-secondary)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--navy-600)' }}>
            <strong>Interpretation Guide:</strong> Fully completed batches yield J(F) ≈ 1.0 because every process eventually finishes. Final raw CPU fairness J(x) varies with requested burst variance. Use observation-time fairness to assess mid-run concurrency.
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheduler</th>
                  <th>Raw CPU Fairness J(x)</th>
                  <th>Progress Fairness J(F)</th>
                </tr>
              </thead>
              <tbody>
                {schedulers.map(s => (
                  <tr key={s}>
                    <td><strong>{s}</strong></td>
                    <td>{summary[s]?.jain_fairness_cpu?.mean.toFixed(4)}</td>
                    <td>
                      <span className="badge badge-blue">
                        {summary[s]?.jain_fairness_progress?.mean.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Context Switch Overhead */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Preemption & Context Switch Trade-Offs</div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheduler</th>
                  <th>Mean Context Switches</th>
                  <th>Mean Preemptions</th>
                </tr>
              </thead>
              <tbody>
                {schedulers.map(s => (
                  <tr key={s}>
                    <td><strong>{s}</strong></td>
                    <td>{summary[s]?.context_switches?.mean.toFixed(1)}</td>
                    <td>
                      <span className={`badge ${summary[s]?.preemptions?.mean > 0 ? 'badge-orange' : 'badge-gray'}`}>
                        {summary[s]?.preemptions?.mean.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
