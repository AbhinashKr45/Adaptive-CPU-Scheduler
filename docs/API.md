# API Reference: Adaptive OS Scheduling Framework

The Adaptive OS Scheduling service provides a RESTful HTTP API on `/api/v1`. All JSON request and response payloads adhere to strict Pydantic v2 schemas.

---

## 1. System & Health

### `GET /api/v1/health`
Verifies backend operational status, database connectivity, and C99 compiler availability.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "Adaptive OS Scheduling API",
  "c_engine": "authoritative",
  "database_connected": true,
  "c_bridge_available": true,
  "c_engine_compiled": true,
  "gcc_available": true
}
```

### `GET /api/v1/overview`
Provides platform-level statistics, database row counts, and recent activity.

---

## 2. Workload Management

### `POST /api/v1/workloads/generate`
Generates a synthetic workload given statistical parameters.

**Request Body:**
```json
{
  "process_count": 10,
  "seed": 42,
  "arrival_distribution": "uniform",
  "burst_distribution": "exponential",
  "mean_burst": 8.0,
  "burst_std": 3.0,
  "max_arrival": 20,
  "min_priority": 1,
  "max_priority": 5
}
```

### `POST /api/v1/workloads`
Creates and persists a named workload.

### `GET /api/v1/workloads`
Lists all persisted workloads.

### `GET /api/v1/workloads/{workload_id}`
Retrieves a specific workload and its statistical characteristics.

### `GET /api/v1/workloads/presets`
Lists curated presets (`standard_balanced`, `bursty_convoy`, `staggered_interactive`, `priority_critical`, `highly_unequal`).

---

## 3. Simulation & Comparison

### `POST /api/v1/simulate`
Executes an authoritative C99 simulation run for a specific algorithm.

**Request Body:**
```json
{
  "algorithm": "RR",
  "quantum": 2,
  "processes": [
    { "pid": 1, "arrival_time": 0, "burst_time": 5, "priority": 1 },
    { "pid": 2, "arrival_time": 2, "burst_time": 3, "priority": 2 }
  ],
  "observe_times": [5, 10]
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "algorithm": "RR",
  "quantum": 2,
  "metrics": {
    "avg_waiting_time": 4.5,
    "median_waiting_time": 4.5,
    "max_waiting_time": 5,
    "p95_waiting_time": 4.95,
    "waiting_time_std": 0.71,
    "avg_turnaround_time": 8.5,
    "median_turnaround_time": 8.5,
    "avg_response_time": 1.0,
    "median_response_time": 1.0,
    "max_response_time": 2,
    "throughput": 0.25,
    "cpu_utilization": 1.0,
    "total_busy_time": 8,
    "total_idle_time": 0,
    "makespan": 8,
    "context_switches": 3,
    "preemptions": 1,
    "starvation_ratio": 0.0,
    "starvation_count": 0,
    "waiting_time_gini": 0.0588,
    "jain_fairness_cpu": 0.9615,
    "jain_fairness_progress": 1.0,
    "is_cpu_fairness_defined": true,
    "is_progress_fairness_defined": true
  },
  "processes": [...],
  "trace": [...]
}
```

### `POST /api/v1/compare`
Executes all candidate schedulers simultaneously on identical input processes for side-by-side evaluation.

---

## 4. Batch Experiments & Statistics

### `POST /api/v1/experiments`
Runs a multi-seed paired experiment batch with automated statistical tests (Friedman omnibus, paired Student's t-test with monotonic Holm-Bonferroni correction, Cohen's $d_z$, Hedges' $g$, and bootstrap 95% CIs).

### `GET /api/v1/experiments/{experiment_id}`
Retrieves summary statistics and pairwise comparisons.

### `GET /api/v1/experiments/{experiment_id}/export/csv`
Exports raw tabular trial data as a downloadable CSV.

---

## 5. Feature-Only Adaptive Recommender

### `POST /api/v1/recommend`
Predicts the optimal scheduling algorithm using strictly static workload features (zero outcome leakage).

**Request Body:**
```json
{
  "processes": [
    { "pid": 1, "arrival_time": 0, "burst_time": 10, "priority": 1 },
    { "pid": 2, "arrival_time": 1, "burst_time": 2, "priority": 1 }
  ],
  "objective": "minimize_waiting",
  "quantum": 2,
  "selector_mode": "rule_based",
  "evaluate_held_out": true
}
```

**Response (200 OK):**
```json
{
  "recommended_scheduler": "SRTF",
  "selector_mode": "rule_based",
  "objective": "minimize_waiting",
  "explanation": "Feature-Only Adaptive Decision (Rule Based): Recommended SRTF based on workload features: burst_cv=0.94, arrival_span=1, burstiness=0.80, heavy_tail_index=1.50.",
  "features": {
    "process_count": 2,
    "arrival_span": 1,
    "arrival_rate": 2.0,
    "burst_mean": 6.0,
    "burst_cv": 0.9428,
    "burstiness": 0.8,
    "heavy_tail_index": 1.5
  },
  "scores": { "SRTF": -3.0, "SJF": -4.0, "FCFS": -6.0 },
  "zero_leakage_guarantee": true,
  "held_out_validation": {
    "empirical_mean_regret": 0.12,
    "empirical_std_regret": 0.35,
    "test_seed_count": 200,
    "oracle_optimal_accuracy": 0.88,
    "guarantee": "Strict zero-leakage held-out evaluation on disjoint seeds [3000..3199]"
  }
}
```

---

## 6. Trace Laboratory

### `POST /api/v1/traces/upload`
Uploads an empirical trace file (SWF or CSV), or loads bundled supercomputer benchmark data. Maximum upload payload: 10 MB.

### `GET /api/v1/traces`
Lists all loaded trace datasets.

### `GET /api/v1/traces/{trace_id}/features`
Retrieves distributional moments and the Hill heavy-tail estimator.

### `POST /api/v1/traces/{trace_id}/workload`
Samples and scales trace jobs into a discrete-event simulator workload with guaranteed arrival sorting and scaling loss metrics.

### `POST /api/v1/traces/{trace_id}/compare-synthetic`
Finds the best synthetic generator parameters matching the empirical trace using 2-sample KS tests and Wasserstein distance.

---

## 7. Research Matrix & Artifacts

### `GET /api/v1/final-results`
Returns complete 30-seed $\times$ 5-workload benchmark JSON results.

### `GET /api/v1/final-results/report`
Returns the authoritative markdown academic report (`REPORT.md`).
