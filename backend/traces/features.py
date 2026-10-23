"""
Workload Feature Extraction:
Extracts statistical and distributional workload features required for workload characterization
and the feature-only adaptive recommender.
"""

from typing import List, Dict, Any, Union
import numpy as np
import pandas as pd
from scipy import stats


def compute_hill_estimator(data: np.ndarray, tail_fraction: float = 0.2) -> float:
    """
    Computes the Hill estimator for the tail index (alpha) of a distribution:
      alpha_hat = ( (1/k) * sum_{i=1}^k ln(X_(i) / X_(k+1)) )^(-1)
    Lower alpha (< 2.0) implies heavy-tailed behavior.
    """
    n = len(data)
    if n < 4:
        return 1.0

    sorted_desc = np.sort(data)[::-1]
    k = max(2, int(np.floor(n * tail_fraction)))
    if k >= n:
        k = n - 2

    xk_plus_1 = sorted_desc[k]
    if xk_plus_1 <= 0:
        return 1.0

    top_k = sorted_desc[:k]
    ratios = top_k / xk_plus_1
    valid_ratios = ratios[ratios > 1.0]

    if len(valid_ratios) == 0:
        return 10.0  # Light tail (all values equal in tail)

    log_sum = np.sum(np.log(valid_ratios))
    if log_sum <= 1e-9:
        return 10.0

    hill_alpha = float(len(valid_ratios) / log_sum)
    return round(float(np.clip(hill_alpha, 0.1, 20.0)), 4)


def extract_workload_features(procs_or_df: Union[List[Dict[str, Any]], pd.DataFrame]) -> Dict[str, Any]:
    """
    Extracts all mandatory workload features from a process list or DataFrame:
      - process_count
      - burst_mean, burst_median, burst_cv, burst_skewness, burst_kurtosis
      - arrival_span, mean_inter_arrival_time, burstiness (CV of inter-arrivals)
      - heavy_tail_index (Hill estimator)
      - priority_spread
    """
    if isinstance(procs_or_df, pd.DataFrame):
        df = procs_or_df
        bursts = df["burst_time"].values.astype(float) if "burst_time" in df.columns else df["runtime"].values.astype(float)
        arrivals = df["arrival_time"].values.astype(float) if "arrival_time" in df.columns else df["submit_time"].values.astype(float)
        priorities = df["priority"].values.astype(int) if "priority" in df.columns else np.ones(len(df), dtype=int)
    else:
        procs = procs_or_df
        if not procs:
            return {
                "process_count": 0,
                "burst_mean": 0.0,
                "burst_median": 0.0,
                "burst_cv": 0.0,
                "burst_skewness": 0.0,
                "burst_kurtosis": 0.0,
                "arrival_span": 0,
                "mean_inter_arrival_time": 0.0,
                "burstiness": 0.0,
                "heavy_tail_index": 1.0,
                "priority_spread": 0
            }
        bursts = np.array([p["burst_time"] for p in procs], dtype=float)
        arrivals = np.array([p["arrival_time"] for p in procs], dtype=float)
        priorities = np.array([p.get("priority", 1) for p in procs], dtype=int)

    n = len(bursts)
    if n == 0:
        return {}

    b_mean = float(np.mean(bursts))
    b_median = float(np.median(bursts))
    b_std = float(np.std(bursts))
    b_cv = float(b_std / (b_mean + 1e-9))
    b_skew = float(stats.skew(bursts)) if n > 2 else 0.0
    b_kurt = float(stats.kurtosis(bursts)) if n > 3 else 0.0

    sorted_arrivals = np.sort(arrivals)
    arrival_span = int(sorted_arrivals[-1] - sorted_arrivals[0]) if n > 1 else 0

    if n > 1:
        inter_arrivals = np.diff(sorted_arrivals)
        ia_mean = float(np.mean(inter_arrivals))
        ia_std = float(np.std(inter_arrivals))
        burstiness = float(ia_std / (ia_mean + 1e-9))
    else:
        ia_mean = 0.0
        burstiness = 0.0

    heavy_tail = compute_hill_estimator(bursts)
    priority_spread = int(np.max(priorities) - np.min(priorities)) if len(priorities) > 0 else 0

    return {
        "process_count": n,
        "burst_mean": round(b_mean, 4),
        "burst_median": round(b_median, 4),
        "burst_cv": round(b_cv, 4),
        "burst_skewness": round(b_skew, 4),
        "burst_kurtosis": round(b_kurt, 4),
        "arrival_span": arrival_span,
        "mean_inter_arrival_time": round(ia_mean, 4),
        "burstiness": round(burstiness, 4),
        "heavy_tail_index": round(heavy_tail, 4),
        "priority_spread": priority_spread
    }
