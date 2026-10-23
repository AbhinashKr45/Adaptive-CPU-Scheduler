"""
Workload Distribution Comparison and Parameter Fitting:
Compares empirical trace workloads against synthetic workloads using two-sample
Kolmogorov-Smirnov tests and Wasserstein distances, and finds optimal matching generator parameters via grid search.
"""

from typing import List, Dict, Any
import numpy as np
from scipy import stats
from backend.generator import generate_workload


def compare_distributions(
    procs_a: List[Dict[str, Any]],
    procs_b: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Computes two-sample Kolmogorov-Smirnov test and Wasserstein distance
    between two workloads across both burst durations and inter-arrival times.
    """
    if not procs_a or not procs_b:
        return {
            "burst_ks_stat": 0.0,
            "burst_ks_pvalue": 1.0,
            "burst_wasserstein": 0.0,
            "inter_arrival_ks_stat": 0.0,
            "inter_arrival_ks_pvalue": 1.0,
            "inter_arrival_wasserstein": 0.0,
            "composite_distance": 0.0
        }

    bursts_a = np.array([p["burst_time"] for p in procs_a], dtype=float)
    bursts_b = np.array([p["burst_time"] for p in procs_b], dtype=float)

    # 1. Burst distributions comparison
    ks_burst = stats.ks_2samp(bursts_a, bursts_b)
    wass_burst = float(stats.wasserstein_distance(bursts_a, bursts_b))

    # 2. Inter-arrival times comparison
    arr_a = np.sort(np.array([p["arrival_time"] for p in procs_a], dtype=float))
    arr_b = np.sort(np.array([p["arrival_time"] for p in procs_b], dtype=float))

    if len(arr_a) > 1 and len(arr_b) > 1:
        ia_a = np.diff(arr_a)
        ia_b = np.diff(arr_b)
        ks_ia = stats.ks_2samp(ia_a, ia_b)
        wass_ia = float(stats.wasserstein_distance(ia_a, ia_b))
        ks_ia_stat = float(ks_ia.statistic)
        ks_ia_pval = float(ks_ia.pvalue)
    else:
        ks_ia_stat = 0.0
        ks_ia_pval = 1.0
        wass_ia = 0.0

    # Composite distance: weighted sum of Wasserstein distances
    composite_dist = float(0.6 * wass_burst + 0.4 * wass_ia)

    return {
        "burst_ks_stat": round(float(ks_burst.statistic), 4),
        "burst_ks_pvalue": round(float(ks_burst.pvalue), 6),
        "burst_wasserstein": round(wass_burst, 4),
        "inter_arrival_ks_stat": round(ks_ia_stat, 4),
        "inter_arrival_ks_pvalue": round(ks_ia_pval, 6),
        "inter_arrival_wasserstein": round(wass_ia, 4),
        "composite_distance": round(composite_dist, 4)
    }


def fit_synthetic_to_trace(
    trace_procs: List[Dict[str, Any]],
    seed: int = 42
) -> Dict[str, Any]:
    """
    Performs grid search to find synthetic workload generator parameters
    (mean_burst, burst_std, burst_distribution, arrival_distribution) that minimize
    Wasserstein distance against the provided trace workload.
    """
    if not trace_procs:
        raise ValueError("Cannot fit synthetic parameters to an empty trace.")

    n = len(trace_procs)
    bursts = np.array([p["burst_time"] for p in trace_procs], dtype=float)
    arrivals = np.array([p["arrival_time"] for p in trace_procs], dtype=float)

    trace_mean_b = float(np.mean(bursts))
    trace_std_b = float(np.std(bursts))
    max_arr = int(np.max(arrivals)) if len(arrivals) > 0 else 20

    # Grid search candidate space
    mean_candidates = [
        max(1.0, round(trace_mean_b * factor, 1))
        for factor in [0.8, 1.0, 1.2]
    ]
    std_candidates = [
        max(0.5, round(trace_std_b * factor, 1))
        for factor in [0.8, 1.0, 1.2]
    ]
    burst_dists = ["normal", "exponential", "pareto"]
    arrival_dists = ["uniform", "staggered", "bursty"]

    best_score = float("inf")
    best_params = {}
    best_synthetic_procs = []
    best_comparison = {}

    for b_dist in burst_dists:
        for a_dist in arrival_dists:
            for mb in mean_candidates:
                for sb in std_candidates:
                    syn_res = generate_workload(
                        process_count=n,
                        seed=seed,
                        arrival_distribution=a_dist,
                        burst_distribution=b_dist,
                        mean_burst=mb,
                        burst_std=sb,
                        max_arrival=max(1, max_arr)
                    )
                    syn_procs = syn_res["processes"]
                    comp = compare_distributions(trace_procs, syn_procs)
                    score = comp["composite_distance"]

                    if score < best_score:
                        best_score = score
                        best_params = {
                            "arrival_distribution": a_dist,
                            "burst_distribution": b_dist,
                            "mean_burst": mb,
                            "burst_std": sb,
                            "max_arrival": max(1, max_arr),
                            "process_count": n
                        }
                        best_synthetic_procs = syn_procs
                        best_comparison = comp

    return {
        "best_generator_params": best_params,
        "best_composite_distance": round(best_score, 4),
        "comparison_stats": best_comparison,
        "best_synthetic_processes": best_synthetic_procs
    }
