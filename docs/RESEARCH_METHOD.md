# Research Methodology & Mathematical Foundations

This document details the mathematical formulations, statistical rigor, and machine learning invariants implemented throughout the **Adaptive OS Scheduling and Performance Analysis Framework**.

---

## 1. Fairness & Starvation Metrics

### 1.1 Dual-Perspective Jain's Fairness Index
Jain's Fairness Index $J \in [1/n, 1.0]$ measures allocation equality. In operating systems scheduling, evaluating fairness solely by raw CPU time ($x_i$) is fundamentally flawed when processes have unequal CPU demands ($B_i$):

1. **Raw CPU Allocation Fairness**:
   $$J(\mathbf{x}) = \frac{\left( \sum_{i=1}^n x_i \right)^2}{n \sum_{i=1}^n x_i^2}$$
   Measures parity of raw execution ticks. Under heterogeneous job lengths, a fair scheduler *should* allocate unequal total ticks to complete jobs of different sizes.
   
2. **Demand-Relative Progress Fairness**:
   Let normalized progress be $f_i = \min\left( \frac{x_i}{B_i}, 1.0 \right)$:
   $$J(\mathbf{f}) = \frac{\left( \sum_{i=1}^n f_i \right)^2}{n \sum_{i=1}^n f_i^2}$$
   This captures whether processes advance toward completion at equitable rates relative to their requested burst lengths.

### 1.2 Gini Coefficient of Waiting Times
To capture inequality across the entire waiting time distribution:
$$G = \frac{\sum_{i=1}^n \sum_{j=1}^n |w_i - w_j|}{2 n^2 \bar{w}}$$
Where $\bar{w} = \frac{1}{n} \sum_{i=1}^n w_i$. If $\bar{w} = 0$, all processes experienced zero waiting time, and $G = 0.0$ by definition.

### 1.3 Starvation Criterion
A process $P_i$ is classified as starved if its individual waiting time exceeds three times the workload mean waiting time:
$$\text{Starved}(P_i) \iff w_i > 3 \cdot \bar{w}$$
The starvation count and starvation ratio ($N_{\text{starved}} / n$) provide direct insight into priority inversion and convoy pathologies.

---

## 2. Statistical Testing & Significance Pipeline

### 2.1 Friedman Omnibus Test
Before conducting pairwise comparisons across $k$ schedulers over $N$ workload seeds, an omnibus Friedman non-parametric rank test is evaluated:
$$Q = \frac{12 N}{k(k+1)} \sum_{j=1}^k \bar{R}_j^2 - 3 N (k+1)$$
Where $\bar{R}_j$ is the average rank of scheduler $j$. If $p_{\text{Friedman}} \ge 0.05$, the null hypothesis of equal performance cannot be rejected.

### 2.2 Monotonic Holm-Bonferroni Step-Down Correction
When performing $m$ pairwise comparisons (e.g. against FCFS baseline or between all pairs), family-wise error rate (FWER) is controlled using the strictly monotonic step-down Holm-Bonferroni procedure:

1. Sort raw two-sided p-values: $p_{(1)} \le p_{(2)} \le \dots \le p_{(m)}$.
2. Compute adjusted p-values:
   $$p'_{(1)} = \min(1.0, m \cdot p_{(1)})$$
   $$p'_{(k)} = \max\left( p'_{(k-1)}, \min(1.0, (m - k + 1) \cdot p_{(k)}) \right) \quad \text{for } k=2, \dots, m$$
This guarantees strict monotonicity: $p'_{(1)} \le p'_{(2)} \le \dots \le p'_{(m)} \le 1.0$, preventing ranking inversions.

### 2.3 Paired Effect Sizes
For paired trial differences $D_i = M_{1,i} - M_{2,i}$ across seeds $i=1,\dots,N$:
- **Paired Cohen's $d_z$**:
  $$d_z = \frac{\bar{D}}{s_D} = \frac{\frac{1}{N}\sum D_i}{\sqrt{\frac{1}{N-1}\sum (D_i - \bar{D})^2}}$$
- **Hedges' $g$ Correction** (unbiased for finite sample size $N$):
  $$g = d_z \left( 1 - \frac{3}{4N - 5} \right)$$

### 2.4 Seeded Bootstrap Confidence Intervals
Empirical 95% confidence intervals are computed using 1,000 non-parametric bootstrap resamples with a deterministic random seed for exact reproducibility.

---

## 3. Feature-Only Adaptive Recommender & Zero-Leakage Guarantee

### 3.1 Contextual Selection Without Simulation
Unlike brute-force selectors that simulate every candidate algorithm before deciding, an online kernel scheduler must decide *without* simulating the future:
$$\hat{\pi} = \arg\min_{\pi \in \Pi} \mathbb{E}[M_\pi \mid \mathbf{x}]$$
Where $\mathbf{x} \in \mathbb{R}^7$ is extracted solely from the incoming process queue:
1. Process count ($n$)
2. Arrival span ($\max A_i - \min A_i$)
3. Arrival rate ($n / \text{span}$)
4. Mean burst ($\bar{B}$)
5. Burst coefficient of variation ($CV_B = \sigma_B / \bar{B}$)
6. Burstiness index ($I_{\text{burst}} = (\sigma_B - \bar{B}) / (\sigma_B + \bar{B})$)
7. Heavy-tail Pareto index ($\alpha_{\text{Hill}}$)

### 3.2 Leakage Invariant
During inference, candidate algorithms ($\Pi = \{\text{FCFS}, \text{SJF}, \text{SRTF}, \text{PRIORITY}, \text{RR}\}$) are **never executed on the target workload**.

### 3.3 Disjoint Seed Evaluation & Regret Analysis
The recommender is validated on strictly held-out random seeds:
- **Training Set**: Seeds $1000 \dots 1199$ (200 workloads)
- **Validation Set**: Seeds $2000 \dots 2099$ (100 workloads)
- **Held-Out Test Set**: Seeds $3000 \dots 3199$ (200 workloads)

For each test workload $w_i$, the ex-post oracle baseline $M_{\text{oracle}}(w_i) = \min_{\pi \in \Pi} M_\pi(w_i)$ is determined. The empirical held-out regret is:
$$\text{Regret}(w_i) = M_{\hat{\pi}(w_i)}(w_i) - M_{\text{oracle}}(w_i) \ge 0$$
Mean regret and standard error are reported transparently without claiming zero regret.

---

## 4. Trace-Informed Pipeline

### 4.1 Standard Workload Format (SWF)
The framework parses supercomputer and cloud cluster traces conforming to the standard 18-column SWF specification:
- Field 1: Job Number
- Field 2: Submit Time (seconds)
- Field 3: Wait Time
- Field 4: Run Time (seconds)
- Field 5: Number of Allocated Processors

### 4.2 Distribution Comparison
Empirical workloads are compared against synthetic generators using:
1. **Two-Sample Kolmogorov-Smirnov Test**:
   $$D_{\text{KS}} = \sup_x |F_{\text{trace}}(x) - F_{\text{syn}}(x)|$$
2. **First Wasserstein Distance (Earth Mover's Distance)**:
   $$W_1(u, v) = \int_{-\infty}^\infty |U(t) - V(t)| \, dt$$
Composite distance $D = 0.5 \cdot D_{\text{KS}} + 0.5 \cdot \frac{W_1}{1 + W_1}$ guides calibration of synthetic distributions to match observed supercomputer traces.
