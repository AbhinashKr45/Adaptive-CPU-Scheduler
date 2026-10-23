import math
import pytest
import numpy as np
from backend.experiments import (
    _apply_holm_bonferroni,
    compute_paired_comparison,
    compute_summary_stats,
    compute_friedman_test,
    bootstrap_ci_paired_diff
)

def test_holm_bonferroni_single_p_value():
    """Test Holm-Bonferroni correction with a single hypothesis (m=1)."""
    p_vals = [0.03]
    res = _apply_holm_bonferroni(p_vals, alpha=0.05)
    assert len(res) == 1
    # For m=1: adjusted_p = min(1.0, 0.03 * 1) = 0.03
    assert res[0]["original_p"] == 0.03
    assert res[0]["adjusted_p"] == 0.03
    assert res[0]["significant_holm"] is True
    assert res[0]["rank"] == 1


def test_holm_bonferroni_monotonicity_enforcement():
    """
    Test that Holm-Bonferroni strictly enforces monotonicity via running maximum.
    Suppose p = [0.03, 0.035, 0.04] (m = 3).
    Sorted p:
      Rank 1: p = 0.030 -> raw = 0.030 * (3 - 0) = 0.090
      Rank 2: p = 0.035 -> raw = 0.035 * (3 - 1) = 0.070  <-- raw drops below rank 1!
      Rank 3: p = 0.040 -> raw = 0.040 * (3 - 2) = 0.040  <-- raw drops below rank 2!
    Monotonic adjusted p-values must be:
      Rank 1: 0.090
      Rank 2: max(0.090, 0.070) = 0.090
      Rank 3: max(0.090, 0.040) = 0.090
    Without monotonicity enforcement, rank 3 would have been 0.040 (violating Holm step-down order).
    """
    p_vals = [0.03, 0.035, 0.04]
    res = _apply_holm_bonferroni(p_vals, alpha=0.05)
    assert len(res) == 3
    # Check monotonic non-decreasing order of adjusted p-values by rank
    by_rank = sorted(res, key=lambda x: x["rank"])
    for i in range(len(by_rank) - 1):
        assert by_rank[i]["adjusted_p"] <= by_rank[i + 1]["adjusted_p"]

    assert by_rank[0]["adjusted_p"] == 0.09
    assert by_rank[1]["adjusted_p"] == 0.09
    assert by_rank[2]["adjusted_p"] == 0.09
    assert by_rank[0]["significant_holm"] is False


def test_holm_bonferroni_tied_p_values():
    """Test Holm-Bonferroni correction when p-values have exact ties."""
    p_vals = [0.01, 0.01, 0.04]  # m=3
    # Sorted:
    # Rank 1: p=0.01 -> raw = 0.01 * 3 = 0.03 -> adj = 0.03
    # Rank 2: p=0.01 -> raw = 0.01 * 2 = 0.02 -> adj = max(0.03, 0.02) = 0.03
    # Rank 3: p=0.04 -> raw = 0.04 * 1 = 0.04 -> adj = max(0.03, 0.04) = 0.04
    res = _apply_holm_bonferroni(p_vals, alpha=0.05)
    assert len(res) == 3
    assert res[0]["adjusted_p"] == 0.03
    assert res[0]["significant_holm"] is True
    assert res[1]["adjusted_p"] == 0.03
    assert res[1]["significant_holm"] is True
    assert res[2]["adjusted_p"] == 0.04
    assert res[2]["significant_holm"] is True


def test_holm_bonferroni_cap_at_one():
    """Test that adjusted p-values never exceed 1.0."""
    p_vals = [0.6, 0.8]  # m=2
    # Rank 1: 0.6 * 2 = 1.2 -> capped at 1.0
    # Rank 2: 0.8 * 1 = 0.8 -> max(1.0, 0.8) = 1.0
    res = _apply_holm_bonferroni(p_vals, alpha=0.05)
    assert res[0]["adjusted_p"] == 1.0
    assert res[1]["adjusted_p"] == 1.0
    assert res[0]["significant_holm"] is False
    assert res[1]["significant_holm"] is False


