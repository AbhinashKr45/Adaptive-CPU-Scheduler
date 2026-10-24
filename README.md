# Adaptive OS CPU Scheduling & Performance Analysis Framework

A research-grade single-CPU scheduling simulation, fairness evaluation, trace-informed workload modeling, statistical experimentation, and feature-only adaptive recommendation platform.

This platform couples an **authoritative, discrete-event C99 scheduling engine** with a high-performance **FastAPI backend** and a modern **React 19 / TypeScript / Vite research dashboard**. It is designed for studying, benchmarking, and discovering workload-aware adaptive scheduling policies across classic operating systems algorithms.

---

## Table of Contents

1. [Key Capabilities](#key-capabilities)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Repository Structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Quickstart Guide](#quickstart-guide)
   - [Native Local Setup](#1-native-local-setup)
   - [Docker Deployment](#2-docker-deployment)
6. [Testing & Verification](#testing--verification)
   - [C Unit Test Suite](#1-c-unit-test-suite)
   - [Python Backend Test Suite](#2-python-backend-test-suite)
   - [Frontend Vitest Suite](#3-frontend-vitest-suite)
   - [End-to-End Scenario Verification](#4-end-to-end-scenario-verification)
7. [Authoritative 30-Seed Research Benchmark](#authoritative-30-seed-research-benchmark)
8. [Feature-Only Adaptive Recommender](#feature-only-adaptive-recommender)
9. [Fairness & Starvation Metrics](#fairness--starvation-metrics)
10. [Trace-Informed Workload Pipeline](#trace-informed-workload-pipeline)
11. [License](#license)

---

## Key Capabilities

- **Authoritative C99 Core Engine**:
  - Discrete-event single-CPU simulator written in strict ISO C99 (`-Wall -Wextra -Wpedantic -std=c99`).
  - Zero clock drift; guaranteed conservation of CPU service ($\sum executed = busy$) and makespan conservation ($makespan = busy + idle$).
  - Five core schedulers: **FCFS**, **SJF**, **SRTF**, **PRIORITY**, and **Round Robin (RR)** with configurable quantum $q \ge 1$.
- **Advanced Fairness & Starvation Metrics Subsystem**:
  - **Dual Jain's Fairness**: Raw CPU Allocation Fairness $J(\mathbf{x})$ and Demand-Relative Progress Fairness $J(\mathbf{F})$.
  - **Waiting Time Distribution**: Standard deviation $\sigma_w$, 95th percentile $p_{95}$, and Gini coefficient $G \in [0, 1]$.
  - **Starvation Detection**: Flags processes where individual waiting time $w_i > 3\bar{w}$.
- **Trace-Informed Supercomputer Pipeline**:
  - Parser for Standard Workload Format (SWF) 18-column logs and generic CSV traces.
  - Automated cleaning pipeline: non-positive runtimes removed, zero-processor anomalies handled, 99th-percentile tail outliers separated.
  - Minimal MAE time scaling, chronological sampling, and distribution matching via 2-sample Kolmogorov-Smirnov and 1D Wasserstein distance.
- **Strictly Feature-Only Adaptive Policy Recommender**:
  - Zero Outcome Leakage: Schedulers are **never simulated on the target workload during prediction**.
  - Decisions based purely on 7 static workload features ($n$, arrival span, arrival rate, burst mean, burst CV, burstiness index, heavy-tail Pareto index).
  - Evaluated on strictly disjoint test seeds ($3000..3199$) against the ex-post oracle baseline, reporting honest empirical regret ($R \ge 0$).
- **Rigorous Statistical Analysis**:
  - Omnibus Friedman rank test across all schedulers simultaneously.
  - Strictly monotonic step-down Holm-Bonferroni FWER correction for multiple pairwise comparisons.
  - Paired Cohen's $d_z$ and small-sample Hedges' $g$ effect sizes.
  - Seeded 1,000-resample non-parametric bootstrap 95% confidence intervals.
- **Interactive Research Dashboard**:
  - Built with React 19, TypeScript, Vite, and Recharts.
  - Interactive SVG-rendered Gantt chart, dynamic progress fairness trajectory line charts, grouped performance bar charts with 95% CIs.
  - Resilient UI architecture protected by a top-level React `ErrorBoundary`, responsive down to 768px tablet viewports.

---

## Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│              React 19 + TypeScript + Vite UI                │
│    (Recharts Analytics, Interactive Gantt, ErrorBoundary)   │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP / JSON REST APIs
┌──────────────────────────────▼──────────────────────────────┐
│                  Python 3.12 / FastAPI                      │
│     (Workload Generator, Statistical Engine, Recommender)   │
│               SQLAlchemy ORM (SQLite Database)              │
└──────────────────────────────▲──────────────────────────────┘
                               │ Subprocess JSON IPC Protocol
┌──────────────────────────────▼──────────────────────────────┐
│            Authoritative C99 Scheduling Core Core           │
│  - src/core/process.c        (Validation & Lifecycle Model) │
│  - src/core/simulation.c     (Discrete Event Engine & Trace)│
│  - src/core/metrics.c        (Turnaround, Wait, Dual Jain)  │
│  - src/schedulers/*.c        (FCFS, SJF, SRTF, Priority, RR)│
│  - scheduler_cli             (Standalone Engine CLI Tool)   │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Scheduling Core** | ISO C99, MinGW / GCC / Clang, Make |
| **Backend Service** | Python 3.12, FastAPI, Pydantic v2, Uvicorn, NumPy, SciPy, Pandas |
| **Database** | SQLAlchemy 2.0, SQLite (`adaptive_scheduling.db`) |
| **Testing** | C unit tests, Pytest 9, Starlette TestClient, Vitest 5, Testing Library |
| **Frontend UI** | React 19, TypeScript, Vite, Recharts, Lucide Icons, Pure CSS Tokens |
| **Deployment** | Multi-stage Dockerfile, Docker Compose, GitHub Actions CI |

---

## Repository Structure

```
Adaptive-OS-Scheduling/
├── .github/workflows/ci.yml       # Automated CI pipeline
├── backend/                       # FastAPI application & research logic
│   ├── api.py                     # REST endpoints & static asset mounts
│   ├── c_bridge.py                # Subprocess bridge to C engine
│   ├── generator.py              # Workload generators & preset library
│   ├── recommender.py            # Feature-only adaptive recommender
│   ├── statistics.py             # Holm-Bonferroni, Cohen's d_z, Friedman test
│   ├── traces/                   # SWF & CSV parsers, cleaners, scalers, KS tests
│   └── run_final_experiments.py  # 30-seed authoritative benchmark script
├── frontend/                      # React 19 + TypeScript dashboard
│   ├── src/components/           # Gantt, MetricsCards, ErrorBoundary, Navbar
│   ├── src/pages/                # 9 research views + TraceLab + FinalResults
│   └── src/test/                 # Vitest test suite (api, components, pages)
├── results/                       # Authoritative benchmark results
│   ├── experiments_results.csv   # Raw 750-run matrix
│   ├── experiments_results.json  # Complete statistical JSON payload
│   └── REPORT.md                 # Generated research report
├── src/                           # Authoritative C99 discrete-event engine
│   ├── core/                     # process.c, simulation.c, metrics.c
│   └── schedulers/               # fcfs.c, sjf.c, srtf.c, priority.c, round_robin.c
├── tests/                         # C unit test suites (test_metrics, test_simulation)
├── Dockerfile                     # Multi-stage production container
├── docker-compose.yml             # Single-command stack launch
├── Makefile                       # Cross-platform build automation
├── test_e2e_scenario.py           # 12-step complete integration test
└── requirements.txt               # Pinned Python dependencies
```

---

## Prerequisites

- **C Compiler**: GCC (MinGW on Windows, native GCC on Linux) with C99 support.
- **Python**: Python 3.12+ with `pip`.
- **Node.js**: Node 20+ with `npm`.
- **Docker** *(Optional)*: Docker 24+ and Docker Compose v2.

---

## Quickstart Guide

### 1. Native Local Setup

#### Step A: Compile C Scheduling Engine
```bash
gcc -Wall -Wextra -Wpedantic -std=c99 -Isrc \
  src/core/process.c src/core/metrics.c src/core/simulation.c \
  src/schedulers/fcfs.c src/schedulers/sjf.c src/schedulers/srtf.c \
  src/schedulers/priority.c src/schedulers/round_robin.c \
  main.c -o scheduler_cli
```
*(On Windows, the output file is `scheduler_cli.exe`)*.

#### Step B: Set Up Python Backend
```bash
pip install -r requirements.txt
uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload
```
Backend API will be live at: `http://127.0.0.1:8000/api/v1/health`

#### Step C: Launch Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
Dashboard will open at: `http://localhost:3000`

---

### 2. Docker Deployment

Deploy the entire stack (built C engine, FastAPI backend, and compiled frontend assets) with a single command:
```bash
docker-compose up --build
```
Navigate your browser to `http://localhost:8000`.

---

## Testing & Verification

The framework enforces continuous verification across all three layers:

### 1. C Unit Test Suite
```bash
gcc -Wall -Wextra -Wpedantic -std=c99 -Isrc \
  src/core/process.c src/core/metrics.c src/core/simulation.c \
  src/schedulers/fcfs.c src/schedulers/sjf.c src/schedulers/srtf.c \
  src/schedulers/priority.c src/schedulers/round_robin.c \
  tests/test_metrics.c -o tests/bin/test_metrics
./tests/bin/test_metrics

gcc -Wall -Wextra -Wpedantic -std=c99 -Isrc \
  src/core/process.c src/core/metrics.c src/core/simulation.c \
  src/schedulers/fcfs.c src/schedulers/sjf.c src/schedulers/srtf.c \
  src/schedulers/priority.c src/schedulers/round_robin.c \
  tests/test_simulation.c -o tests/bin/test_simulation
./tests/bin/test_simulation
```

### 2. Python Backend Test Suite
```bash
pytest --cov=backend backend/tests
```
*(35 passing tests covering API endpoints, recommender leakage tests, statistics, and trace pipelines)*.

### 3. Frontend Vitest Suite
```bash
cd frontend
npm test
npm run lint
npm run build
```
*(11 passing unit and integration tests across API clients, UI components, and pages)*.

### 4. End-to-End Scenario Verification
```bash
python test_e2e_scenario.py
```
*(Executes a 12-step end-to-end integration scenario validating workload generation, C engine simulations, trace integrity, fairness calculations, adaptive recommendation, and database reload)*.

---

## Authoritative 30-Seed Research Benchmark

To reproduce the full 750-trial empirical experiment matrix:
```bash
# Fast verification run (3 seeds):
python backend/run_final_experiments.py --quick

# Full authoritative benchmark run (30 seeds, 750 total simulations):
python backend/run_final_experiments.py
```

The results are saved in `results/`:
- `results/experiments_results.csv`: Complete raw execution runs.
- `results/experiments_results.json`: Full metrics, p-values, effect sizes, and bootstrap CIs.
- `results/REPORT.md`: Comprehensive academic markdown report.

### Summary of Benchmark Findings
- **Waiting Time Minimization**: SRTF consistently delivers minimal average waiting time across burst-variable workloads due to preemptive clearance of arriving short tasks.
- **Fairness Nuance**: Round Robin maximizes raw CPU allocation equality ($J(\mathbf{x}) \approx 0.95$), but under heterogeneous job lengths, demand-relative progress fairness $J(\mathbf{F})$ shows that SRTF and SJF advance short jobs without causing disproportionate starvation on moderate loads.
- **Holm-Bonferroni Significance**: All pairwise comparisons against FCFS are statistically significant with monotonic adjusted $p < 0.001$ on high-variance workloads.

---

## Feature-Only Adaptive Recommender

Traditional recommender prototypes often leak simulation results by testing each algorithm on the workload before answering. Our recommender is **strictly feature-only**:
1. **Zero Outcome Leakage**: Input workloads are mapped to a 7-dimensional feature vector without executing any candidate schedulers during inference.
2. **Honest Regret Validation**: Validated on strictly disjoint held-out seeds ($3000..3199$). Evaluates the difference against the theoretical ex-post oracle:
   $$\text{Regret} = M_{\text{chosen}} - M_{\text{oracle}} \ge 0$$
3. **Calibrated Rules & Decision Trees**: Transparent rules provide clear explanations (e.g. detecting high burst coefficient of variation $CV_B \ge 0.457$ to recommend SRTF).

---

## License

This project is licensed under the [MIT License](LICENSE).
