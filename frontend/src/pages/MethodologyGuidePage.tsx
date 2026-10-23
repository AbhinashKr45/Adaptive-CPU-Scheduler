import React from 'react';
import { BookOpen, Cpu, BarChart2, Scale, Sparkles, LineChart } from 'lucide-react';

export const MethodologyGuidePage: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--navy-900)' }}>
          Operating Systems Scheduling & Research Methodology Guide
        </h1>
        <p style={{ color: 'var(--navy-600)', fontSize: '0.9rem', marginTop: 4 }}>
          Comprehensive theoretical documentation on scheduling algorithms, fairness metrics, statistical testing, and adaptive policy selection.
        </p>
      </div>

      {/* 1. Classic Scheduling Algorithms */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Cpu size={18} /> 1. Evaluated CPU Scheduling Algorithms
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
          <div>
            <strong style={{ color: 'var(--navy-900)' }}>First-Come, First-Served (FCFS) [Non-Preemptive]:</strong>
            <p>
              Executes processes strictly in order of their arrival time. If multiple processes arrive simultaneously at the exact same tick, ties are resolved deterministically using the lower Process ID (PID). Non-preemptive: once a process is allocated the CPU, it runs uninterrupted until completion. Vulnerable to the <em>convoy effect</em> where short processes are trapped behind a long compute-bound job.
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--navy-900)' }}>Shortest Job First (SJF) [Non-Preemptive]:</strong>
            <p>
              Among eligible processes currently ready in the queue, selects the process with the shortest original CPU burst length. Never selects a process before its arrival time. Resolves burst ties deterministically by lower PID. Mathematically minimizes average waiting time when all processes are simultaneously available at time zero.
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--navy-900)' }}>Shortest Remaining Time First (SRTF) [Preemptive]:</strong>
            <p>
              The preemptive generalization of SJF. At every arrival event, if an arriving process has a strictly smaller remaining burst time than the currently running process, the running process is preempted and returned to the ready queue. Equal remaining times do not cause preemption (preventing unnecessary thrashing).
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--navy-900)' }}>Priority Scheduling [Non-Preemptive]:</strong>
            <p>
              Selects the process with highest priority (lower numerical value = higher priority, e.g., Priority 1 precedes Priority 3). Ties are resolved deterministically by PID. Non-preemptive.
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--navy-900)' }}>Round Robin (RR) [Preemptive]:</strong>
            <p>
              Maintains an explicit FIFO ready queue. Each ready process is dispatched for up to a configurable time quantum <code>q</code>. If the process does not finish within <code>q</code>, it is preempted. Crucially, processes arriving at or before the quantum boundary are enqueued <em>before</em> the preempted process is returned to the queue tail. Provides low response time and starvation protection.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Metrics & Lifecycles */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <BarChart2 size={18} /> 2. Process Lifecycles & Performance Metrics
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.5 }}>
          <div style={{ background: 'var(--surface-secondary)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Turnaround Time (TAT)</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue-700)', margin: '4px 0' }}>TAT = Completion Time - Arrival Time</div>
            <p>Elapsed wall-clock time between a process entering the system and fully finishing execution.</p>
          </div>

          <div style={{ background: 'var(--surface-secondary)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Response Time (Resp)</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue-700)', margin: '4px 0' }}>Response = First CPU Start Time - Arrival Time</div>
            <p>Initial dispatch delay until the process first acquires the CPU. Critical for interactive systems.</p>
          </div>

          <div style={{ background: 'var(--surface-secondary)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Waiting Time (Wait)</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue-700)', margin: '4px 0' }}>Waiting = Turnaround Time - Original Burst Time</div>
            <p>Total time spent sitting in the ready queue without receiving CPU cycles.</p>
          </div>

          <div style={{ background: 'var(--surface-secondary)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Throughput & CPU Utilization</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue-700)', margin: '4px 0' }}>Throughput = N / Makespan | Util = Busy / Makespan</div>
            <p>Throughput is the completed process rate. Conservation of service dictates Busy + Idle = Makespan.</p>
          </div>
        </div>
      </div>

      {/* 3. Fairness Indices */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Scale size={18} /> 3. Dual Fairness Dimensions: Raw CPU vs Demand-Relative Progress
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 12 }}>
            This platform deliberately distinguishes <strong>Raw CPU Equality</strong> from <strong>Demand-Relative Progress Fairness</strong>:
          </p>

          <div className="grid-2" style={{ gap: 16 }}>
            <div style={{ border: '1px solid var(--border)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Jain's Raw CPU Allocation Index J(x)</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue-700)', margin: '6px 0' }}>
                J(x) = (Σ xᵢ)² / (n · Σ xᵢ²)
              </div>
              <p style={{ fontSize: '0.8rem' }}>
                Measures whether all processes received strictly equal CPU service time <code>xᵢ</code>. Ranges from <code>1/n</code> (monopoly) to <code>1.0</code> (equal allocation). Note: If jobs have different demands (e.g. 2 units vs 100 units), equal CPU allocation actually under-serves the long job while wasting time on the short job!
              </p>
            </div>

            <div style={{ border: '1px solid var(--border)', padding: 14, borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy-900)' }}>Demand-Relative Progress Fairness J(F)</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue-700)', margin: '6px 0' }}>
                Fᵢ(T) = min(Aᵢ(T) / Dᵢ, 1.0) &nbsp;→&nbsp; J(F)
              </div>
              <p style={{ fontSize: '0.8rem' }}>
                Computes the normalized completion fraction <code>Fᵢ</code> relative to each process's declared CPU demand <code>Dᵢ</code>, then applies Jain's index over the progress vector. When all processes complete, every <code>Fᵢ = 1.0</code>, yielding perfect progress fairness <code>1.0</code>.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 14, background: 'var(--surface-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, color: 'var(--navy-900)', marginBottom: 6 }}>
              ⚠ Important: Interpreting Final-Completion Fairness Values
            </div>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--navy-700)' }}>
              When all processes run to completion (the standard simulation mode), <strong>demand-relative progress fairness is always 1.0</strong> for every scheduler — because every process received exactly as much service as it demanded. This is <em>not</em> evidence that one scheduler was fairer during execution; it simply reflects that all work eventually completed.
            </p>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--navy-700)', marginTop: 8 }}>
              Similarly, <strong>final raw CPU fairness</strong> at completion reflects the <em>declared burst sizes</em>, not scheduling behavior. If processes demand different amounts of CPU (e.g., burst=2 vs burst=20), the raw CPU allocation will inherently be unequal regardless of the scheduling policy.
            </p>
            <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--navy-700)', marginTop: 8 }}>
              To observe meaningful fairness differences between schedulers, measure fairness at <strong>configurable observation times T before all processes complete</strong>. At such intermediate points, different scheduling policies distribute CPU time differently among still-running processes.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Statistical Methodology */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <LineChart size={18} /> 4. Statistical Testing & Paired Replication
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
          <p>
            To eliminate random workload bias, the experiment engine uses <strong>paired comparisons</strong>: each random seed produces one identical workload that is evaluated across all five algorithms.
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong>95% Confidence Intervals:</strong> Computed via Student's t distribution: <code>x̄ ± t*(0.975, n-1) · (s / √n)</code>.</li>
            <li><strong>Cohen's d Effect Size:</strong> Quantifies practical difference magnitude: <code>d = d̄ / s_d</code>. Values |d| ≥ 0.8 represent large practical differences.</li>
            <li><strong>Paired t-test & Wilcoxon signed-rank test:</strong> Parametric and non-parametric hypothesis tests verifying whether differences are statistically distinguishable from zero at α=0.05.</li>
          </ul>
        </div>
      </div>

      {/* 5. Adaptive Recommendation Logic */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Sparkles size={18} /> 5. Adaptive Policy Recommendation Architecture
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--navy-700)', lineHeight: 1.6 }}>
          <p>
            Rather than a black-box model, the recommendation engine uses an interpretable decision layer guided by queuing theory and empirical characteristics:
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><strong>Minimize Waiting Time:</strong> Selects SJF if all arrivals are simultaneous (achieves optimal waiting with zero preemptions), or SRTF if arrivals are staggered.</li>
            <li><strong>Minimize Response Time:</strong> Selects Round Robin with small quantum to ensure rapid initial dispatch latency.</li>
            <li><strong>Balance Fairness & Performance:</strong> Selects Round Robin when burst variability (CV ≥ 1.0) is severe to prevent long-job starvation, or SJF when variability is moderate.</li>
            <li><strong>Penalize Context Switches:</strong> Recommends non-preemptive FCFS (for uniform demands) or SJF (for heterogeneous demands) to eliminate preemption penalties.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