def test_paired_comparison_hedges_g_and_cohens_dz():
    """
    Test paired differences, Cohen's d_z, Hedges' g correction, and bootstrap CI.
    Hand-worked example:
      a = [10.0, 12.0, 14.0, 16.0, 18.0]
      b = [8.0, 9.0, 11.0, 12.0, 13.0]
      diff = [2.0, 3.0, 3.0, 4.0, 5.0]
      n = 5
      mean_diff = (2 + 3 + 3 + 4 + 5) / 5 = 17 / 5 = 3.4
      deviations from mean: [-1.4, -0.4, -0.4, 0.6, 1.6]
      squared: [1.96, 0.16, 0.16, 0.36, 2.56] -> sum = 5.20
      sample variance (ddof=1) = 5.20 / 4 = 1.30
      std_diff = sqrt(1.30) ≈ 1.140175
      cohens_dz = 3.4 / 1.140175 ≈ 2.9820
      df = 4
      Hedges' correction factor J(4) = 1 - 3 / (4*4 - 1) = 1 - 3/15 = 0.80
      hedges_g = 2.9820 * 0.80 ≈ 2.3856
    """
    a = [10.0, 12.0, 14.0, 16.0, 18.0]
    b = [8.0, 9.0, 11.0, 12.0, 13.0]
    res = compute_paired_comparison(a, b)

    assert res["n"] == 5
    assert math.isclose(res["mean_diff"], 3.4, abs_tol=1e-3)
    assert math.isclose(res["cohens_dz"], 2.9820, abs_tol=1e-2)
    assert math.isclose(res["hedges_g"], 2.3856, abs_tol=1e-2)
    # Check that bootstrap CI bounds bracket the true mean
    assert res["ci_diff_low"] <= 3.4 <= res["ci_diff_high"]
    # t-test p-value should be significant (< 0.05)
    assert res["significant_uncorrected"] is True


def test_paired_comparison_degenerate_n_less_than_two():
    """Test degenerate case: sample size n < 2."""
    res = compute_paired_comparison([5.0], [3.0])
    assert res["n"] == 1
    assert res["mean_diff"] == 0.0
    assert res["cohens_dz"] == 0.0
    assert res["hedges_g"] == 0.0
    assert res["p_value_ttest"] == 1.0
    assert res["significant_uncorrected"] is False
    assert "Degenerate case" in res["note"]


def test_paired_comparison_degenerate_all_zeros():
    """Test degenerate case: all paired differences are zero."""
    a = [4.0, 7.0, 9.0, 12.0]
    b = [4.0, 7.0, 9.0, 12.0]
    res = compute_paired_comparison(a, b)
    assert res["n"] == 4
    assert res["mean_diff"] == 0.0
    assert res["cohens_dz"] == 0.0
    assert res["hedges_g"] == 0.0
    assert res["p_value_ttest"] == 1.0
    assert res["p_value_wilcoxon"] == 1.0
    assert res["significant_uncorrected"] is False
    assert "identical results" in res["note"]


def test_paired_comparison_degenerate_constant_difference():
    """Test degenerate case: constant non-zero difference across all seeds (zero variance)."""
    a = [6.0, 9.0, 11.0, 14.0]
    b = [4.0, 7.0, 9.0, 12.0]  # diff is always exactly +2.0
    res = compute_paired_comparison(a, b)
    assert res["n"] == 4
    assert res["mean_diff"] == 2.0
    assert res["cohens_dz"] == 0.0
    assert res["hedges_g"] == 0.0
    assert res["ci_diff_low"] == 2.0
    assert res["ci_diff_high"] == 2.0
    assert "constant non-zero difference" in res["note"]


def test_friedman_test_significant():
    """Test Friedman omnibus test with clearly differentiated policies."""
    # 4 seeds, 3 schedulers: policy A always best, B intermediate, C worst
    metric_buckets = {
        "A": {"avg_waiting_time": [1.0, 2.0, 1.5, 2.2]},
        "B": {"avg_waiting_time": [5.0, 6.0, 5.5, 6.2]},
        "C": {"avg_waiting_time": [10.0, 11.0, 10.5, 12.0]}
    }
    res = compute_friedman_test(metric_buckets, ["A", "B", "C"], "avg_waiting_time")
    assert res["df"] == 2
    assert res["p_value"] < 0.05
    assert res["significant"] is True
    assert res["chi2_stat"] > 0


def test_friedman_test_degenerate_all_equal():
    """Test Friedman omnibus test when all policies produce identical values."""
    metric_buckets = {
        "A": {"makespan": [20.0, 25.0, 30.0]},
        "B": {"makespan": [20.0, 25.0, 30.0]},
        "C": {"makespan": [20.0, 25.0, 30.0]}
    }
    # Values across policies for each seed are equal, but let's test completely uniform
    all_flat_buckets = {
        "A": {"makespan": [20.0, 20.0, 20.0]},
        "B": {"makespan": [20.0, 20.0, 20.0]},
        "C": {"makespan": [20.0, 20.0, 20.0]}
    }
    res = compute_friedman_test(all_flat_buckets, ["A", "B", "C"], "makespan")
    assert res["significant"] is False
    assert "zero inter-scheduler variance" in res["note"]
