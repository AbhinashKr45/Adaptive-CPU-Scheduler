# Trace Datasets and Archive Documentation

This directory contains trace workloads and reproduction utilities for empirical scheduling evaluations.

## 1. Bundled Sample Traces

Since network access may be restricted during offline builds and tests, two deterministic sample traces are bundled directly in this repository:
- `sample_workload.swf`: Standard Workload Format (SWF v2.2) benchmark trace containing 60 jobs with gamma inter-arrivals and log-normal burst distribution.
- `sample_workload.csv`: Generic tabular CSV format containing job ID, submit time, runtime duration, and user priority.

Both files are deterministically produced by `generate_sample_traces.py` with fixed random seed `4242`.

## 2. Obtaining Real Production Traces

### A. Parallel Workloads Archive (SWF)
The Parallel Workloads Archive maintains real-world supercomputer and cluster job traces in the Standard Workload Format (SWF):
- **Archive URL**: [https://www.cs.huji.ac.il/labs/parallel/workload/](https://www.cs.huji.ac.il/labs/parallel/workload/)
- **Recommended Traces**:
  - `Lublin99`: Synthetic model calibrated against real workloads (`lublin99.swf.gz`)
  - `KTH-SP2`: Swedish Royal Institute of Technology 100-node SP2 trace (`kth-sp2.swf.gz`)
  - `SDSC-Par`: San Diego Supercomputer Center Paragon trace (`sdsc-par.swf.gz`)
- **Download Instructions**:
  ```bash
  curl -O https://www.cs.huji.ac.il/labs/parallel/workload/l_lublin99/lublin99.swf.gz
  gzip -d lublin99.swf.gz
  ```
  Once uncompressed, upload the `.swf` file directly into the **Trace Laboratory** in the web dashboard or via `POST /api/v1/traces/upload`.

### B. Google Cluster Workload Traces
Google publishes production Borg cluster trace data containing task events and resource requirements:
- **Archive URL**: [https://github.com/google/cluster-data](https://github.com/google/cluster-data)
- **Format**: CSV / Parquet containing timestamp (microseconds), event type, job ID, priority, and CPU/memory request.
- **Conversion to Generic CSV**:
  Extract columns:
  - `submit_time`: `timestamp / 1e6` (seconds)
  - `runtime`: completed timestamp minus start timestamp
  - `priority`: internal priority level (0-11)
