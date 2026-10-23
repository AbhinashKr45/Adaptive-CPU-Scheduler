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
    let err = 'An error occurred';
    try {
      const data = await res.json();
      err = data.detail || data.message || JSON.stringify(data);
    } catch {
      err = await res.text() || `HTTP ${res.status}`;
    }
    throw new Error(err);
  }
  return res.json() as Promise<T>;
}

export const api = {
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
  async getRecommendation(processes: ProcessItem[], objective: string = 'minimize_waiting', quantum: number = 2, evaluateHeldOut: boolean = true): Promise<RecommendationResponse> {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processes,
        objective,
        quantum,
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
  }
};
