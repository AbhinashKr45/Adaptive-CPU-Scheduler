"""
Deterministic generator for sample trace workloads used in offline testing and demonstration.
Produces:
  1. sample_workload.swf (Standard Workload Format v2.2)
  2. sample_workload.csv (Generic CSV format)
"""

import os
import numpy as np
import pandas as pd

def generate_traces(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    rng = np.random.default_rng(seed=4242)

    n_jobs = 60

    # Staggered arrivals with gamma inter-arrival times
    inter_arrivals = rng.gamma(shape=2.0, scale=4.0, size=n_jobs)
    submit_times = np.cumsum(inter_arrivals)
    submit_times = np.round(submit_times, 2)
    # First submit at 0.0
    submit_times -= submit_times[0]

    # Log-normal burst times (heavy-tailed)
    lognormal_bursts = rng.lognormal(mean=2.2, sigma=0.9, size=n_jobs)
    runtimes = np.clip(np.round(lognormal_bursts, 2), 0.5, 300.0)

    # Priorities 1 to 5
    priorities = rng.integers(1, 6, size=n_jobs)

    # 1. Generate sample_workload.swf
    swf_path = os.path.join(output_dir, "sample_workload.swf")
    with open(swf_path, "w", encoding="utf-8") as f:
        f.write("; Version: 2.2\n")
        f.write("; Computer: Synthetic Benchmark Cluster (Deterministic Sample)\n")
        f.write("; MaxJobs: 60\n")
        f.write("; Note: Fields: JobNum Submit Wait Run AllocProc AvgCPU UsedMem ReqProc ReqTime ReqMem Status User Group Exec Queue Part Preceding Think\n")
        for i in range(n_jobs):
            job_id = i + 1
            submit = int(submit_times[i])
            wait = int(rng.integers(0, 10))
            run = int(max(1, round(runtimes[i])))
            queue = int(priorities[i])
            # SWF fields: 18 columns
            f.write(f"{job_id:5d}\t{submit:8d}\t{wait:5d}\t{run:6d}\t1\t{run:6d}\t-1\t1\t{run:6d}\t-1\t1\t101\t1\t1\t{queue:3d}\t1\t-1\t-1\n")

    # 2. Generate sample_workload.csv
    csv_path = os.path.join(output_dir, "sample_workload.csv")
    df = pd.DataFrame({
        "job_id": np.arange(1, n_jobs + 1),
        "submit_time": submit_times,
        "runtime": runtimes,
        "priority": priorities,
        "user_id": rng.integers(100, 105, size=n_jobs)
    })
    df.to_csv(csv_path, index=False)

    print(f"Generated {swf_path} and {csv_path}")

if __name__ == "__main__":
    out = os.path.dirname(os.path.abspath(__file__))
    generate_traces(out)
