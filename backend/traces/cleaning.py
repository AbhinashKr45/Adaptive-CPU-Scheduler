"""
Workload Trace Cleaning Pipeline:
Enforces validity constraints, handles missing values, and caps extreme outliers.
"""

from typing import List, Tuple
from dataclasses import dataclass, field
import pandas as pd
import numpy as np


@dataclass
class CleaningReport:
    total_raw_jobs: int
    dropped_missing_values: int
    dropped_negative_submit: int
    dropped_non_positive_runtime: int
    capped_outliers: int
    outlier_percentile: float
    outlier_runtime_threshold: float
    cleaned_jobs_count: int
    steps_log: List[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "total_raw_jobs": self.total_raw_jobs,
            "dropped_missing_values": self.dropped_missing_values,
            "dropped_negative_submit": self.dropped_negative_submit,
            "dropped_non_positive_runtime": self.dropped_non_positive_runtime,
            "capped_outliers": self.capped_outliers,
            "outlier_percentile": self.outlier_percentile,
            "outlier_runtime_threshold": round(self.outlier_runtime_threshold, 2),
            "cleaned_jobs_count": self.cleaned_jobs_count,
            "steps_log": self.steps_log
        }


def clean_trace(df: pd.DataFrame, outlier_percentile: float = 99.0) -> Tuple[pd.DataFrame, CleaningReport]:
    """
    Cleans raw trace DataFrame:
      1. Drops rows with missing submit_time or runtime.
      2. Drops rows with negative submit_time (< 0).
      3. Drops rows with non-positive runtime (<= 0).
      4. Fills missing priorities with default 1.
      5. Caps extreme runtime outliers at specified percentile (e.g. 99th percentile).
    """
    total_raw = len(df)
    log: List[str] = [f"Initial raw jobs: {total_raw}"]

    # 1. Missing values
    missing_mask = df["submit_time"].isna() | df["runtime"].isna()
    dropped_missing = int(missing_mask.sum())
    clean_df = df[~missing_mask].copy()
    if dropped_missing > 0:
        log.append(f"Dropped {dropped_missing} jobs with missing submit_time or runtime.")

    # 2. Negative submit time
    neg_submit_mask = clean_df["submit_time"] < 0
    dropped_neg_submit = int(neg_submit_mask.sum())
    clean_df = clean_df[~neg_submit_mask]
    if dropped_neg_submit > 0:
        log.append(f"Dropped {dropped_neg_submit} jobs with negative submit_time.")

    # 3. Non-positive runtime
    non_pos_rt_mask = clean_df["runtime"] <= 0
    dropped_non_pos_rt = int(non_pos_rt_mask.sum())
    clean_df = clean_df[~non_pos_rt_mask]
    if dropped_non_pos_rt > 0:
        log.append(f"Dropped {dropped_non_pos_rt} jobs with non-positive runtime (<= 0).")

    # Priority handling
    if "priority" in clean_df.columns:
        clean_df["priority"] = clean_df["priority"].fillna(1).clip(lower=1, upper=10).astype(int)
    else:
        clean_df["priority"] = 1

    # 4. Outlier capping
    capped_count = 0
    threshold = float("inf")
    if len(clean_df) > 0 and 0.0 < outlier_percentile < 100.0:
        threshold = float(np.percentile(clean_df["runtime"], outlier_percentile))
        outlier_mask = clean_df["runtime"] > threshold
        capped_count = int(outlier_mask.sum())
        clean_df.loc[outlier_mask, "runtime"] = threshold
        if capped_count > 0:
            log.append(f"Capped {capped_count} jobs exceeding {outlier_percentile}th percentile runtime ({threshold:.2f}s).")

    # Sort chronologically by submit time
    clean_df = clean_df.sort_values(by="submit_time").reset_index(drop=True)
    clean_df["job_id"] = range(1, len(clean_df) + 1)

    log.append(f"Final cleaned jobs count: {len(clean_df)}")

    report = CleaningReport(
        total_raw_jobs=total_raw,
        dropped_missing_values=dropped_missing,
        dropped_negative_submit=dropped_neg_submit,
        dropped_non_positive_runtime=dropped_non_pos_rt,
        capped_outliers=capped_count,
        outlier_percentile=outlier_percentile,
        outlier_runtime_threshold=threshold,
        cleaned_jobs_count=len(clean_df),
        steps_log=log
    )

    return clean_df, report
