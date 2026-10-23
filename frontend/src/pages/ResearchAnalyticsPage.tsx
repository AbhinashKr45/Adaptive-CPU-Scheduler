import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ExperimentItem } from '../types';
import {
  LineChart as LineChartIcon, BarChart2, Layers,
  TrendingDown, CheckCircle, AlertCircle, ArrowRight
} from 'lucide-react';

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

      {/* Chart 1: Mean Waiting Time with 95% Confidence Intervals */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Mean Waiting Time with 95% Confidence Intervals</div>
            <div className="card-subtitle">
              Calculated via Student's t distribution over {currentExp?.seeds.length} paired seeds. Whisker lines represent [CI Low, CI High].
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 0' }}>
          {schedulers.map(s => {
            const stats = summary[s]?.avg_waiting_time;
            if (!stats) return null;
            const meanWidthPct = (stats.mean / maxWaitMean) * 100;
            const ciLowPct = (stats.ci_low / maxWaitMean) * 100;
            const ciHighPct = (stats.ci_high / maxWaitMean) * 100;

            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 100, fontWeight: 600, fontSize: '0.85rem' }}>{s}</div>
                <div style={{ flex: 1, position: 'relative', height: 32, background: 'var(--surface-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                  {/* CI Range line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${ciLowPct}%`,
                      width: `${Math.max(2, ciHighPct - ciLowPct)}%`,
                      height: 4,
                      background: 'var(--navy-400)',
                      borderRadius: 2
                    }}
                  />
                  {/* CI low whisker */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${ciLowPct}%`,
                      height: 12,
                      width: 2,
                      background: 'var(--navy-600)'
                    }}
                  />
                  {/* CI high whisker */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${ciHighPct}%`,
                      height: 12,
                      width: 2,
                      background: 'var(--navy-600)'
                    }}
                  />
                  {/* Mean Bar */}
                  <div
                    style={{
                      width: `${meanWidthPct}%`,
                      height: '100%',
                      background: s === 'SRTF' || s === 'SJF' ? 'var(--blue-600)' : 'var(--navy-700)',
                      borderRadius: 4,
                      opacity: 0.85,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    {stats.mean.toFixed(2)}
                  </div>
                </div>
                <div style={{ width: 140, fontSize: '0.75rem', color: 'var(--navy-600)' }}>
                  CI: [{stats.ci_low.toFixed(2)}, {stats.ci_high.toFixed(2)}]
                </div>
              </div>
            );
          })}
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
                <th>Metric</th>
                <th>Mean Paired Difference (Δ)</th>
                <th>Cohen's d Effect Size</th>
                <th>t-test p-value</th>
                <th>Wilcoxon p-value</th>
                <th>Significance (α=0.05)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(pairedComps).map(([compName, metricsMap]: [string, any]) => {
                const waitComp = metricsMap['avg_waiting_time'];
                if (!waitComp) return null;

                const isSig = waitComp.significant_at_05;
                const d = waitComp.cohens_d;
                let effectDesc = 'Negligible';
                if (Math.abs(d) >= 0.8) effectDesc = 'Large';
                else if (Math.abs(d) >= 0.5) effectDesc = 'Medium';
                else if (Math.abs(d) >= 0.2) effectDesc = 'Small';

                return (
                  <tr key={compName}>
                    <td><strong>{compName.replace(/_/g, ' ')}</strong></td>
                    <td>Avg Waiting Time</td>
                    <td style={{ color: waitComp.mean_diff < 0 ? 'var(--green-600)' : 'var(--red-600)', fontWeight: 600 }}>
                      {waitComp.mean_diff.toFixed(2)} ticks
                    </td>
                    <td>
                      <strong>{waitComp.cohens_d.toFixed(2)}</strong> ({effectDesc})
                    </td>
                    <td>{waitComp.p_value_ttest.toFixed(4)}</td>
                    <td>{waitComp.p_value_wilcoxon.toFixed(4)}</td>
                    <td>
                      {isSig ? (
                        <span className="badge badge-green">Statistically Significant</span>
                      ) : (
                        <span className="badge badge-gray">Not Significant</span>
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
