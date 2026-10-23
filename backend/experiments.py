import math
from typing import List, Dict, Any, Optional, Tuple
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
        return {"n": 0, "mean": 0.0, "median": 0.0, "std": 0.0, "ci_low": 0.0, "ci_high": 0.0, "min": 0.0, "max": 0.0}

    mean_val = float(np.mean(arr))
    median_val = float(np.median(arr))
    std_val = float(np.std(arr, ddof=1)) if n > 1 else 0.0

    if n > 1 and std_val > 1e-9:
        sem = std_val / math.sqrt(n)
        ci_margin = float(stats.t.ppf(0.975, df=n - 1) * sem)
        ci_low = mean_val - ci_margin
        ci_high = mean_val + ci_margin
    else:
        ci_low = mean_val
        ci_high = mean_val

    return {
        "n": n,
        "mean": round(mean_val, 4),
        "median": round(median_val, 4),
        "std": round(std_val, 4),
        "ci_low": round(ci_low, 4),
        "ci_high": round(ci_high, 4),
        "min": round(float(np.min(arr)), 4),
        "max": round(float(np.max(arr)), 4)
    }


def bootstrap_ci_paired_diff(
    diff: np.ndarray,
    n_resamples: int = 2000,
    seed: int = 42,
    alpha: float = 0.05
) -> Tuple[float, float]:
    """
    Computes a percentile bootstrap 95% confidence interval for the mean paired difference.
    Deterministic with fixed random seed.
    """
    n = len(diff)
    if n < 2 or np.all(diff == diff[0]):
        val = float(np.mean(diff)) if n > 0 else 0.0
        return round(val, 4), round(val, 4)

    rng = np.random.default_rng(seed)
    boot_indices = rng.integers(0, n, size=(n_resamples, n))
    boot_means = np.mean(diff[boot_indices], axis=1)

    ci_low = float(np.percentile(boot_means, 100.0 * (alpha / 2.0)))
    ci_high = float(np.percentile(boot_means, 100.0 * (1.0 - alpha / 2.0)))
    return round(ci_low, 4), round(ci_high, 4)


def compute_paired_comparison(values_a: List[float], values_b: List[float]) -> Dict[str, Any]:
    """
    Computes paired statistical differences, paired Cohen's d_z effect size,
    Hedges' g small-sample correction, bootstrap 95% CI of the mean difference,
    paired Student's t-test, and Wilcoxon signed-rank test.

    Degenerate cases (n < 2, zero variance, all-equal) are guarded with explicit notes.
    """
    a = np.array(values_a, dtype=float)
    b = np.array(values_b, dtype=float)
    n = len(a)

    if n < 2:
        return {
            "n": n,
            "mean_diff": 0.0,
            "cohens_dz": 0.0,
            "cohens_d": 0.0,
            "hedges_g": 0.0,
            "ci_diff_low": 0.0,
            "ci_diff_high": 0.0,
            "p_value_ttest": 1.0,
            "p_value_wilcoxon": 1.0,
            "significant_uncorrected": False,
            "significant_holm": False,
            "significant_at_05": False,
            "note": "Degenerate case: insufficient data for paired comparison (n < 2)."
        }

    diff = a - b
    mean_diff = float(np.mean(diff))
    std_diff = float(np.std(diff, ddof=1))

    # Bootstrap 95% CI for mean paired difference
    ci_diff_low, ci_diff_high = bootstrap_ci_paired_diff(diff, n_resamples=2000, seed=42)

    # Zero-variance differences guard
    if std_diff <= 1e-9:
        if abs(mean_diff) < 1e-9:
            note = f"Degenerate case: all paired differences are exactly zero across all n={n} seeds (identical results)."
            p_val_t = 1.0
            p_val_w = 1.0
        else:
            note = f"Degenerate case: constant non-zero difference ({round(mean_diff, 4)}) with zero variance across all n={n} seeds."
            p_val_t = 0.0
            p_val_w = 0.0

        sig_uncorrected = (p_val_t < 0.05)
        return {
            "n": n,
            "mean_diff": round(mean_diff, 4),
            "cohens_dz": 0.0,
            "cohens_d": 0.0,
            "hedges_g": 0.0,
            "ci_diff_low": ci_diff_low,
            "ci_diff_high": ci_diff_high,
            "p_value_ttest": round(p_val_t, 6),
            "p_value_wilcoxon": round(p_val_w, 6),
            "significant_uncorrected": sig_uncorrected,
            "significant_holm": False,
            "significant_at_05": sig_uncorrected,
            "note": note
        }

    # Paired Cohen's d_z = mean_diff / std_diff
    cohens_dz = float(mean_diff / std_diff)
    df = n - 1
    correction = 1.0 - (3.0 / (4.0 * df - 1.0)) if df >= 2 else 1.0
    hedges_g = float(cohens_dz * correction)

    note = ""

    # Paired Student's t-test
    try:
        t_stat, p_val_t = stats.ttest_rel(a, b)
        p_val_t = float(p_val_t) if not np.isnan(p_val_t) else 1.0
    except Exception:
        p_val_t = 1.0
        note = "Failed to compute paired t-test."

    # Wilcoxon signed-rank test
    try:
        w_res = stats.wilcoxon(diff, zero_method="wilcox")
        p_val_w = float(w_res.pvalue) if not np.isnan(w_res.pvalue) else 1.0
    except Exception:
        p_val_w = 1.0

    sig_uncorrected = (p_val_t < 0.05)

    return {
        "n": n,
        "mean_diff": round(mean_diff, 4),
        "cohens_dz": round(cohens_dz, 4),
        "cohens_d": round(cohens_dz, 4),
        "hedges_g": round(hedges_g, 4),
        "ci_diff_low": ci_diff_low,
        "ci_diff_high": ci_diff_high,
        "p_value_ttest": round(p_val_t, 6),
        "p_value_wilcoxon": round(p_val_w, 6),
        "significant_uncorrected": sig_uncorrected,
        "significant_holm": False,
        "significant_at_05": sig_uncorrected,
        "note": note
    }


