"""
Time Scaling:
Maps real-world continuous timestamps (seconds) to discrete integer simulation ticks
suitable for the C scheduling engine, with documented information loss metrics.
"""

from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd


def scale_trace(
    df: pd.DataFrame,
    scale_factor: float = 1.0,
    max_burst_tick: int = 100,
    min_burst_tick: int = 1
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Scales continuous submit_time and runtime to integer simulation ticks.

    Args:
        df: Cleaned trace DataFrame with 'submit_time', 'runtime', 'priority'.
        scale_factor: Number of real-world seconds represented by 1 simulation tick.
        max_burst_tick: Maximum allowed integer burst length (to prevent engine overflow).
        min_burst_tick: Minimum integer burst length (must be >= 1).

    Returns:
        (scaled_df, information_loss_metrics)
    """
    if len(df) == 0:
        empty = pd.DataFrame(columns=["job_id", "arrival_time", "burst_time", "priority"])
        return empty, {"mae_burst": 0.0, "relative_mae_burst": 0.0, "max_burst_capped": 0}

    sf = max(scale_factor, 1e-6)

    # Shift arrivals so the earliest submit in this batch is tick 0
    t0 = df["submit_time"].min()
    arrival_ticks = np.round((df["submit_time"] - t0) / sf).astype(int)

    # Quantize burst times to integer ticks
    exact_burst_ticks = df["runtime"] / sf
    burst_ticks = np.round(exact_burst_ticks).astype(int)
    burst_capped_mask = burst_ticks > max_burst_tick
    burst_ticks = np.clip(burst_ticks, min_burst_tick, max_burst_tick)

    # Compute information loss due to discretization and capping
    reconstructed_runtime = burst_ticks * sf
    abs_errors = np.abs(reconstructed_runtime - df["runtime"])
    mae_burst = float(np.mean(abs_errors))
    mean_orig = float(np.mean(df["runtime"]))
    rel_mae = float(mae_burst / mean_orig) if mean_orig > 1e-9 else 0.0

    scaled = pd.DataFrame({
        "job_id": df["job_id"].values if "job_id" in df.columns else range(1, len(df) + 1),
        "arrival_time": arrival_ticks.values,
        "burst_time": burst_ticks.values,
        "priority": df["priority"].values if "priority" in df.columns else 1
    })

    loss_metrics = {
        "scale_factor_seconds_per_tick": sf,
        "mean_absolute_error_seconds": round(mae_burst, 4),
        "relative_mean_absolute_error": round(rel_mae, 4),
        "max_burst_cap_ticks": max_burst_tick,
        "bursts_capped_count": int(np.sum(burst_capped_mask)),
        "note": (
            f"1 simulation tick represents {sf} real seconds. "
            f"Discretization MAE is {mae_burst:.2f}s ({rel_mae * 100:.1f}% relative error)."
        )
    }

    return scaled, loss_metrics
