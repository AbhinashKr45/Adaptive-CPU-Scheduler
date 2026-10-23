import math
from typing import List, Dict, Any, Optional
import numpy as np
import scipy.stats as stats
import pandas as pd
from backend.generator import generate_workload
from backend.c_bridge import run_c_simulation

SCHEDULER_NAMES = ["FCFS", "SJF", "SRTF", "PRIORITY", "RR"]

def compute_summary_stats(series: List[float]) -> Dict[str, Any]:
    """Computes mean, median, std, min, max, and 95% confidence interval for a metric."""
    arr = np.array(series, dtype=float)
    n = len(arr)
    if n == 0:
        return {"mean": 0.0, "median": 0.0, "std": 0.0, "ci_low": 0.0, "ci_high": 0.0, "min": 0.0, "max": 0.0}

    mean_val = float(np.mean(arr))
    median_val = float(np.median(arr))
    std_val = float(np.std(arr, ddof=1)) if n > 1 else 0.0

    if n > 1 and std_val > 1e-9:
        sem = std_val / math.sqrt(n)
        ci_margin = float(stats.t.ppf(0.975, df=n - 1) * sem)
        ci_low = mean_val - ci_margin
        ci_high = mean_val + ci_margin
    else:
        # Zero variance: CI collapses to the mean (all values identical).
        # This is correct, not an error. We report it honestly.
        ci_low = mean_val
        ci_high = mean_val

    return {
        "mean": round(mean_val, 4),
        "median": round(median_val, 4),
        "std": round(std_val, 4),
        "ci_low": round(ci_low, 4),
        "ci_high": round(ci_high, 4),
        "min": round(float(np.min(arr)), 4),
        "max": round(float(np.max(arr)), 4)
    }


def compute_paired_comparison(values_a: List[float], values_b: List[float]) -> Dict[str, Any]:
    """
    Computes paired statistical differences, Cohen's d effect size,
    and paired t-test / Wilcoxon signed-rank test.

    Handles edge cases:
    - n < 2: returns degenerate results with p=1.0
    - Zero variance in differences: Cohen's d = 0, p-values reported honestly
    - NaN results: reported as p=1.0 (no significance claimed)
    """
    a = np.array(values_a, dtype=float)
    b = np.array(values_b, dtype=float)
    n = len(a)

    if n < 2:
        return {
            "n": n,
            "mean_diff": 0.0,
            "cohens_d": 0.0,
            "p_value_ttest": 1.0,
            "p_value_wilcoxon": 1.0,
            "significant_at_05": False,
            "note": "Insufficient data for paired comparison (n < 2)."
        }

    diff = a - b
    mean_diff = float(np.mean(diff))
    std_diff = float(np.std(diff, ddof=1))

    # Cohen's d for paired samples: mean_diff / std_diff
    # If std_diff == 0, all differences are identical. Cohen's d is undefined
    # but we report 0.0 (no variability to measure effect against).
    if std_diff > 1e-9:
        cohens_d = float(mean_diff / std_diff)
    else:
        cohens_d = 0.0

    note = ""

    # Paired t-test
    try:
        t_stat, p_val_t = stats.ttest_rel(a, b)
        if np.isnan(p_val_t):
            # Zero-variance case: all differences identical
            if abs(mean_diff) < 1e-9:
                p_val_t = 1.0  # No difference at all
                note = "All paired differences are zero (identical results)."
            else:
                p_val_t = 0.0  # Constant non-zero difference (numerically significant)
                note = "Constant non-zero difference across all seeds (zero variance in differences)."
        p_val_t = float(p_val_t)
    except Exception:
        p_val_t = 1.0

    # Wilcoxon signed-rank test
    try:
        if np.all(diff == 0):
            p_val_w = 1.0
        else:
            w_res = stats.wilcoxon(diff, zero_method="wilcox")
            p_val_w = float(w_res.pvalue) if not np.isnan(w_res.pvalue) else 1.0
    except Exception:
        p_val_w = 1.0

    return {
        "n": n,
        "mean_diff": round(mean_diff, 4),
        "cohens_d": round(cohens_d, 4),
        "p_value_ttest": round(p_val_t, 6),
        "p_value_wilcoxon": round(p_val_w, 6),
        "significant_at_05": (p_val_t < 0.05),
        "note": note
    }


def _apply_holm_bonferroni(p_values: List[float], alpha: float = 0.05) -> List[Dict[str, Any]]:
    """
    Applies Holm-Bonferroni step-down correction for multiple comparisons.
    Returns list of dicts with original_p, adjusted_p, and significant fields.
    This prevents inflated false-positive rates when testing many scheduler pairs.
    """
    n = len(p_values)
    if n == 0:
        return []

    indexed = [(p, i) for i, p in enumerate(p_values)]
    indexed.sort(key=lambda x: x[0])

    results = [None] * n
    for rank, (p_val, orig_idx) in enumerate(indexed):
        adjusted_alpha = alpha / (n - rank)
        adjusted_p = min(p_val * (n - rank), 1.0)
        results[orig_idx] = {
            "original_p": round(p_val, 6),
            "adjusted_p": round(adjusted_p, 6),
            "significant_holm": (p_val < adjusted_alpha),
            "rank": rank + 1
        }

    return results