def _apply_holm_bonferroni(p_values: List[float], alpha: float = 0.05) -> List[Dict[str, Any]]:
    """
    Applies the Holm-Bonferroni step-down correction for multiple comparisons.
    Enforces monotonic adjusted p-values:
      adjusted_p_k = min(1.0, max(adjusted_p_{k-1}, p_k * (m - k + 1)))
    Defines significant_holm as (adjusted_p < alpha).
    Preserves original index mapping.
    """
    m = len(p_values)
    if m == 0:
        return []

    sorted_pairs = sorted(enumerate(p_values), key=lambda x: x[1])

    results_dict: Dict[int, Dict[str, Any]] = {}
    prev_adj = 0.0

    for rank, (orig_idx, p_val) in enumerate(sorted_pairs):
        raw_adj = float(p_val) * (m - rank)
        adj_p = min(1.0, max(prev_adj, raw_adj))
        prev_adj = adj_p
        results_dict[orig_idx] = {
            "original_p": round(float(p_val), 6),
            "adjusted_p": round(float(adj_p), 6),
            "significant_holm": bool(adj_p < alpha),
            "rank": rank + 1
        }

    return [results_dict[i] for i in range(m)]


def compute_friedman_test(
    metric_buckets: Dict[str, Dict[str, List[float]]],
    schedulers: List[str],
    metric_name: str
) -> Dict[str, Any]:
    """
    Performs a non-parametric Friedman test across all schedulers for repeated measures of a metric.
    Used as an omnibus test before post-hoc pairwise comparisons.
    """
    if len(schedulers) < 3:
        return {
            "metric": metric_name,
            "chi2_stat": 0.0,
            "p_value": 1.0,
            "df": max(0, len(schedulers) - 1),
            "significant": False,
            "note": "Friedman test requires at least 3 scheduling policies."
        }

    samples = []
    for s in schedulers:
        vals = metric_buckets.get(s, {}).get(metric_name, [])
        samples.append(vals)

    n_seeds = len(samples[0]) if samples else 0
    if n_seeds < 2 or any(len(s) != n_seeds for s in samples):
        return {
            "metric": metric_name,
            "chi2_stat": 0.0,
            "p_value": 1.0,
            "df": len(schedulers) - 1,
            "significant": False,
            "note": f"Insufficient or mismatched sample size across schedulers (n={n_seeds})."
        }

    # Guard: check if all schedulers have identical values for each seed
    all_sched_identical_per_seed = all(
        all(abs(samples[sched_idx][seed_idx] - samples[0][seed_idx]) < 1e-9 for sched_idx in range(len(schedulers)))
        for seed_idx in range(n_seeds)
    )
    if all_sched_identical_per_seed:
        return {
            "metric": metric_name,
            "chi2_stat": 0.0,
            "p_value": 1.0,
            "df": len(schedulers) - 1,
            "significant": False,
            "note": "All schedulers produced identical values across all seeds (zero inter-scheduler variance)."
        }

    try:
        stat, p_val = stats.friedmanchisquare(*samples)
        p_val_float = float(p_val) if not np.isnan(p_val) else 1.0
        return {
            "metric": metric_name,
            "chi2_stat": round(float(stat), 4),
            "p_value": round(p_val_float, 6),
            "df": len(schedulers) - 1,
            "significant": bool(p_val_float < 0.05),
            "note": "Omnibus Friedman test across all evaluated scheduling algorithms."
        }
    except Exception as e:
        return {
            "metric": metric_name,
            "chi2_stat": 0.0,
            "p_value": 1.0,
            "df": len(schedulers) - 1,
            "significant": False,
            "note": f"Friedman test could not be computed: {str(e)}"
        }


