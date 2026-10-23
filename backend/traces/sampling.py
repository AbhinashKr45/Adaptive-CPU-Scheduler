"""
Workload Trace Sampling:
Provides contiguous time-window sampling and seeded random sampling.
Preserves original chronological arrival ordering and guarantees reproducibility.
"""

from typing import List, Dict, Optional
import numpy as np
import pandas as pd


def sample_trace(
    scaled_df: pd.DataFrame,
    method: str = "random",
    count: int = 20,
    window_start_tick: int = 0,
    window_duration_ticks: Optional[int] = None,
    seed: int = 42
) -> List[Dict[str, int]]:
    """
    Samples processes from a scaled trace DataFrame.

    Args:
        scaled_df: DataFrame with 'arrival_time', 'burst_time', 'priority'.
        method: 'random' for seeded random sampling, or 'time_window' for contiguous window.
        count: Target process count (capped by available rows).
        window_start_tick: Starting arrival tick for time-window sampling.
        window_duration_ticks: Optional duration limit for time-window sampling.
        seed: Random seed for exact reproducibility.

    Returns:
        List of process dicts sorted by arrival_time, with PIDs re-indexed from 1.
    """
    if len(scaled_df) == 0:
        return []

    count = max(1, min(count, len(scaled_df)))

    if method == "time_window":
        # Contiguous time window
        mask = scaled_df["arrival_time"] >= window_start_tick
        if window_duration_ticks is not None and window_duration_ticks > 0:
            mask = mask & (scaled_df["arrival_time"] <= window_start_tick + window_duration_ticks)

        sub_df = scaled_df[mask]
        if len(sub_df) == 0:
            # Fallback if window has no jobs: take first 'count' jobs
            sub_df = scaled_df.head(count)
        else:
            sub_df = sub_df.head(count)

        sampled_rows = sub_df.copy()
    else:
        # Seeded random sampling
        rng = np.random.default_rng(seed=seed)
        chosen_indices = rng.choice(len(scaled_df), size=count, replace=False)
        # CRITICAL RULE: Preserve original arrival ordering!
        chosen_indices.sort()
        sampled_rows = scaled_df.iloc[chosen_indices].copy()

    # Normalize arrival times relative to the first process in the sample
    t0 = int(sampled_rows["arrival_time"].min())
    sampled_rows["norm_arrival"] = sampled_rows["arrival_time"].astype(int) - t0

    procs: List[Dict[str, int]] = []
    for pid_idx, (_, row) in enumerate(sampled_rows.iterrows(), start=1):
        procs.append({
            "pid": pid_idx,
            "arrival_time": int(row["norm_arrival"]),
            "burst_time": int(row["burst_time"]),
            "priority": int(row["priority"])
        })

    return procs
