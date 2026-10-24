import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OverviewPage } from '../pages/OverviewPage';
import { AdaptiveRecommendationPage } from '../pages/AdaptiveRecommendationPage';
import { FinalResultsPage } from '../pages/FinalResultsPage';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getOverview: vi.fn(),
    getRecommendation: vi.fn(),
    getFinalResults: vi.fn(),
    getFinalReport: vi.fn()
  }
}));

describe('Frontend Pages Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OverviewPage: loads overview metrics and handles navigation clicks', async () => {
    (api.getOverview as any).mockResolvedValue({
      workload_count: 5,
      simulation_count: 42,
      experiment_count: 8,
      recent_simulations: [],
      recent_experiments: []
    });

    const handleNavigate = vi.fn();
    render(<OverviewPage onNavigate={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Saved Workloads')).toBeInTheDocument();
    });

    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getByText('42')).toBeInTheDocument();

    const simBtn = screen.getByRole('button', { name: /Start Simulation/i });
    fireEvent.click(simBtn);
    expect(handleNavigate).toHaveBeenCalledWith('simulator');
  });

  it('AdaptiveRecommendationPage: renders objectives and displays feature-only recommendation', async () => {
    const mockProcs = [
      { pid: 1, arrival_time: 0, burst_time: 4, priority: 1 },
      { pid: 2, arrival_time: 1, burst_time: 8, priority: 2 }
    ];

    (api.getRecommendation as any).mockResolvedValue({
      recommended_scheduler: 'SRTF',
      selector_mode: 'rule_based',
      objective: 'minimize_waiting',
      objective_label: 'Minimize Waiting Time',
      objective_definition: 'Minimize average waiting time across all completed processes',
      explanation: 'SRTF preemptively clears short jobs',
      workload_features: {
        process_count: 2,
        burst_cv: 0.45,
        burst_mean: 6.0,
        arrival_span: 1,
        burstiness: 0.1
      },
      trade_offs: ['Preemption overhead'],
      alternatives: ['SJF', 'RR'],
      uncertainty: 'Low',
      scores: { SRTF: -3.0, FCFS: -5.0 },
      oracle: {
        oracle_scheduler: 'SRTF',
        oracle_score: -3.0,
        adaptive_matched_oracle: true,
        oracle_gap: 0.0,
        all_scores: { SRTF: -3.0, FCFS: -5.0 }
      }
    });

    render(<AdaptiveRecommendationPage currentProcesses={mockProcs} onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/SRTF Scheduling/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Exact Oracle Match/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero-Leakage Invariant Verified/i)).toBeInTheDocument();
  });

  it('FinalResultsPage: loads authoritative benchmark and switches between matrix and report', async () => {
    (api.getFinalResults as any).mockResolvedValue({
      seed_count: 30,
      schedulers: ['FCFS', 'SRTF'],
      workload_names: ['Standard Balanced'],
      environment: { git_commit: '5573aa3974', os_platform: 'Windows 11', gcc_version: 'gcc 6.3.0' },
      summaries: {
        'Standard Balanced': {
          FCFS: {
            avg_waiting_time: { mean: 37.82, std: 4.56, ci_low: 36.11, ci_high: 39.52 },
            avg_turnaround_time: { mean: 45.79, std: 5.17 },
            avg_response_time: { mean: 37.82, std: 4.56 },
            context_switches: { mean: 11.0, std: 0.0 },
            makespan: { mean: 95.6, std: 8.5 }
          },
          SRTF: {
            avg_waiting_time: { mean: 31.31, std: 4.42, ci_low: 29.65, ci_high: 32.96 },
            avg_turnaround_time: { mean: 39.27, std: 5.09 },
            avg_response_time: { mean: 30.04, std: 4.54 },
            context_switches: { mean: 11.6, std: 0.7 },
            makespan: { mean: 95.6, std: 8.5 }
          }
        }
      },
      pairwise: { 'Standard Balanced': {} },
      friedman: { 'Standard Balanced': {} },
      overhead: { rule_based_us: 863.12, speedup_vs_simulation: 84.0 }
    });

    (api.getFinalReport as any).mockResolvedValue({
      report_markdown: '# Empirical Performance, Fairness, and Regret Analysis\n\nFull Research Paper.'
    });

    render(<FinalResultsPage onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Empirical Benchmark Matrix & Research Report/i)).toBeInTheDocument();
    });

    expect(screen.getByText('37.82')).toBeInTheDocument();
    expect(screen.getByText('31.31')).toBeInTheDocument();

    const reportBtn = screen.getByRole('button', { name: /Full Academic REPORT.md/i });
    fireEvent.click(reportBtn);

    expect(screen.getByText(/Generated Research Paper/i)).toBeInTheDocument();
    expect(screen.getByText(/Full Research Paper/i)).toBeInTheDocument();
  });
});
