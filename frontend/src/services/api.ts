import {
  OverviewData, WorkloadResponse, PresetConfig,
  SimulationResponse, CompareResponse, ExperimentItem,
  RecommendationResponse, ProcessItem
} from '../types';

const API_BASE = (typeof window !== 'undefined' && window.location.port !== '8000')
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let err = `HTTP ${res.status}`;
    try {
      const cloned = typeof res.clone === 'function' ? res.clone() : res;
      try {
        const data = await cloned.json();
        err = data.detail || data.message || JSON.stringify(data);
      } catch {
        if (typeof res.text === 'function') {
          const text = await res.text();
          err = text || `HTTP ${res.status}`;
        }
      }
    } catch {
      err = `HTTP ${res.status} ${res.statusText || ''}`.trim();
    }
    throw new Error(err);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // System Health
  async getHealth(): Promise<{ status: string; c_engine: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string; c_engine: string }>(res);
  },

  // Overview
  async getOverview(): Promise<OverviewData> {
    const res = await fetch(`${API_BASE}/overview`);
    return handleResponse<OverviewData>(res);
  },

  // Workloads
  async getPresets(): Promise<PresetConfig[]> {
    const res = await fetch(`${API_BASE}/workloads/presets`);
    return handleResponse<PresetConfig[]>(res);
  },

  async generatePreset(key: string, count: number = 10, seed: number = 42) {
    const res = await fetch(`${API_BASE}/workloads/presets/${key}?process_count=${count}&seed=${seed}`, {
      method: 'POST'
    });
    return handleResponse<{ seed: number; config: any; processes: ProcessItem[]; characteristics: any }>(res);
  },

  async generateCustomWorkload(config: any) {
    const res = await fetch(`${API_BASE}/workloads/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return handleResponse<{ seed: number; config: any; processes: ProcessItem[]; characteristics: any }>(res);
  },

  async listWorkloads(): Promise<WorkloadResponse[]> {
    const res = await fetch(`${API_BASE}/workloads`);
    return handleResponse<WorkloadResponse[]>(res);
  },

  async createWorkload(data: { name: string; description?: string; processes: ProcessItem[]; generator_config?: any }): Promise<WorkloadResponse> {
    const res = await fetch(`${API_BASE}/workloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<WorkloadResponse>(res);
  },

  async deleteWorkload(id: number): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/workloads/${id}`, { method: 'DELETE' });
    return handleResponse<{ status: string }>(res);
  },

  // Simulation
  async runSimulation(req: {
    workload_id?: number;
    workload_name?: string;
    algorithm: string;
    quantum?: number;
    processes: ProcessItem[];
  }): Promise<SimulationResponse> {
    const res = await fetch(`${API_BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return handleResponse<SimulationResponse>(res);
  },

  // Comparison
  async compareSchedulers(processes: ProcessItem[], quantum: number = 2): Promise<CompareResponse> {
    const res = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processes, quantum })
    });
    return handleResponse<CompareResponse>(res);
  },

  // Recommendation
  async getRecommendation(
    processes: ProcessItem[],
    objective: string = 'minimize_waiting',
    quantum: number = 2,
    evaluateHeldOut: boolean = true,
    selectorMode: string = 'rule_based'
  ): Promise<RecommendationResponse> {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processes,
        objective,
        quantum,
        selector_mode: selectorMode,
        evaluate_held_out: evaluateHeldOut
      })
    });
    return handleResponse<RecommendationResponse>(res);
  },

  // Experiments
  async runExperiment(req: {
    name: string;
    description?: string;
    schedulers: string[];
    seeds: number[];
    workload_config: any;
    rr_quantum?: number;
  }): Promise<ExperimentItem> {
    const res = await fetch(`${API_BASE}/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return handleResponse<ExperimentItem>(res);
  },

  async listExperiments(): Promise<ExperimentItem[]> {
    const res = await fetch(`${API_BASE}/experiments`);
    return handleResponse<ExperimentItem[]>(res);
  },

  async getExperiment(id: number): Promise<ExperimentItem> {
    const res = await fetch(`${API_BASE}/experiments/${id}`);
    return handleResponse<ExperimentItem>(res);
  },

  async deleteExperiment(id: number): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/experiments/${id}`, { method: 'DELETE' });
    return handleResponse<{ status: string }>(res);
  },

  getExperimentCsvUrl(id: number): string {
    return `${API_BASE}/experiments/${id}/export/csv`;
  },

  getExperimentJsonUrl(id: number): string {
    return `${API_BASE}/experiments/${id}/export/json`;
  },

  // History
  async listHistorySimulations(limit: number = 50) {
    const res = await fetch(`${API_BASE}/history/simulations?limit=${limit}`);
    return handleResponse<any[]>(res);
  },

  async getHistorySimulation(id: number): Promise<SimulationResponse> {
    const res = await fetch(`${API_BASE}/history/simulations/${id}`);
    return handleResponse<SimulationResponse>(res);
  },

  async deleteHistorySimulation(id: number): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/history/simulations/${id}`, { method: 'DELETE' });
    return handleResponse<{ status: string }>(res);
  },

  // Traces (Phase 3)
  async uploadTrace(formData: FormData): Promise<any> {
    const res = await fetch(`${API_BASE}/traces/upload`, {
      method: 'POST',
      body: formData
    });
    return handleResponse<any>(res);
  },

  async listTraces(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/traces`);
    return handleResponse<any[]>(res);
  },

  async getTraceDetails(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/traces/${id}`);
    return handleResponse<any>(res);
  },

  async getTraceFeatures(id: number): Promise<any> {
    const res = await fetch(`${API_BASE}/traces/${id}/features`);
    return handleResponse<any>(res);
  },

  async sampleTraceWorkload(id: number, req: any): Promise<any> {
    const res = await fetch(`${API_BASE}/traces/${id}/workload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return handleResponse<any>(res);
  },

  async compareTraceWithSynthetic(id: number, req: any): Promise<any> {
    const res = await fetch(`${API_BASE}/traces/${id}/compare-synthetic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    return handleResponse<any>(res);
  },

  // Final Benchmark Matrix & Research Report
  async getFinalResults(): Promise<any> {
    const res = await fetch(`${API_BASE}/final-results`);
    return handleResponse<any>(res);
  },

  async getFinalReport(): Promise<{ report_markdown: string }> {
    const res = await fetch(`${API_BASE}/final-results/report`);
    return handleResponse<{ report_markdown: string }>(res);
  }
};
