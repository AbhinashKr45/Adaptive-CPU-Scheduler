# Live Demonstration Script: Adaptive OS Scheduling Framework

This script provides an executive, step-by-step walkthrough to present the research and engineering highlights of the platform.

---

## Act 1: Overview & The Authoritative C99 Engine

1. **Open the Dashboard**:
   - Navigate to the **Platform Overview** (`/`).
   - Highlight the system status card: C Engine status (`authoritative`, zero clock drift), SQLite database connection, and workload statistics.
2. **Interactive Simulation**:
   - Navigate to **Simulation & Gantt**.
   - Select the preset **"Bursty Convoy"** (5 processes with one massive head-of-line job and multiple short subsequent arrivals).
   - Run **FCFS**:
     - Point out the convoy effect in the Gantt chart: short jobs are blocked waiting for PID 1.
     - Note the high average waiting time ($\approx 8.2$) and zero preemptions.
   - Run **SRTF**:
     - Point out the preemption cuts in the Gantt chart: as soon as short jobs arrive, PID 1 is preempted.
     - Note how average waiting time drops drastically ($\approx 3.0$), illustrating the conservation of CPU service and makespan invariant.

---

## Act 2: Head-to-Head Comparison & The Jain's Index Nuance

1. **Navigate to "Fairness Laboratory"**:
   - Select the **"Highly Unequal Demands"** preset (processes requiring 20 ticks vs. 2 ticks).
   - Click **Run All Schedulers**.
2. **Observe the Two Fairness Metrics**:
   - Explain the crucial operating systems research insight:
     - **Raw CPU Allocation Fairness $J(\mathbf{x})$**: Round Robin divides CPU ticks evenly, so $J(\mathbf{x}) \approx 0.95$. Under FCFS or SJF, long jobs get large chunks, so $J(\mathbf{x})$ looks lower.
     - **Demand-Relative Progress Fairness $J(\mathbf{F})$**: A 2-tick job needs only 2 ticks to complete, while a 20-tick job needs 20 ticks. Progress fairness measures whether each job receives progress proportional to its demand.
3. **Interactive Time-Scrubber & Trajectory Line Chart**:
   - Scrub through time $T = 0 \dots \text{makespan}$.
   - Show how progress fairness evolves tick-by-tick on the interactive Recharts line chart.
   - Point out the **Waiting Time Gini Coefficient** and **Starvation Count ($w_i > 3\bar{w}$)**.

---

## Act 3: Trace Laboratory (Supercomputer Workload Ingestion)

1. **Navigate to "Trace Laboratory"**:
   - Click **Load Bundled Supercomputer Trace (SWF)**.
   - The system ingests 100+ HPC jobs from a production supercomputer log.
2. **Data Cleaning & Scaling Report**:
   - Show the automatic cleaning pipeline: negative runtimes dropped, zero-processor records cleaned, 99th-percentile tail outliers separated.
   - Show the scaling engine: scales multi-hour batch runs to discrete CPU simulation ticks while reporting Mean Absolute Error (MAE) loss.
3. **Distribution Comparison**:
   - Click **Fit Synthetic to Trace**.
   - Show how the backend evaluates Kolmogorov-Smirnov statistics and Wasserstein distances to discover the synthetic generator parameters that best emulate the real cluster workload.
4. **Export to Simulation**:
   - Click **Sample & Save as Workload**.
   - Instantly run the sampled HPC trace through all 5 schedulers.

---

## Act 4: Feature-Only Adaptive Recommender (Zero Outcome Leakage)

1. **Navigate to "Adaptive Recommender"**:
   - Load or craft a custom workload with high burst variance.
   - Select Objective: **Minimize Waiting Time**.
2. **Run Adaptive Recommendation**:
   - Point out that the recommendation is generated in **< 5 milliseconds**.
   - Explain the **Zero-Leakage Guarantee**:
     - The recommender extracts 7 static features purely from arrivals and burst lengths.
     - It **never simulates the candidate algorithms on the target workload during inference**.
3. **Inspect Decision Rationale & Held-Out Regret**:
   - Review the generated human-readable explanation showing which feature threshold triggered the decision.
   - Highlight the **Held-Out Regret Card**:
     - Honest empirical test regret is displayed across 200 disjoint random seeds ($3000..3199$).
     - The framework transparently demonstrates non-zero regret ($R \ge 0$) against the theoretical ex-post oracle.

---

## Act 5: Authoritative 30-Seed Research Benchmark & Statistical Rigor

1. **Navigate to "Research Matrix"**:
   - Review the complete 750-run benchmark matrix across 5 workloads (including real SWF supercomputer traces) $\times$ 5 schedulers.
2. **Holm-Bonferroni & Paired Effect Sizes**:
   - Show the statistical comparison table:
     - Omnibus Friedman test confirms overall significance.
     - Monotonically adjusted Holm-Bonferroni p-values control family-wise error rates.
     - Paired Cohen's $d_z$ and small-sample Hedges' $g$ quantify effect magnitudes.
3. **Download Research Report**:
   - Click **Download Full Research Report (REPORT.md)** to inspect the generated academic summary.
