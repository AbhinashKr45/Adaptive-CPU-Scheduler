# System Architecture: Adaptive OS Scheduling Framework

## 1. Overview and High-Level Topology

The **Adaptive OS Scheduling and Performance Analysis Framework** is a research-grade platform designed for deterministic CPU scheduling simulation, workload characterization, rigorous statistical benchmarking, and feature-only adaptive policy recommendation.

The architecture strictly decouples low-level deterministic discrete-event simulation from the higher-level API, machine learning recommender, and presentation layers:

```
+-----------------------------------------------------------------------+
|                 React 19 + TypeScript + Vite Frontend                 |
|   (Interactive Gantt, Recharts Analytics, Trace Lab, ErrorBoundary)  |
+-----------------------------------------------------------------------+
                                   |  HTTP / JSON (REST API)
                                   v
+-----------------------------------------------------------------------+
|                        FastAPI Backend Service                        |
|  - REST Endpoints (Workloads, Simulation, Comparison, Recommender)   |
|  - SQLite Database via SQLAlchemy ORM (Full Run & Trace Persistence)  |
|  - Empirical Trace Pipeline (SWF / CSV Clean, Scale, Sample)          |
|  - Strictly Feature-Only Adaptive Policy Recommender (Zero Leakage)   |
|  - Statistical Engine (Holm-Bonferroni, Cohen's d_z, Hedges' g, CIs)  |
+-----------------------------------------------------------------------+
                                   |  Subprocess IPC (JSON stdin/stdout)
                                   v
+-----------------------------------------------------------------------+
|               Authoritative C99 CPU Scheduling Engine                 |
|  - Deterministic Discrete-Event Execution Loop (simulation.c)         |
|  - Core Process Lifecycle & Trace Event Logging (process.c)          |
|  - Schedulers: FCFS, SJF, SRTF, PRIORITY, Round Robin                |
|  - Metrics: Turnaround, Waiting, Jain's Index, Gini, p95, Starvation  |
+-----------------------------------------------------------------------+
```

---

## 2. Low-Level Core C99 Scheduling Engine (`src/` and `main.c`)

### 2.1 Design Invariants
1. **Zero Clock Drift**: Time advances deterministically discrete tick by discrete tick ($t \in \mathbb{N}_0$).
2. **Conservation of CPU Service**: At every step $T$, $\sum_{i=1}^n \text{executed\_time}_i = \text{total\_busy\_time}$.
3. **Makespan Integrity**: $\text{makespan} = \text{total\_busy\_time} + \text{total\_idle\_time}$.
4. **Strict Standard Conformance**: Compiles under `-Wall -Wextra -Wpedantic -std=c99` with 0 warnings.
5. **Memory Safety**: Clean heap allocation and deterministic teardown (`process_destroy`, `simulation_result_free`) without memory leaks.

### 2.2 Schedulers Implemented
- **First-Come, First-Served (FCFS)**: Non-preemptive, chronological FIFO queue.
- **Shortest Job First (SJF)**: Non-preemptive, selects process with minimum initial burst length $B_i$.
- **Shortest Remaining Time First (SRTF)**: Fully preemptive discrete-tick scheduler, continuously executing process with minimum remaining burst $r_i(t)$.
- **Non-Preemptive Priority**: Ties broken chronologically; lower numerical value signifies higher priority.
- **Round Robin (RR)**: Preemptive cyclic queue with configurable quantum $q \ge 1$. Supports cooperative burst-completion early exit and FIFO preemption requeueing.

### 2.3 Advanced Metrics Subsystem (`src/core/metrics.c`)
- **Waiting Time Distribution**: Mean $\bar{w}$, median, standard deviation $\sigma_w$, and 95th percentile $p_{95}$.
- **Gini Coefficient of Waiting Times ($G$)**:
  $$G = \frac{\sum_{i=1}^n \sum_{j=1}^n |w_i - w_j|}{2 n^2 \bar{w}}$$
- **Starvation Detection**: Any process where $w_i > 3 \cdot \bar{w}$ is formally classified as starved.
- **Dual-Perspective Jain's Fairness**:
  1. *Raw CPU Allocation Fairness*: $J(x) = \frac{(\sum x_i)^2}{n \sum x_i^2}$, evaluating raw slice parity.
  2. *Demand-Relative Progress Fairness*: $J(F) = \frac{(\sum f_i)^2}{n \sum f_i^2}$ where $f_i = \min(x_i / B_i, 1.0)$, correctly reflecting fairness across heterogeneous job lengths.

---

## 3. Communication Bridge (`backend/c_bridge.py`)

Rather than fragile in-process ctypes pointer passing across heterogeneous ABIs, the backend interfaces with the C engine via an isolated CLI subprocess protocol:
- Input: JSON document describing processes `[{pid, arrival_time, burst_time, priority}]`, target scheduler, quantum, and optional observation times.
- Output: Strict JSON schema emitted to `stdout` containing aggregate metrics, per-process life cycles, and complete trace intervals.
- Isolation: Memory corruption or abnormal exit in simulation cannot crash the web service.

---

## 4. Backend Service Architecture (`backend/`)

### 4.1 Persistence Layer (`models.py`, `database.py`)
- Built on SQLAlchemy with SQLite (`adaptive_scheduling.db`).
- Persistent entities:
  - `Workload`: Saved process sets and generator metadata.
  - `SimulationRun`: Complete individual runs with metrics and execution logs.
  - `Experiment`: Multi-seed batch evaluations.
  - `TraceRecord`: Raw and cleaned supercomputer/cloud trace archives.
  - `RecommendationRecord`: Inputs, extracted features, model explanations, and held-out regret.

### 4.2 Trace-Informed Pipeline (`backend/traces/`)
- Supports Standard Workload Format (SWF) and arbitrary CSV telemetry.
- Cleans anomalies: non-positive runtimes, negative arrival offsets, and upper-percentile tail outliers.
- Scales wall-clock runtimes to discrete simulation ticks with minimum mean absolute error (MAE).
- Performs chronological or stratified sampling.
- Computes Kolmogorov-Smirnov statistics and Wasserstein distances to calibrate synthetic workload distributions.

### 4.3 Feature-Only Adaptive Recommender (`backend/recommender.py`)
- **Strict Zero-Leakage Guarantee**: The recommender extracts 7 static features purely from process arrival times, burst lengths, and priorities ($n$, arrival span, arrival rate, burst mean, burst CV, burstiness index, heavy-tail index).
- **No Simulation During Prediction**: Never executes candidate schedulers on the target workload during inference.
- **Empirical Regret Evaluation**: Validated on strictly disjoint held-out test seeds ($3000..3199$) against the ex-post oracle baseline:
  $$\text{Regret} = M_{\text{chosen}} - M_{\text{oracle}} \ge 0$$

---

## 5. Frontend Presentation Layer (`frontend/`)

- **Modern Stack**: React 19, TypeScript, Vite.
- **Data Visualization**: Recharts for grouped bar charts with 95% bootstrap confidence intervals, dynamic progress fairness trajectories, and workload distribution histograms.
- **Gantt Chart Visualization**: Interactive SVG-rendered timeline with execution intervals, context switches, preemption markers, and idle periods.
- **Reliability & Resilience**: React `ErrorBoundary` wraps the entire view tree, preventing localized render exceptions from crashing the application.
- **Responsive Design System**: Tailored dark-mode CSS tokens, fluid layouts responsive down to 768px tablet viewports, and WCAG-compliant keyboard focus outlines.
