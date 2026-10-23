import React from 'react';
import { AggregateMetricsItem } from '../types';

interface MetricsCardsProps {
  metrics: AggregateMetricsItem;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ metrics }) => {
  return (
    <div className="grid-4" style={{ marginBottom: 20 }}>
      {/* Waiting Time */}
      <div className="stat-card">
        <div className="stat-label">Avg Waiting Time</div>
        <div className="stat-value">{metrics.avg_waiting_time.toFixed(2)}</div>
        <div className="stat-sub">
          p95: {metrics.p95_waiting_time !== undefined ? metrics.p95_waiting_time.toFixed(2) : '-'} | σ: {metrics.waiting_time_std !== undefined ? metrics.waiting_time_std.toFixed(2) : '-'} | Max: {metrics.max_waiting_time}
        </div>
      </div>

      {/* Turnaround Time */}
      <div className="stat-card">
        <div className="stat-label">Avg Turnaround Time</div>
        <div className="stat-value">{metrics.avg_turnaround_time.toFixed(2)}</div>
        <div className="stat-sub">
          Median: {metrics.median_turnaround_time.toFixed(2)}
        </div>
      </div>

      {/* Response Time */}
      <div className="stat-card">
        <div className="stat-label">Avg Response Time</div>
        <div className="stat-value">{metrics.avg_response_time.toFixed(2)}</div>
        <div className="stat-sub">
          Median: {metrics.median_response_time.toFixed(2)} | Max: {metrics.max_response_time ?? '-'}
        </div>
      </div>

      {/* Throughput & Utilization */}
      <div className="stat-card">
        <div className="stat-label">CPU Utilization</div>
        <div className="stat-value">{(metrics.cpu_utilization * 100).toFixed(1)}%</div>
        <div className="stat-sub">
          Throughput: {metrics.throughput.toFixed(4)} proc/unit
        </div>
      </div>

      {/* Switching & Preemptions */}
      <div className="stat-card">
        <div className="stat-label">Context Switches</div>
        <div className="stat-value">{metrics.context_switches}</div>
        <div className="stat-sub">
          Preemptions: {metrics.preemptions}
        </div>
      </div>

      {/* Raw CPU Fairness */}
      <div className="stat-card">
        <div className="stat-label">Jain's CPU Fairness</div>
        <div className="stat-value" style={{ color: metrics.jain_fairness_cpu > 0.85 ? 'var(--blue-600)' : 'var(--navy-900)' }}>
          {metrics.is_cpu_fairness_defined ? metrics.jain_fairness_cpu.toFixed(4) : 'N/A'}
        </div>
        <div className="stat-sub">Raw service equality (0 to 1.0)</div>
      </div>

      {/* Progress Fairness & Gini */}
      <div className="stat-card">
        <div className="stat-label">Fairness & Inequality</div>
        <div className="stat-value" style={{ color: metrics.jain_fairness_progress > 0.85 ? 'var(--green-600)' : 'var(--navy-900)' }}>
          J(F): {metrics.is_progress_fairness_defined ? metrics.jain_fairness_progress.toFixed(3) : 'N/A'}
        </div>
        <div className="stat-sub">
          Waiting Gini: {metrics.waiting_time_gini !== undefined ? metrics.waiting_time_gini.toFixed(4) : '-'} (0 = equal)
        </div>
      </div>

      {/* Starvation Ratio & Count */}
      <div className="stat-card">
        <div className="stat-label">Starvation Indicators</div>
        <div className="stat-value" style={{ color: (metrics.starvation_count > 0 || metrics.starvation_ratio > 3.0) ? 'var(--red-600)' : 'var(--navy-900)' }}>
          {metrics.starvation_ratio.toFixed(2)}x
        </div>
        <div className="stat-sub">
          Starved procs (&gt;3x avg): <strong>{metrics.starvation_count ?? 0}</strong>
        </div>
      </div>
    </div>
  );
};
