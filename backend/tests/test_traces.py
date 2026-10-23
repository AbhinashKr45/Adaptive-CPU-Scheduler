"""
Unit and Fixture Tests for Trace Pipeline (Phase 3 Gate):
Tests parsers, cleaning rules, reproducibility of sampling, feature extraction,
and Kolmogorov-Smirnov / Wasserstein comparison.
"""

import os
import pytest
import pandas as pd
import numpy as np

from backend.traces.parsers import parse_swf, parse_csv, parse_trace
from backend.traces.cleaning import clean_trace, CleaningReport
from backend.traces.scaling import scale_trace
from backend.traces.sampling import sample_trace
from backend.traces.features import extract_workload_features, compute_hill_estimator
from backend.traces.comparison import compare_distributions, fit_synthetic_to_trace


@pytest.fixture
def raw_swf_content():
    """Standard Workload Format fixture with comments, valid rows, and invalid rows."""
    return """
; Version: 2.2
; Computer: Test Cluster
; MaxJobs: 4
1    0    2    10    1    10    -1    1    10    -1    1    100    1    1    3    1    -1    -1
2    5    1     4    1     4    -1    1     4    -1    1    101    1    1    1    1    -1    -1
3   12    0    20    1    20    -1    1    20    -1    1    102    1    1    2    1    -1    -1
4   -5    0     8    1     8    -1    1     8    -1    1    103    1    1    1    1    -1    -1
5   25    0     0    1     0    -1    1     0    -1    1    104    1    1    1    1    -1    -1
"""


@pytest.fixture
def raw_csv_content():
    """Generic CSV fixture with dirty values for cleaning validation."""
    return """job_id,submit_time,runtime,priority,user
1,0.0,12.5,2,alice
2,4.2,6.0,1,bob
3,10.0,8.0,3,charlie
4,-2.0,5.0,1,dirty_negative_submit
5,15.0,-1.0,2,dirty_negative_runtime
6,20.0,0.0,1,dirty_zero_runtime
7,,14.0,2,dirty_missing_submit
8,25.0,,1,dirty_missing_runtime
9,30.0,200.0,1,outlier_job
"""


def test_swf_parser(raw_swf_content):
    df = parse_swf(raw_swf_content)
    assert len(df) == 5
    assert list(df.columns) == ["job_id", "submit_time", "runtime", "priority"]
    assert df.iloc[0]["job_id"] == 1
    assert df.iloc[0]["submit_time"] == 0.0
    assert df.iloc[0]["runtime"] == 10.0
    assert df.iloc[0]["priority"] == 3


def test_csv_parser(raw_csv_content):
    df = parse_csv(raw_csv_content)
    assert len(df) == 9
    assert "submit_time" in df.columns
    assert "runtime" in df.columns
    assert "priority" in df.columns
    assert df.iloc[0]["runtime"] == 12.5


def test_cleaning_rules(raw_csv_content):
    """Verifies that each cleaning rule accurately purges bad data and reports counts."""
    raw_df = parse_csv(raw_csv_content)
    clean_df, report = clean_trace(raw_df, outlier_percentile=90.0)

    assert isinstance(report, CleaningReport)
    assert report.total_raw_jobs == 9
    # Dropped missing: rows 7 & 8 -> 2
    assert report.dropped_missing_values == 2
    # Dropped negative submit: row 4 -> 1
    assert report.dropped_negative_submit == 1
    # Dropped non-positive runtime: rows 5 & 6 -> 2
    assert report.dropped_non_positive_runtime == 2

    # Remaining valid rows: 1, 2, 3, 9 -> 4 jobs
    assert len(clean_df) == 4
    assert report.cleaned_jobs_count == 4

    # Outlier capping: row 9 had 200.0s runtime, capped at 90th percentile
    assert report.capped_outliers == 1
    assert clean_df.iloc[-1]["runtime"] <= report.outlier_runtime_threshold


def test_scaling_and_quantization_loss():
    df = pd.DataFrame({
        "job_id": [1, 2, 3],
        "submit_time": [0.0, 2.3, 5.8],
        "runtime": [4.2, 8.7, 12.1],
        "priority": [1, 2, 1]
    })
    scaled_df, loss = scale_trace(df, scale_factor=2.0, max_burst_tick=50)

    assert len(scaled_df) == 3
    # Arrivals rounded with scale_factor=2.0: 0/2=0, 2.3/2=1, 5.8/2=3
    assert list(scaled_df["arrival_time"]) == [0, 1, 3]
    # Bursts rounded with scale_factor=2.0: 4.2/2=2, 8.7/2=4, 12.1/2=6
    assert list(scaled_df["burst_time"]) == [2, 4, 6]
    assert loss["scale_factor_seconds_per_tick"] == 2.0
    assert loss["mean_absolute_error_seconds"] >= 0.0


