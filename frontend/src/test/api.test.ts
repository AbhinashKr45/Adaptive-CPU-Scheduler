import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../services/api';

describe('Frontend API Client (services/api.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getHealth: successfully fetches system health', async () => {
    const mockHealth = { status: 'healthy', c_engine: 'authoritative' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealth
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await api.getHealth();
    expect(res).toEqual(mockHealth);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/health');
  });

  it('runSimulation: sends process payload and parses simulation response', async () => {
    const mockSim = {
      status: 'success',
      algorithm: 'FCFS',
      metrics: { avg_waiting_time: 4.5, makespan: 16 }
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSim
    });
    vi.stubGlobal('fetch', mockFetch);

    const procs = [{ pid: 1, arrival_time: 0, burst_time: 5, priority: 1 }];
    const res = await api.runSimulation({ algorithm: 'FCFS', processes: procs });
    expect(res.algorithm).toBe('FCFS');
    expect(res.metrics.avg_waiting_time).toBe(4.5);
  });

  it('getRecommendation: sends objective and selector_mode in payload', async () => {
    const mockRec = {
      recommended_scheduler: 'SRTF',
      selector_mode: 'rule_based',
      objective: 'minimize_waiting',
      explanation: 'SRTF clears short bursts',
      scores: { SRTF: -3.0, FCFS: -4.5 }
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRec
    });
    vi.stubGlobal('fetch', mockFetch);

    const procs = [{ pid: 1, arrival_time: 0, burst_time: 4, priority: 1 }];
    const res = await api.getRecommendation(procs, 'minimize_waiting', 2, true, 'rule_based');
    expect(res.recommended_scheduler).toBe('SRTF');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/recommend',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          processes: procs,
          objective: 'minimize_waiting',
          quantum: 2,
          selector_mode: 'rule_based',
          evaluate_held_out: true
        })
      })
    );
  });

  it('getFinalResults: fetches authoritative research benchmark payload', async () => {
    const mockResults = {
      seed_count: 30,
      schedulers: ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'RR'],
      workload_names: ['Standard Balanced']
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResults
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await api.getFinalResults();
    expect(res.seed_count).toBe(30);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/final-results');
  });

  it('handles HTTP error responses gracefully with descriptive exception', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Duplicate Process IDs found in workload.' })
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(api.createWorkload({ name: 'Invalid', processes: [] })).rejects.toThrow(
      'Duplicate Process IDs found in workload.'
    );
  });
});
