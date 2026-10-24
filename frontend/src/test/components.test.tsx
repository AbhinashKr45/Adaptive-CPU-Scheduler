import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Navbar } from '../components/Navbar';
import { MetricsCards } from '../components/MetricsCards';

describe('Frontend Component Tests', () => {
  it('Navbar: renders brand and responds to tab switches', () => {
    const handleTabChange = vi.fn();
    render(<Navbar activeTab="overview" setActiveTab={handleTabChange} />);

    expect(screen.getByText(/Adaptive OS Scheduling/i)).toBeInTheDocument();
    expect(screen.getByText(/Authoritative C Engine Active/i)).toBeInTheDocument();

    const expTab = screen.getByText(/Final Benchmark Report/i);
    expect(expTab).toBeInTheDocument();

    fireEvent.click(expTab);
    expect(handleTabChange).toHaveBeenCalledWith('final-results');
  });

  it('ErrorBoundary: catches rendering errors and displays recovery UI', () => {
    const ThrowError = () => {
      throw new Error('Simulated UI Rendering Failure');
    };

    // Suppress console.error in test output for intentional throw
    const originalConsoleError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Application Error Caught/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulated UI Rendering Failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();

    console.error = originalConsoleError;
  });

  it('MetricsCards: renders all primary performance and fairness indicators', () => {
    const mockMetrics: any = {
      avg_waiting_time: 4.5,
      p95_waiting_time: 8.2,
      waiting_time_std: 2.1,
      max_waiting_time: 9,
      waiting_time_gini: 0.32,
      starvation_count: 0,
      avg_turnaround_time: 9.5,
      median_turnaround_time: 9.0,
      avg_response_time: 2.5,
      median_response_time: 2.0,
      max_response_time: 4,
      cpu_utilization: 0.88,
      throughput: 0.25,
      context_switches: 6,
      preemptions: 2,
      jain_fairness_cpu: 0.85,
      is_cpu_fairness_defined: true,
      jain_fairness_progress: 0.95,
      is_progress_fairness_defined: true
    };

    render(<MetricsCards metrics={mockMetrics} />);

    expect(screen.getByText('Avg Waiting Time')).toBeInTheDocument();
    expect(screen.getByText('4.50')).toBeInTheDocument();
    expect(screen.getByText(/p95: 8.20/)).toBeInTheDocument();
    expect(screen.getByText(/Gini: 0.3200/)).toBeInTheDocument();
    expect(screen.getByText(/0\.950/)).toBeInTheDocument();
    expect(screen.getByText(/88\.0%/)).toBeInTheDocument();
  });
});
