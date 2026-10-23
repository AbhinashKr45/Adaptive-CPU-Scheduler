export interface ProcessItem {
  pid: number;
  arrival_time: number;
  burst_time: number;
  priority: number;
}

export interface ProcessResultItem extends ProcessItem {
  start_time: number;
  completion_time: number;
  waiting_time: number;
  response_time: number;
  turnaround_time: number;
  executed_time: number;
}

export interface TraceIntervalItem {
  pid: number;
  start_time: number;
  end_time: number;
  is_idle: boolean;
}

export interface AggregateMetricsItem {
  avg_waiting_time: number;
  median_waiting_time: number;
  max_waiting_time: number;
  p95_waiting_time: number;
  waiting_time_std: number;
  avg_turnaround_time: number;
  median_turnaround_time: number;
  avg_response_time: number;
  median_response_time: number;
  max_response_time: number;
  throughput: number;
  cpu_utilization: number;
  total_busy_time: number;
  total_idle_time: number;
  makespan: number;
  context_switches: number;
  preemptions: number;
  starvation_ratio: number;
  starvation_count: number;
  waiting_time_gini: number;
  jain_fairness_cpu: number;
  jain_fairness_progress: number;
  is_cpu_fairness_defined: boolean;
  is_progress_fairness_defined: boolean;
  runtime_jain_fairness?: number;
}

export interface ObservationFairnessItem {
  observation_time: number;
  jain_fairness_cpu: number;
  jain_fairness_progress: number;
  is_cpu_defined: boolean;
  is_progress_defined: boolean;
  processes_arrived: number;
  processes_completed: number;
}

export interface SimulationResponse {
  id?: number;
  status: string;
  algorithm: string;
  quantum: number;
  metrics: AggregateMetricsItem;
  processes: ProcessResultItem[];
  trace: TraceIntervalItem[];
  observation_fairness?: ObservationFairnessItem[];
}

export interface CompareResponse {
  characteristics: WorkloadCharacteristics;
  results: Record<string, SimulationResponse>;
}

export interface WorkloadCharacteristics {
  process_count: number;
  mean_burst: number;
  std_burst: number;
  cv_burst: number;
  min_burst: number;
  max_burst: number;
  skewness: number;
  short_job_ratio: number;
  long_job_ratio: number;
  mean_arrival: number;
  arrival_span: number;
}

export interface WorkloadResponse {
  id: number;
  name: string;
  description?: string;
  process_count: number;
  processes: ProcessItem[];
  generator_config?: any;
  characteristics: WorkloadCharacteristics;
  created_at: string;
}

export interface PresetConfig {
  key: string;
  name: string;
  description: string;
  config: {
    arrival_distribution: string;
    burst_distribution: string;
    mean_burst: number;
    burst_std: number;
    skew_level: string;
    max_arrival: number;
  };
}

export interface ExperimentSummaryStats {
  mean: number;
  median: number;
  std: number;
  ci_low: number;
  ci_high: number;
  min: number;
  max: number;
}

export interface PairedComparisonStats {
  n: number;
  mean_diff: number;
  cohens_dz?: number;
  cohens_d: number;
  hedges_g?: number;
  ci_diff_low?: number;
  ci_diff_high?: number;
  p_value_ttest: number;
  p_value_wilcoxon: number;
  significant_uncorrected?: boolean;
  significant_holm?: boolean;
  significant_at_05: boolean;
  note?: string;
  holm_bonferroni?: {
    original_p: number;
    adjusted_p: number;
    significant_holm: boolean;
    rank: number;
  };
  friedman_omnibus_significant?: boolean;
}

export interface ExperimentItem {
  id: number;
  name: string;
  description?: string;
  status: string;
  schedulers: string[];
  seeds: number[];
  workload_config: any;
  summary: Record<string, Record<string, ExperimentSummaryStats>>;
  paired_comparisons?: Record<string, Record<string, PairedComparisonStats>>;
  raw_runs?: any[];
  created_at: string;
}

export interface RecommendationResponse {
  recommended_scheduler: string;
  objective: string;
  objective_label: string;
  explanation: string;
  workload_characteristics: WorkloadCharacteristics;
  trade_offs: string[];
  alternatives: string[];
  uncertainty: string;
  scores: Record<string, number>;
  all_metrics?: Record<string, AggregateMetricsItem>;
  objective_definition: string;
  weights?: {
    throughput_weight: number;
    fairness_weight: number;
    description: string;
  } | null;
  held_out_evaluation?: {
    target_metric: string;
    objective: string;
    objective_definition: string;
    held_out_seed_count: number;
    adaptive_mean: number;
    adaptive_std: number;
    oracle_mean: number;
    fixed_policies_mean: Record<string, number>;
    recommendations_frequency: Record<string, number>;
    mean_regret: number;
    display_note: string;
    oracle_note: string;
  };
}

export interface OverviewData {
  workload_count: number;
  simulation_count: number;
  experiment_count: number;
  recent_simulations: Array<{
    id: number;
    workload_name: string;
    algorithm: string;
    quantum: number;
    avg_waiting_time: number;
    cpu_utilization: number;
    created_at: string;
  }>;
  recent_experiments: Array<{
    id: number;
    name: string;
    schedulers: string[];
    seed_count: number;
    created_at: string;
  }>;
}