def run_experiment_batch(
    schedulers: List[str],
    seeds: List[int],
    workload_config: Dict[str, Any],
    rr_quantum: int = 2
) -> Dict[str, Any]:
    """
    Runs paired experimental batch:
    For each seed, generates one workload, and runs it across all specified schedulers.
    """
    raw_runs = []
    # Key: (scheduler, metric_name) -> list of values
    metric_buckets: Dict[str, Dict[str, List[float]]] = {s: {} for s in schedulers}

    for seed in seeds:
        # Deterministically generate identical workload for this seed
        wl = generate_workload(
            process_count=workload_config.get("process_count", 10),
            seed=seed,
            arrival_distribution=workload_config.get("arrival_distribution", "uniform"),
            burst_distribution=workload_config.get("burst_distribution", "normal"),
            mean_burst=workload_config.get("mean_burst", 10.0),
            burst_std=workload_config.get("burst_std", 4.0),
            skew_level=workload_config.get("skew_level", "medium"),
            max_arrival=workload_config.get("max_arrival", 20)
        )
        procs = wl["processes"]

        for sched in schedulers:
            q = rr_quantum if sched.upper() in ("RR", "ROUND_ROBIN", "ROUND ROBIN") else 0
            sim_res = run_c_simulation(procs, sched, quantum=q)
            m = sim_res["metrics"]

            run_entry = {
                "seed": seed,
                "scheduler": sched,
                "quantum": q,
                "metrics": m
            }
            raw_runs.append(run_entry)

            for k, val in m.items():
                if isinstance(val, (int, float)):
                    if k not in metric_buckets[sched]:
                        metric_buckets[sched][k] = []
                    metric_buckets[sched][k].append(float(val))

    # Compute summary stats per scheduler
    summary_by_scheduler = {}
    for sched in schedulers:
        summary_by_scheduler[sched] = {}
        for m_name, vals in metric_buckets[sched].items():
            summary_by_scheduler[sched][m_name] = compute_summary_stats(vals)

    # Compute paired comparisons against FCFS as baseline
    # Include key performance AND fairness metrics
    paired_metrics = [
        "avg_waiting_time", "avg_turnaround_time", "avg_response_time",
        "jain_fairness_cpu", "jain_fairness_progress",
        "context_switches", "throughput"
    ]

    paired_comparisons = {}
    baseline = "FCFS" if "FCFS" in schedulers else schedulers[0]
    all_p_values = []  # Collect for Holm-Bonferroni correction
    p_value_keys = []  # Track which comparison-metric pair each p-value belongs to

    for sched in schedulers:
        if sched != baseline:
            comp_key = f"{sched}_vs_{baseline}"
            paired_comparisons[comp_key] = {}
            for m_name in paired_metrics:
                if m_name in metric_buckets[sched] and m_name in metric_buckets[baseline]:
                    comp = compute_paired_comparison(
                        metric_buckets[sched][m_name],
                        metric_buckets[baseline][m_name]
                    )
                    paired_comparisons[comp_key][m_name] = comp
                    all_p_values.append(comp["p_value_ttest"])
                    p_value_keys.append((comp_key, m_name))

    # Apply Holm-Bonferroni correction for multiple comparisons
    if all_p_values:
        corrections = _apply_holm_bonferroni(all_p_values)
        for i, (comp_key, m_name) in enumerate(p_value_keys):
            paired_comparisons[comp_key][m_name]["holm_bonferroni"] = corrections[i]

    return {
        "schedulers": schedulers,
        "seeds": seeds,
        "total_runs": len(raw_runs),
        "workload_config": workload_config,
        "summary": summary_by_scheduler,
        "paired_comparisons": paired_comparisons,
        "raw_runs": raw_runs,
        "multiple_comparison_note": (
            "Holm-Bonferroni step-down correction is applied to all paired t-test p-values "
            "to control the family-wise error rate across multiple scheduler comparisons and metrics."
        )
    }


def export_experiment_to_dataframe(experiment_result: Dict[str, Any]) -> pd.DataFrame:
    """Flattens experiment runs into a pandas DataFrame for CSV export."""
    rows = []
    for run in experiment_result["raw_runs"]:
        row = {
            "seed": run["seed"],
            "scheduler": run["scheduler"],
            "quantum": run["quantum"]
        }
        for k, v in run["metrics"].items():
            row[k] = v
        rows.append(row)
    return pd.DataFrame(rows)