def run_experiment_batch(
    schedulers: List[str],
    seeds: List[int],
    workload_config: Dict[str, Any],
    rr_quantum: int = 2,
    comparison_mode: str = "baseline"
) -> Dict[str, Any]:
    """
    Runs paired experimental batch:
    For each seed, generates one workload, and runs it across all specified schedulers.
    Runs Friedman omnibus test across policies per metric, then conducts pairwise comparisons
    with Holm-Bonferroni step-down correction. Supports 'baseline' (vs FCFS) and 'all_pairs' modes.
    """
    raw_runs = []
    metric_buckets: Dict[str, Dict[str, List[float]]] = {s: {} for s in schedulers}

    for seed in seeds:
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

            raw_runs.append({
                "seed": seed,
                "scheduler": sched,
                "quantum": q,
                "metrics": m
            })

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

    paired_metrics = [
        "avg_waiting_time", "avg_turnaround_time", "avg_response_time",
        "p95_waiting_time", "waiting_time_std", "starvation_count", "waiting_time_gini",
        "jain_fairness_cpu", "jain_fairness_progress",
        "context_switches", "throughput"
    ]

    # Run Friedman omnibus tests across all schedulers per metric
    friedman_results = {}
    for m_name in paired_metrics:
        friedman_results[m_name] = compute_friedman_test(metric_buckets, schedulers, m_name)

    # Determine comparison pairs
    baseline = "FCFS" if "FCFS" in schedulers else schedulers[0]
    comparison_pairs: List[Tuple[str, str]] = []

    if comparison_mode == "all_pairs":
        for i in range(len(schedulers)):
            for j in range(i + 1, len(schedulers)):
                comparison_pairs.append((schedulers[i], schedulers[j]))
    else:
        for sched in schedulers:
            if sched != baseline:
                comparison_pairs.append((sched, baseline))

    paired_comparisons = {}
    all_p_values = []
    p_value_keys = []

    for (sched_a, sched_b) in comparison_pairs:
        comp_key = f"{sched_a}_vs_{sched_b}"
        paired_comparisons[comp_key] = {}
        for m_name in paired_metrics:
            if m_name in metric_buckets[sched_a] and m_name in metric_buckets[sched_b]:
                comp = compute_paired_comparison(
                    metric_buckets[sched_a][m_name],
                    metric_buckets[sched_b][m_name]
                )
                comp["friedman_omnibus_significant"] = friedman_results.get(m_name, {}).get("significant", False)
                paired_comparisons[comp_key][m_name] = comp
                all_p_values.append(comp["p_value_ttest"])
                p_value_keys.append((comp_key, m_name))

    # Apply Holm-Bonferroni correction across all paired comparisons
    if all_p_values:
        corrections = _apply_holm_bonferroni(all_p_values)
        for i, (comp_key, m_name) in enumerate(p_value_keys):
            corr = corrections[i]
            paired_comparisons[comp_key][m_name]["holm_bonferroni"] = corr
            paired_comparisons[comp_key][m_name]["significant_holm"] = corr["significant_holm"]

    return {
        "schedulers": schedulers,
        "seeds": seeds,
        "total_runs": len(raw_runs),
        "workload_config": workload_config,
        "summary": summary_by_scheduler,
        "friedman_omnibus": friedman_results,
        "paired_comparisons": paired_comparisons,
        "raw_runs": raw_runs,
        "multiple_comparison_note": (
            "Monotonic Holm-Bonferroni step-down correction is applied to all paired t-test p-values. "
            "Friedman non-parametric test is executed as an omnibus check across all schedulers per metric."
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