def test_sampling_reproducibility():
    """Validates that seeded sampling produces 100% byte-for-byte identical workloads."""
    df = pd.DataFrame({
        "job_id": range(1, 51),
        "arrival_time": np.arange(0, 100, 2),
        "burst_time": np.random.randint(2, 20, size=50),
        "priority": np.random.randint(1, 5, size=50)
    })

    sample_1 = sample_trace(df, method="random", count=15, seed=12345)
    sample_2 = sample_trace(df, method="random", count=15, seed=12345)
    sample_diff_seed = sample_trace(df, method="random", count=15, seed=99999)

    assert sample_1 == sample_2, "Seeded sampling must be strictly reproducible"
    assert sample_1 != sample_diff_seed, "Different seeds should produce different samples"


def test_sampling_arrival_ordering():
    """Asserts that sampling preserves chronological arrival order."""
    df = pd.DataFrame({
        "job_id": range(1, 40),
        "arrival_time": np.sort(np.random.randint(0, 100, size=39)),
        "burst_time": np.random.randint(1, 15, size=39),
        "priority": [1] * 39
    })

    sampled = sample_trace(df, method="random", count=12, seed=42)
    arrivals = [p["arrival_time"] for p in sampled]
    assert arrivals == sorted(arrivals), "Arrivals must preserve chronological non-descending order"
    assert arrivals[0] == 0, "Normalized sample arrivals should start at tick 0"


def test_feature_extraction():
    procs = [
        {"pid": 1, "arrival_time": 0, "burst_time": 4, "priority": 1},
        {"pid": 2, "arrival_time": 3, "burst_time": 8, "priority": 2},
        {"pid": 3, "arrival_time": 5, "burst_time": 2, "priority": 4},
        {"pid": 4, "arrival_time": 10, "burst_time": 14, "priority": 3}
    ]
    feats = extract_workload_features(procs)

    assert feats["process_count"] == 4
    assert feats["burst_mean"] == (4 + 8 + 2 + 14) / 4.0  # 7.0
    assert feats["burst_median"] == 6.0
    assert feats["arrival_span"] == 10
    assert feats["priority_spread"] == 3
    assert feats["heavy_tail_index"] > 0.0


def test_distribution_comparison_ks_and_wasserstein():
    procs_a = [
        {"pid": 1, "arrival_time": 0, "burst_time": 5, "priority": 1},
        {"pid": 2, "arrival_time": 2, "burst_time": 10, "priority": 1},
        {"pid": 3, "arrival_time": 4, "burst_time": 15, "priority": 1}
    ]
    # Identical workload -> KS p-value=1.0, Wasserstein distance=0.0
    res_identical = compare_distributions(procs_a, procs_a)
    assert res_identical["burst_wasserstein"] == 0.0
    assert res_identical["burst_ks_pvalue"] == 1.0
    assert res_identical["composite_distance"] == 0.0

    # Distinct workload
    procs_b = [
        {"pid": 1, "arrival_time": 0, "burst_time": 25, "priority": 1},
        {"pid": 2, "arrival_time": 5, "burst_time": 30, "priority": 1},
        {"pid": 3, "arrival_time": 10, "burst_time": 35, "priority": 1}
    ]
    res_diff = compare_distributions(procs_a, procs_b)
    assert res_diff["burst_wasserstein"] == 20.0  # [25-5, 30-10, 35-15] = 20.0
    assert res_diff["burst_ks_stat"] == 1.0


def test_grid_search_fitting():
    trace_procs = [
        {"pid": 1, "arrival_time": 0, "burst_time": 10, "priority": 1},
        {"pid": 2, "arrival_time": 2, "burst_time": 12, "priority": 1},
        {"pid": 3, "arrival_time": 4, "burst_time": 8, "priority": 1},
        {"pid": 4, "arrival_time": 6, "burst_time": 10, "priority": 1}
    ]
    fit_res = fit_synthetic_to_trace(trace_procs, seed=42)

    assert "best_generator_params" in fit_res
    assert "best_composite_distance" in fit_res
    assert "best_synthetic_processes" in fit_res
    assert fit_res["best_composite_distance"] >= 0.0
    assert len(fit_res["best_synthetic_processes"]) == 4
