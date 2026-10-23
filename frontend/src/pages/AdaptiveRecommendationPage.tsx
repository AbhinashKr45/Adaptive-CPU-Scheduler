import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ProcessItem, RecommendationResponse } from '../types';
import {
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight,
  TrendingDown, Shield, RefreshCw, Cpu, Scale,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface AdaptiveRecommendationProps {
  currentProcesses: ProcessItem[];
  onNavigate: (tab: string) => void;
}

export const AdaptiveRecommendationPage: React.FC<AdaptiveRecommendationProps> = ({
  currentProcesses,
  onNavigate
}) => {
  const [objective, setObjective] = useState<string>('minimize_waiting');
  const [quantum, setQuantum] = useState<number>(2);
  const [rec, setRec] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const objectives = [
    { id: 'minimize_waiting', title: 'Minimize Waiting Time', desc: 'Selects policy achieving lowest avg_waiting_time on this workload.' },
    { id: 'minimize_response', title: 'Minimize Response Time', desc: 'Selects policy with lowest avg_response_time (interactive dispatch latency).' },
    { id: 'balance_fairness_performance', title: 'Balance Fairness & Throughput', desc: 'Maximizes 0.5 × norm_throughput + 0.5 × jain_fairness_progress.' },
    { id: 'penalize_context_switches', title: 'Penalize Context Switches', desc: 'Selects policy with fewest context_switches.' }
  ];

  const handleGetRecommendation = async () => {
    if (currentProcesses.length === 0) {
      setError('No workload loaded. Please configure processes in the Workload Laboratory.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRecommendation(currentProcesses, objective, quantum, true);
      setRec(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate recommendation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentProcesses.length > 0) {
      handleGetRecommendation();
    }
  }, [objective, quantum, currentProcesses]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
            Adaptive Scheduler Recommendation Engine
          </h1>
          <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
            Transparent, data-driven OS scheduling policy selection. All 5 policies are evaluated and scored against the selected objective.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => onNavigate('laboratory')}>
          Workload Lab ({currentProcesses.length} procs)
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-100)', color: 'var(--red-600)', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Objective Picker */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">1. Select Optimization Objective</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {objectives.map(obj => {
            const isSelected = objective === obj.id;
            return (
              <div
                key={obj.id}
                onClick={() => setObjective(obj.id)}
                style={{
                  border: isSelected ? '2px solid var(--orange-600)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--orange-50)' : 'var(--surface)',
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? 'var(--orange-700)' : 'var(--navy-900)', marginBottom: 4 }}>
                  {obj.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--navy-600)', lineHeight: 1.3 }}>
                  {obj.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendation Output */}
      {rec && (
        <>
          <div className="card" style={{ borderLeft: '4px solid var(--orange-600)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="badge badge-orange" style={{ marginBottom: 6 }}>
                  Recommended Policy
                </span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--navy-950)' }}>
                  {rec.recommended_scheduler} Scheduling
                </h2>
                <p style={{ maxWidth: 800, fontSize: '0.95rem', color: 'var(--navy-700)', marginTop: 8, lineHeight: 1.5 }}>
                  {rec.explanation}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onNavigate('simulator')}
                >
                  Simulate {rec.recommended_scheduler} Now <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Objective Definition */}
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--surface-secondary)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--navy-600)' }}>
              <strong>Objective Function:</strong> {rec.objective_definition}
              {rec.weights && (
                <div style={{ marginTop: 4 }}>
                  <strong>Weights:</strong> Throughput={rec.weights.throughput_weight}, Fairness={rec.weights.fairness_weight}. {rec.weights.description}
                </div>
              )}
            </div>

            {/* Scores for All Policies */}
            {rec.scores && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy-800)', marginBottom: 8 }}>
                  Objective Scores (all 5 policies, higher = better):
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {Object.entries(rec.scores)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([policy, score], idx) => {
                      const isRec = policy === rec.recommended_scheduler;
                      return (
                        <div
                          key={policy}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: isRec ? '2px solid var(--orange-600)' : '1px solid var(--border)',
                            background: isRec ? 'var(--orange-50)' : 'var(--surface)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isRec ? 'var(--orange-700)' : 'var(--navy-600)' }}>
                            {policy} {isRec ? '★' : ''}
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isRec ? 'var(--orange-700)' : 'var(--navy-800)' }}>
                            {typeof score === 'number' ? score.toFixed(3) : 'N/A'}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--navy-500)' }}>
                            Rank #{idx + 1}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Trade-Offs & Alternatives */}
            <div className="grid-2" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy-800)', marginBottom: 8 }}>
                  Expected Trade-Offs & Inherent Costs:
                </div>
                <ul style={{ paddingLeft: 18, fontSize: '0.82rem', color: 'var(--navy-600)', lineHeight: 1.6 }}>
                  {rec.trade_offs.map((to, i) => (
                    <li key={i}>{to}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy-800)', marginBottom: 8 }}>
                  Ranked Policy Alternatives:
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rec.alternatives.map((alt, i) => (
                    <span key={i} className="badge badge-gray" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                      #{i + 1}: {alt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Head-to-Head Comparison: Traditional Static Choice (FCFS) vs Our Fairness-Aware Selection */}
          {rec.all_metrics && (() => {
            const normalPolicy = 'FCFS';
            const ourPolicy = rec.recommended_scheduler;
            const normalM = rec.all_metrics[normalPolicy];
            const ourM = rec.all_metrics[ourPolicy];
            if (!normalM || !ourM) return null;

            const normalFairness = normalM.runtime_jain_fairness ?? normalM.jain_fairness_progress;
            const ourFairness = ourM.runtime_jain_fairness ?? ourM.jain_fairness_progress;
            const fairDelta = ourFairness - normalFairness;
            const waitDelta = ourM.avg_waiting_time - normalM.avg_waiting_time;
            const respDelta = ourM.avg_response_time - normalM.avg_response_time;
            const csDelta = ourM.context_switches - normalM.context_switches;

            return (
              <div className="card" style={{ border: '2px solid var(--blue-600)', background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-secondary) 100%)' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--navy-900)' }}>
                      <Scale size={20} color="var(--blue-600)" />
                      Head-to-Head: Traditional Static Choice vs. Our Fairness-Aware Selection
                    </div>
                    <div className="card-subtitle">
                      Direct contrast between standard static FIFO execution and our adaptive selector using Jain's Fairness Index.
                    </div>
                  </div>
                  <span className="badge badge-blue">Adaptive Selection Advantage</span>
                </div>

                <div className="grid-3" style={{ marginBottom: 16 }}>
                  {/* Normal / Naive Selection */}
                  <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase' }}>
                      Traditional OS Default
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--navy-800)', margin: '4px 0 12px' }}>
                      {normalPolicy} (Static FIFO)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Jain's Execution Fairness:</span>
                        <strong>{normalFairness.toFixed(4)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Avg Waiting Time:</span>
                        <strong>{normalM.avg_waiting_time.toFixed(2)} ticks</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Avg Response Time:</span>
                        <strong>{normalM.avg_response_time.toFixed(2)} ticks</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Context Switches:</span>
                        <strong>{normalM.context_switches}</strong>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, padding: '6px 10px', background: 'var(--orange-50)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--orange-800)' }}>
                      Vulnerable to convoy blocking: small jobs wait behind long bursts.
                    </div>
                  </div>

                  {/* Our Adaptive Selection */}
                  <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '2px solid var(--orange-600)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--orange-600)', textTransform: 'uppercase' }}>
                      Our Adaptive Selection (Jain's Index)
                    </div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--orange-700)', margin: '4px 0 12px' }}>
                      {ourPolicy} (Adaptive Winner)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Jain's Execution Fairness:</span>
                        <strong style={{ color: 'var(--blue-600)' }}>{ourFairness.toFixed(4)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Avg Waiting Time:</span>
                        <strong>{ourM.avg_waiting_time.toFixed(2)} ticks</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Avg Response Time:</span>
                        <strong>{ourM.avg_response_time.toFixed(2)} ticks</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--navy-600)' }}>Context Switches:</span>
                        <strong>{ourM.context_switches}</strong>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, padding: '6px 10px', background: 'var(--green-50)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--green-800)' }}>
                      Dynamically chosen by matching workload features to your objective.
                    </div>
                  </div>

                  {/* Net Gain / Scientific Trade-Off */}
                  <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-500)', textTransform: 'uppercase' }}>
                        Empirical Net Difference
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-900)', margin: '4px 0 12px' }}>
                        What You Gain
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--navy-600)' }}>Fairness Gain:</span>
                          <span className={`badge ${fairDelta >= 0 ? 'badge-green' : 'badge-gray'}`} style={{ fontWeight: 700 }}>
                            {fairDelta >= 0 ? `+${(fairDelta * 100).toFixed(1)}%` : `${(fairDelta * 100).toFixed(1)}%`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--navy-600)' }}>Waiting Latency Delta:</span>
                          <span className={`badge ${waitDelta <= 0 ? 'badge-green' : 'badge-orange'}`}>
                            {waitDelta <= 0 ? `${waitDelta.toFixed(2)} ticks` : `+${waitDelta.toFixed(2)} ticks`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--navy-600)' }}>Response Latency Delta:</span>
                          <span className={`badge ${respDelta <= 0 ? 'badge-green' : 'badge-orange'}`}>
                            {respDelta <= 0 ? `${respDelta.toFixed(2)} ticks` : `+${respDelta.toFixed(2)} ticks`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--navy-600)' }}>Preemption Overhead:</span>
                          <span className="badge badge-gray">
                            {csDelta >= 0 ? `+${csDelta} switches` : `${csDelta} switches`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--navy-500)', lineHeight: 1.4 }}>
                      * Inspect the <strong>Fairness Laboratory</strong> tab to observe how runtime progress equity diverges across intermediate execution windows.
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Workload Feature Characterization */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Analyzed Workload Features</div>
              <span className="badge badge-blue">Input Characteristics</span>
            </div>

            <div className="grid-4">
              <div className="stat-card">
                <div className="stat-label">Process Count</div>
                <div className="stat-value">{rec.workload_characteristics.process_count}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Burst CV (σ / μ)</div>
                <div className="stat-value">{rec.workload_characteristics.cv_burst.toFixed(2)}</div>
                <div className="stat-sub">Coefficient of variation</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Burst Skewness</div>
                <div className="stat-value">{rec.workload_characteristics.skewness.toFixed(2)}</div>
                <div className="stat-sub">Right-tail asymmetry</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Arrival Span</div>
                <div className="stat-value">{rec.workload_characteristics.arrival_span}</div>
                <div className="stat-sub">Ticks between first and last arrival</div>
              </div>
            </div>
          </div>

          {/* Empirical Validation on Held-Out Seeds */}
          {rec.held_out_evaluation && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Empirical Benchmark on Unseen Held-Out Workloads</div>
                  <div className="card-subtitle">
                    Evaluation over {rec.held_out_evaluation.held_out_seed_count} unseen random seeds.
                    Prevents data leakage by selecting policy based on actual simulation scores.
                    {rec.held_out_evaluation.display_note && (
                      <> {rec.held_out_evaluation.display_note}</>
                    )}
                  </div>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Policy Strategy</th>
                      <th>Mean Score ({rec.held_out_evaluation.target_metric})</th>
                      <th>Performance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: 'var(--orange-50)' }}>
                      <td><strong>Adaptive Recommendation</strong></td>
                      <td><strong>{rec.held_out_evaluation.adaptive_mean.toFixed(3)}</strong> ± {rec.held_out_evaluation.adaptive_std.toFixed(3)}</td>
                      <td>Selected dynamically per seed</td>
                      <td><span className="badge badge-orange">Adaptive</span></td>
                    </tr>
                    {Object.entries(rec.held_out_evaluation.fixed_policies_mean).map(([pol, val]) => (
                      <tr key={pol}>
                        <td>Fixed Policy: {pol}</td>
                        <td>{(val as number).toFixed(3)}</td>
                        <td>Static execution on all seeds</td>
                        <td><span className="badge badge-gray">Fixed</span></td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--surface-secondary)' }}>
                      <td><strong>Oracle Baseline (ex-post)</strong></td>
                      <td><strong>{rec.held_out_evaluation.oracle_mean.toFixed(3)}</strong></td>
                      <td>Theoretical best ex-post choice per seed</td>
                      <td><span className="badge badge-purple">Theoretical Oracle</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Regret */}
              <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'center', padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 8, fontSize: '0.82rem' }}>
                <div>
                  <strong>Mean Regret vs Oracle:</strong>{' '}
                  <span style={{ fontWeight: 700, color: rec.held_out_evaluation.mean_regret < 0.5 ? 'var(--green-600)' : 'var(--red-600)' }}>
                    {rec.held_out_evaluation.mean_regret.toFixed(4)}
                  </span>
                  <span style={{ color: 'var(--navy-500)', marginLeft: 8 }}>
                    (lower = closer to theoretical optimal)
                  </span>
                </div>
                <div style={{ color: 'var(--navy-500)' }}>
                  Selections: {Object.entries(rec.held_out_evaluation.recommendations_frequency)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ')}
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)', marginTop: 8 }}>
                * {rec.held_out_evaluation.oracle_note}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
