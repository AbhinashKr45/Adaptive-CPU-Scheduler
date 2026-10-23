# Adaptive OS CPU Scheduling & Performance Analysis Platform

A research-grade single-CPU scheduling simulation, fairness evaluation, statistical experimentation, and adaptive recommendation platform.

This platform couples an **authoritative, discrete-event C scheduling engine** with a high-performance **FastAPI backend** and a modern **React/TypeScript research dashboard**. It is designed for studying, comparing, and discovering workload-aware adaptive scheduling policies across classic operating systems algorithms.

---

## Table of Contents

1. [Features](#features)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Repository Structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Environment Variables](#environment-variables)
7. [Compiling the C Engine](#compiling-the-c-engine)
8. [Running Tests](#running-tests)
   - [C Test Suite](#1-c-test-suite)
   - [Backend Python Test Suite](#2-backend-python-test-suite)
   - [End-to-End Verification Scenario](#3-end-to-end-verification-scenario)
9. [Launching the Application](#launching-the-application)
   - [Starting the Backend](#1-starting-the-backend)
   - [Starting the Frontend](#2-starting-the-frontend)
   - [Running Both Concurrently](#3-launching-the-full-platform)
10. [Database Initialization & Persistence](#database-initialization--persistence)
11. [User Guide & Workflows](#user-guide--workflows)
    - [Page A: Overview Dashboard](#page-a--overview-dashboard)
    - [Page B: Workload Laboratory](#page-b--workload-laboratory)
    - [Page C: Scheduler Simulator & Interactive Gantt](#page-c--scheduler-simulator--interactive-gantt)
    - [Page D: Side-by-Side Comparison Matrix](#page-d--side-by-side-comparison-matrix)
    - [Page E: Experiment Studio](#page-e--experiment-studio)
    - [Page F: Research Analytics](#page-f--research-analytics)
    - [Page G: Explainable Adaptive Recommendations](#page-g--explainable-adaptive-recommendations)
    - [Page H: Experiment History & Data Export](#page-h--experiment-history--data-export)
    - [Page I: In-App Methodology Guide](#page-i--in-app-methodology-guide)
12. [Reproducing an Example Run](#reproducing-an-example-run)
13. [Known Limitations](#known-limitations)

---

## Features

- **Authoritative C Core**: Discrete-event CPU scheduling engine written in pure C99/C11 with strict compilation flags (`-Wall -Wextra -Wpedantic`), producing deterministic execution traces and zero mock metrics.
- **Five Classic Scheduling Algorithms**:
  - **FCFS** (First-Come, First-Served): Non-preemptive, deterministic PID tie-breaking for simultaneous arrivals.
  - **SJF** (Shortest Job First): Non-preemptive, minimal original burst, PID tie-breaking.
  - **SRTF** (Shortest Remaining Time First): Preemptive, shortest remaining burst, non-preempting on equal ties.
  - **Priority Scheduling**: Non-preemptive, lower numerical value = higher priority, PID tie-breaking.
  - **Round Robin (RR)**: Preemptive, configurable positive quantum ($q \ge 1$), strict FIFO ready queue, handles simultaneous arrivals, arrivals during execution, quantum expiration, and completion at boundaries.
- **Dual Fairness & Observation-Time Metrics**:
  - **Jain's Raw CPU Allocation Fairness Index $J(x)$**: Measures strict equality of executed CPU cycles:
    $$J(x) = \frac{(\sum x_i)^2}{n \sum x_i^2}$$
  - **Demand-Relative Progress Fairness Index $J(F)$**: Measures proportional progress relative to process demand:
    $$F_i(T) = \min\left(\frac{A_i(T)}{D_i}, 1.0\right) \quad \longrightarrow \quad J(F) = \frac{(\sum F_i)^2}{n \sum F_i^2}$$
  - **Observation-Time Dynamic Fairness**: Evaluated at configurable observation points $T$ from actual execution traces across identical process populations. While fully completed workloads generally reach $J(F) = 1.0$ (since all processes finish their burst) and final $J(x)$ reflects declared burst variance, intermediate observation reveals how preemptive schedulers (e.g. Round Robin) maintain concurrent progress fairness versus non-preemptive queuing.
- **Interactive Execution Gantt Charts**: High-precision timeline visualization with colored process blocks, duration badges, and striped CPU idle intervals with tooltips.
- **Reproducible Synthetic Workload Generation**: Deterministic random seed controls, variable process counts, arrival distributions (uniform, staggered, bursty, simultaneous), and burst distributions (normal, exponential, Pareto right-skewed, uniform) with coefficient of variation ($CV = \sigma / \mu$).
- **Paired Statistical Batch Experiments**: Evaluates identical workload seeds across all algorithms to eliminate sampling noise. Computes 95% Student's t confidence intervals, paired differences ($\Delta$), Cohen's $d$ effect sizes, paired t-tests, and Wilcoxon signed-rank tests with Holm-Bonferroni step-down correction for multiple comparisons.
- **Explainable Adaptive Recommendations**: Transparent, statistically informed decision layer evaluating all five policies against explicit objectives (Minimize Waiting, Minimize Response, Balance Fairness & Performance with exposed 50/50 weights, Penalize Context Switches). Evaluates on held-out seeds with zero outcome leakage, compares against all five fixed schedulers, and quantifies regret against a theoretical ex-post Oracle baseline.
- **Full Database Persistence**: SQLAlchemy storage layer supporting SQLite for local zero-config runs and PostgreSQL for production.
- **Data Export**: Export workloads, simulation traces, and experimental matrices to CSV and JSON.

---

## Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│              React 19 + TypeScript + Vite UI                │
│ (Navy/Blue Design System, Interactive Gantt, 9 Research Views)│
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP / JSON REST APIs
┌──────────────────────────────▼──────────────────────────────┐
│                  Python 3.12 / FastAPI                      │
│     (Workload Generator, Statistical Engine, Recommender)   │
│             SQLAlchemy ORM (SQLite / PostgreSQL)            │
└──────────────────────────────▲──────────────────────────────┘
                               │ Subprocess JSON IPC / Direct DLL
┌──────────────────────────────▼──────────────────────────────┐
│            Authoritative C99/C11 Scheduling Core            │
│  - src/core/process.c        (Validation & Lifecycle Model) │
│  - src/core/simulation.c     (Discrete Event Engine & Trace)│
│  - src/core/metrics.c        (Turnaround, Wait, Dual Jain)  │
│  - src/schedulers/*.c        (FCFS, SJF, SRTF, Priority, RR)│
│  - scheduler_cli.exe         (Standalone CLI & Engine Tool) │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Scheduling Core** | C99 / C11, MinGW / GCC / Clang, Make |
| **Backend API** | Python 3.12, FastAPI, Pydantic v2, Uvicorn, NumPy, SciPy, Pandas |
| **Persistence** | SQLAlchemy 2.0 (SQLite local default, PostgreSQL supported) |
| **Testing** | C test binaries (asserts), Pytest 9, Starlette TestClient |
| **Frontend** | React 19, TypeScript, Vite, Lucide Icons, Pure CSS Design System |

---

## Repository Structure

```
.
├── backend/                    # Python FastAPI application
│   ├── api.py                  # Versioned REST API endpoints (/api/v1/...)
│   ├── c_bridge.py             # Authoritative C engine invocation & IPC
│   ├── database.py             # SQLAlchemy engine & session manager
│   ├── experiments.py          # Paired batch runner & statistical engine
│   ├── generator.py            # Reproducible workload generator & presets
│   ├── models.py               # Database persistence tables
│   ├── recommender.py          # Explainable adaptive recommendation layer
│   ├── schemas.py              # Pydantic request/response schemas
│   └── tests/                  # Pytest backend test suite
│       └── test_backend.py
├── frontend/                   # React + TypeScript + Vite web dashboard
│   ├── src/
│   │   ├── components/         # Navbar, GanttChart, MetricsCards, ProcessTable
│   │   ├── pages/              # 9 Full research pages (Overview to Guide)
│   │   ├── services/api.ts     # Type-safe API client
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── App.tsx             # Main routing & state container
│   │   └── index.css           # Curated navy/blue design system
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.app.json
├── src/                        # Authoritative C Engine Sources
│   ├── core/
│   │   ├── process.h / .c      # Process struct, validation, metrics tracking
│   │   ├── scheduler.h         # Scheduler interface & function pointers
│   │   ├── simulation.h / .c   # Discrete-event simulation & trace generator
│   │   └── metrics.h / .c      # Jain's raw & progress fairness, aggregates
│   └── schedulers/
│       ├── fcfs.h / .c         # First-Come, First-Served scheduler
│       ├── sjf.h / .c          # Shortest Job First scheduler
│       ├── srtf.h / .c         # Shortest Remaining Time First scheduler
│       ├── priority.h / .c     # Priority Scheduling (lower = higher prio)
│       └── round_robin.h / .c  # Round Robin scheduler with FIFO queue
├── tests/                      # C Unit & Simulation Test Suite
│   ├── test_fcfs.c
│   ├── test_sjf.c
│   ├── test_srtf.c
│   ├── test_priority.c
│   ├── test_rr.c               # Comprehensive Round Robin test suite
│   ├── test_process.c
│   ├── test_scheduler.c
│   ├── test_simulation.c
│   ├── test_metrics.c          # Per-process & dual Jain's fairness tests
│   └── test_comprehensive.c    # 5-algorithm comparative & edge case tests
├── main.c                      # C CLI engine emitting structured JSON
├── main.py                     # Python server launcher
├── Makefile                    # C build & test automation
├── test_e2e_scenario.py        # Complete 12-step verification script
├── requirements.txt            # Python dependencies
└── .env.example                # Example environment variables
```

---

## Prerequisites

Ensure the following tools are installed on your workstation:

1. **C Compiler**: GCC (MinGW for Windows, or native GCC/Clang on Linux/macOS) supporting C99/C11.
2. **Python**: Python 3.10+ (tested on Python 3.12.5).
3. **Node.js**: Node.js v18+ and npm (tested on Node v24.12.0 and npm 11.6.2).

---

## Installation & Setup

### 1. Clone & Setup Python Environment

```bash
# Clone the repository
git clone https://github.com/your-username/Adaptive-OS-Scheduling.git
cd Adaptive-OS-Scheduling

# Install Python dependencies
py -m pip install -r requirements.txt
```

### 2. Setup Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Environment Variables

Copy `.env.example` to `.env` if custom configurations are desired:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `HOST` | `127.0.0.1` | Backend host address |
| `PORT` | `8000` | Backend port |
| `DATABASE_URL` | `sqlite:///./adaptive_scheduling.db` | SQLAlchemy connection string |
| `VITE_PORT` | `3000` | Frontend dev server port |

---

## Compiling the C Engine

The C engine can be compiled using `make` or directly with `gcc`:

### Using Make

```bash
# Build both scheduler_cli.exe and scheduler.dll
make all
```

### Direct GCC Command

```bash
gcc -Wall -Wextra -Wpedantic -std=c99 -Isrc src/core/*.c src/schedulers/*.c main.c -o scheduler_cli.exe
```

Test the compiled CLI by running a sample workload directly:

```powershell
'[{"pid":1,"arrival_time":0,"burst_time":6,"priority":2},{"pid":2,"arrival_time":1,"burst_time":3,"priority":1}]' | ./scheduler_cli.exe --algorithm RR --quantum 2
```

---

## Running Tests

### 1. C Test Suite

To compile and run all C unit and integration tests:

```bash
# Compile and run via Makefile
make test
```

Or run individual test suites:

```bash
# Round Robin unit test suite
gcc -Wall -Wextra -std=c99 -Isrc src/core/*.c src/schedulers/*.c tests/test_rr.c -o test_rr.exe
./test_rr.exe

# Metrics and Jain's fairness test suite
gcc -Wall -Wextra -std=c99 -Isrc src/core/*.c src/schedulers/*.c tests/test_metrics.c -o test_metrics.exe
./test_metrics.exe

# Comprehensive multi-algorithm test suite
gcc -Wall -Wextra -std=c99 -Isrc src/core/*.c src/schedulers/*.c tests/test_comprehensive.c -o test_comprehensive.exe
./test_comprehensive.exe
```

### 2. Backend Python Test Suite

Execute the backend pytest suite covering C bridge invocation, workload generation, paired experiments, adaptive recommendations, and REST APIs:

```bash
py -m pytest backend/tests/test_backend.py -v
```

### 3. End-to-End Verification Scenario

Execute the master 12-step verification scenario verifying workloads, simulations, Gantt traces, paired experiments, dual fairness measures, adaptive recommendations, database persistence, CSV/JSON exports, and invalid input rejection:

```bash
py test_e2e_scenario.py
```

---

## Launching the Application

### 1. Starting the Backend

Launch the FastAPI backend server on `http://127.0.0.1:8000`:

```bash
py main.py
```

You can view the interactive OpenAPI documentation at: `http://127.0.0.1:8000/docs`

### 2. Starting the Frontend

In a separate terminal, start the Vite development server:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your web browser.

### 3. Launching the Full Platform

To run both services simultaneously in Windows PowerShell:

```powershell
# Terminal 1: Backend
py main.py

# Terminal 2: Frontend
cd frontend; npm run dev
```

---

## Database Initialization & Persistence

The application uses SQLAlchemy with automatic database schema initialization:

- **Local Zero-Config (Default)**: SQLite database file `adaptive_scheduling.db` created automatically in the root folder upon startup.
- **PostgreSQL**: Set `DATABASE_URL=postgresql://user:password@localhost:5432/dbname` in your environment.
- All saved workloads, simulation runs, trace intervals, per-process metrics, batch experiments, and recommendations are persisted and persist across server restarts.

---

## User Guide & Workflows

### Page A — Overview Dashboard
Displays live database statistics (count of saved workloads, simulations, and experiments), shortcuts to launch core workflows, and recent simulation history.

### Page B — Workload Laboratory
- **Standard Presets**: Balanced, Short-Job-Heavy, Long-Job-Heavy, Bimodal Mixed, Low/Medium/High Variability, and Staggered Arrivals.
- **Parametric Synthesizer**: Configurable process count, random seed, arrival distributions, and burst distributions (Gaussian, Exponential, Pareto).
- **Manual Editor**: Add, adjust, or delete individual processes (PID, arrival time, burst length, priority).
- **Live Statistical Properties**: Calculates mean burst, variance, coefficient of variation ($CV = \sigma / \mu$), and skewness.
- **Persistence & Export**: Save to database, export to CSV/JSON, or import from files.

### Page C — Scheduler Simulator & Interactive Gantt
- Select any of the 5 algorithms: FCFS, SJF, SRTF, Priority, or Round Robin.
- For Round Robin, adjust the positive time quantum `q`.
- View the interactive Gantt chart displaying exact interval boundaries, process colors, and gray striped CPU idle intervals. Hover over any block to inspect exact tick ranges.
- Inspect aggregate metrics (Waiting, Turnaround, Response, Utilization, Context Switches, Preemptions, Jain's fairness indices).
- Inspect the per-process lifecycle table.

### Page D — Side-by-Side Comparison Matrix
- Runs all 5 algorithms simultaneously on the identical workload.
- Side-by-side comparison table with clear indicators of whether each dimension is better higher ($\blacktriangle$) or lower ($\blacktriangledown$).
- Highlights best-performing policies with star badges.
- Click any algorithm button to immediately inspect its Gantt chart.

### Page E — Experiment Studio
- Design experimental matrices by selecting policies, random seed lists (e.g. `42, 43, 44, 45, 46`), and workload parameters.
- View the estimated run count ($N_{schedulers} \times N_{seeds}$) before launching.
- Execute the batch with real-time feedback and review mean $\pm$ 95% confidence intervals.
- Export raw experiment runs to CSV or JSON.

### Page F — Research Analytics
- Visualizes mean waiting time with 95% confidence interval whisker bars.
- Paired difference analysis against FCFS baseline showing Cohen's $d$ effect sizes, paired t-test p-values, and Wilcoxon signed-rank tests.
- Compares Jain's raw CPU fairness vs progress fairness and context switch overhead.

### Page G — Explainable Adaptive Recommendations
- Select an optimization objective:
  - *Minimize Waiting Time* (favors SJF for simultaneous arrivals, SRTF for staggered arrivals).
  - *Minimize Response Time* (favors Round Robin with small quantum).
  - *Balance Fairness & Performance* (favors Round Robin for high $CV \ge 1.0$, SJF for moderate $CV$).
  - *Penalize Context Switches* (favors non-preemptive FCFS or SJF).
- Receive plain-language explanations of the trade-offs and ranked alternative policies.
- Evaluates the policy on unseen held-out seeds against all fixed policies and an Oracle baseline.

### Page H — Experiment History & Data Export
- Filter and search through past simulations and batch experiments.
- Reload any past workload directly into the simulator with one click.
- Download past experiment data as CSV or JSON.

### Page I — In-App Methodology Guide
- Interactive documentation explaining algorithm rules, formulas, dual fairness concepts, and statistical methods.

---

## Reproducing an Example Run

To reproduce the benchmark scenario from our test verification:

1. Open `http://localhost:3000` and navigate to **Workload Laboratory**.
2. Select the **Balanced Workload** preset with **Process Count = 5** and **Seed = 42**. Click **Generate Preset Workload**.
3. Click **Compare All Schedulers** in the top-right corner.
4. Set **RR Quantum = 2** and observe the comparison matrix:
   - **SRTF** minimizes average waiting time by preempting for shorter tasks.
   - **Round Robin** achieves high progress fairness ($J(F) = 1.0$) with low response time variance.
   - **FCFS** incurs 0 preemptions and minimal context switches.
5. Navigate to **Adaptive Recommendation**, choose **Minimize Waiting Time**, and confirm the engine recommends **SRTF** with a detailed trade-off analysis.

---

## Known Limitations

- **Single-Core Architecture**: The simulation model strictly represents a single CPU core. Multicore, SMP, GPU, memory paging, and disk I/O blocking are outside the required scope.
- **Context Switch Overhead**: In accordance with the project specification, context switches and preemptions are tracked and counted accurately without silently injecting artificial CPU tick penalties into the execution timeline.
- **Estimation in Production OS**: Classic shortest-job algorithms (SJF/SRTF) assume known burst lengths. Real operating systems must estimate bursts using exponential moving averages ($\tau_{n+1} = \alpha t_n + (1-\alpha)\tau_n$) or Multi-Level Feedback Queues (MLFQ).
