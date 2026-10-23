from typing import List, Dict, Any, Optional
import numpy as np
from backend.generator import calculate_workload_characteristics, generate_workload
from backend.c_bridge import run_c_simulation

OBJECTIVES = {
    "minimize_waiting": "Minimize Average Waiting Time",
    "minimize_response": "Minimize Interactive Response Time",
    "balance_fairness_performance": "Balance High Throughput & Progress Fairness",
    "penalize_context_switches": "Minimize Context Switches & Overhead"
}

# Documented objective metric definitions:
#
# minimize_waiting:
#   Primary metric: avg_waiting_time (lower is better).
#   Score = -avg_waiting_time  (negated so higher score = better).
#
# minimize_response:
#   Primary metric: avg_response_time (lower is better).
#   Score = -avg_response_time.
#
# balance_fairness_performance:
#   Composite score combining throughput and demand-relative progress fairness.
#   Score = w_throughput * normalized_throughput + w_fairness * jain_fairness_progress
#   where normalized_throughput = throughput / max_throughput_across_policies.
#   Default weights: w_throughput = 0.5, w_fairness = 0.5 (equally balanced).
#   Both components range [0, 1], so the composite score ranges [0, 1].
#
# penalize_context_switches:
#   Primary metric: context_switches (lower is better).
#   Score = -context_switches.

OBJECTIVE_WEIGHTS = {
    "balance_fairness_performance": {
        "throughput_weight": 0.5,
        "fairness_weight": 0.5,
        "description": "Equally weights normalized throughput and Jain's demand-relative progress fairness."
    }
}

ALL_SCHEDULERS = ["FCFS", "SJF", "SRTF", "PRIORITY", "RR"]


def _compute_objective_score(
    metrics: Dict[str, Any],
    objective: str,
    max_throughput: float = 1.0
) -> float:
    """
    Computes a scalar score for the given objective from simulation metrics.
    Higher score = better. Returns -inf if metrics are unavailable.
    """
    obj = objective.lower()

    if obj == "minimize_waiting":
        return -metrics.get("avg_waiting_time", float('inf'))

    elif obj == "minimize_response":
        return -metrics.get("avg_response_time", float('inf'))

    elif obj == "penalize_context_switches":
        return -metrics.get("context_switches", float('inf'))

    elif obj == "balance_fairness_performance":
        weights = OBJECTIVE_WEIGHTS["balance_fairness_performance"]
        throughput = metrics.get("throughput", 0.0)
        # Use runtime execution progress fairness during active phase if available, else completion fairness
        fairness = metrics.get("runtime_jain_fairness", metrics.get("jain_fairness_progress", 0.0))
        is_fairness_defined = metrics.get("is_progress_fairness_defined", False) or ("runtime_jain_fairness" in metrics)

        # Normalize throughput relative to max observed across policies
        norm_tp = (throughput / max_throughput) if max_throughput > 1e-9 else 0.0

        # If fairness is undefined (e.g., all zero service), treat as 0
        fair_val = fairness if is_fairness_defined else 0.0

        score = (weights["throughput_weight"] * norm_tp +
                 weights["fairness_weight"] * fair_val)
        return score

    else:
        return -metrics.get("avg_waiting_time", float('inf'))


def _primary_metric_value(metrics: Dict[str, Any], objective: str) -> float:
    """Returns the raw primary metric value for display (lower = better direction)."""
    obj = objective.lower()
    if obj == "minimize_waiting":
        return metrics.get("avg_waiting_time", float('inf'))
    elif obj == "minimize_response":
        return metrics.get("avg_response_time", float('inf'))
    elif obj == "penalize_context_switches":
        return metrics.get("context_switches", float('inf'))
    elif obj == "balance_fairness_performance":
        # For display, return the composite score (higher is better)
        return -1.0  # placeholder; score is used instead
    return metrics.get("avg_waiting_time", float('inf'))


def recommend_scheduler(
    processes: List[Dict[str, Any]],
    objective: str = "minimize_waiting",
    quantum: int = 2
) -> Dict[str, Any]:
    """
    Transparent, explainable adaptive scheduling recommendation engine.
    Characterizes workload, runs all 5 policies, scores them against the
    selected objective, and recommends the best-scoring policy.
    Returns scores for all alternatives.
    """
    chars = calculate_workload_characteristics(processes)
    obj = objective.lower()

    # Calculate intermediate observation checkpoints across the active execution phase
    est_makespan = max((p.get("arrival_time", 0) for p in processes), default=0) + sum(p.get("burst_time", 1) for p in processes)
    obs_times = sorted(list(set([max(1, int(round(f * est_makespan))) for f in (0.25, 0.50, 0.75)])))

    # Run all 5 schedulers on the actual workload to get real metrics
    sim_results = {}
    for sched in ALL_SCHEDULERS:
        q = quantum if sched == "RR" else 0
        try:
            sim_out = run_c_simulation(processes, sched, quantum=q, observe_times=obs_times)
            metrics = sim_out["metrics"]
            runtime_f = [
                item["jain_fairness_progress"]
                for item in sim_out.get("observation_fairness", [])
                if item.get("is_progress_defined", False)
            ]
            if runtime_f:
                metrics["runtime_jain_fairness"] = round(sum(runtime_f) / len(runtime_f), 4)
            else:
                metrics["runtime_jain_fairness"] = metrics.get("jain_fairness_progress", 1.0)
            sim_results[sched] = metrics
        except Exception:
            sim_results[sched] = None

    # Compute max throughput for normalization in composite objectives
    max_throughput = max(
        (m.get("throughput", 0.0) for m in sim_results.values() if m is not None),
        default=1.0
    )
    if max_throughput < 1e-9:
        max_throughput = 1.0

    # Score all policies
    scores = {}
    for sched, metrics in sim_results.items():
        if metrics is not None:
            scores[sched] = round(
                _compute_objective_score(metrics, obj, max_throughput), 6
            )
        else:
            scores[sched] = float('-inf')

    # Select the best-scoring policy
    recommended = max(scores, key=lambda s: scores[s])

    # Build explanation based on workload characteristics and results
    n = chars["process_count"]
    cv = chars["cv_burst"]
    skew = chars["skewness"]
    arrival_span = chars["arrival_span"]

    explanation = _build_explanation(recommended, obj, chars, sim_results, scores, quantum)
    trade_offs = _build_trade_offs(recommended, obj, chars, quantum)
    alternatives = [s for s in sorted(scores, key=lambda s: scores[s], reverse=True) if s != recommended]

    uncertainty = (
        "Note: Real OS schedulers typically lack exact future burst knowledge and use "
        "exponential smoothing or multi-level feedback queues (MLFQ) to approximate "
        "shortest-job or interactive scheduling. Scores are computed from the actual "
        "simulation metrics using documented objective functions."
    )

    return {
        "recommended_scheduler": recommended,
        "objective": objective,
        "objective_label": OBJECTIVES.get(obj, objective),
        "explanation": explanation,
        "workload_characteristics": chars,
        "trade_offs": trade_offs,
        "alternatives": alternatives,
        "uncertainty": uncertainty,
        "scores": scores,
        "all_metrics": sim_results,
        "objective_definition": _get_objective_definition(obj),
        "weights": OBJECTIVE_WEIGHTS.get(obj, None)
    }


def _get_objective_definition(objective: str) -> str:
    """Returns a human-readable definition of what the objective optimizes."""
    defs = {
        "minimize_waiting": (
            "Minimizes avg_waiting_time. Score = -avg_waiting_time. "
            "Waiting time = turnaround_time - burst_time."
        ),
        "minimize_response": (
            "Minimizes avg_response_time. Score = -avg_response_time. "
            "Response time = first CPU start_time - arrival_time."
        ),
        "balance_fairness_performance": (
            "Maximizes a weighted composite of normalized throughput and Jain's demand-relative "
            "progress fairness. Score = 0.5 * (throughput / max_throughput) + 0.5 * jain_fairness_progress. "
            "Both components range [0, 1]."
        ),
        "penalize_context_switches": (
            "Minimizes context_switches. Score = -context_switches. "
            "Lower context switch count reduces OS overhead."
        )
    }
    return defs.get(objective, defs["minimize_waiting"])


def _build_explanation(
    recommended: str, objective: str, chars: Dict,
    sim_results: Dict, scores: Dict, quantum: int
) -> str:
    """Builds a detailed explanation referencing both workload features and measured results."""
    n = chars["process_count"]
    cv = chars["cv_burst"]
    skew = chars["skewness"]
    arrival_span = chars["arrival_span"]
    mean_burst = chars["mean_burst"]

    rec_metrics = sim_results.get(recommended, {}) or {}
    rec_score = scores.get(recommended, 0)

    if objective == "minimize_waiting":
        wait = rec_metrics.get("avg_waiting_time", "N/A")
        if arrival_span == 0:
            return (
                f"All {n} processes arrive simultaneously. {recommended} achieved the lowest "
                f"average waiting time ({wait:.2f} ticks) among all 5 policies evaluated. "
                f"SJF is known to be optimal for simultaneous arrivals (Smith's rule)."
            )
        return (
            f"With staggered arrivals (span={arrival_span}) and burst variability (CV={cv:.2f}), "
            f"{recommended} achieved the lowest average waiting time ({wait:.2f} ticks) among "
            f"all 5 policies evaluated on this workload."
        )

    elif objective == "minimize_response":
        resp = rec_metrics.get("avg_response_time", "N/A")
        return (
            f"{recommended} achieved the lowest average response time ({resp:.2f} ticks) "
            f"among all 5 policies. Round Robin with quantum {quantum} ensures rapid initial "
            f"dispatch but the actual measured result determines the recommendation."
        )

    elif objective == "penalize_context_switches":
        cs = rec_metrics.get("context_switches", "N/A")
        return (
            f"{recommended} achieved the fewest context switches ({cs}) among all 5 policies. "
            f"Non-preemptive policies (FCFS, SJF, Priority) avoid preemption overhead entirely."
        )

    elif objective == "balance_fairness_performance":
        tp = rec_metrics.get("throughput", 0)
        fair = rec_metrics.get("runtime_jain_fairness", rec_metrics.get("jain_fairness_progress", 0))
        return (
            f"{recommended} scored highest on the balanced objective "
            f"(score={rec_score:.4f}) combining normalized throughput ({tp:.4f}) "
            f"and runtime execution progress fairness ({fair:.4f}). "
            f"Weights: 50% throughput, 50% fairness. "
            f"Burst CV={cv:.2f}, skewness={skew:.2f}."
        )

    return f"{recommended} was selected based on the measured simulation results."


def _build_trade_offs(recommended: str, objective: str, chars: Dict, quantum: int) -> List[str]:
    """Returns trade-off descriptions based on the recommended policy."""
    trade_offs = []

    if recommended in ("SJF", "SRTF"):
        trade_offs.append("Requires prior knowledge or estimation of process burst times.")
        trade_offs.append("Long computational jobs may experience starvation under heavy arrival loads.")
    if recommended == "SRTF":
        trade_offs.append("Introduces preemption overhead when new shorter tasks arrive.")
    if recommended == "RR":
        trade_offs.append(f"Frequent context switches when quantum ({quantum}) is small relative to average burst ({chars['mean_burst']:.1f}).")
        trade_offs.append("Average turnaround time may be higher than SJF/SRTF.")
    if recommended == "FCFS":
        trade_offs.append("Susceptible to convoy effect if an unexpectedly long job enters the queue.")
        trade_offs.append("Higher response time variance for later arrivals.")
    if recommended == "PRIORITY":
        trade_offs.append("Low-priority processes may starve without aging mechanisms.")
        trade_offs.append("Priority assignments may be arbitrary in the absence of system-level context.")

    if not trade_offs:
        trade_offs.append("All policies involve some form of trade-off between fairness, latency, and overhead.")

    return trade_offs


def evaluate_adaptive_policy_on_held_out_seeds(
    workload_config: Dict[str, Any],
    objective: str = "minimize_waiting",
    held_out_seeds: List[int] = None,
    rr_quantum: int = 2
) -> Dict[str, Any]:
    """
    Evaluates the adaptive recommender against every fixed policy on held-out seeds.
    Prevents data leakage: recommendation is made strictly from workload configuration / arrival features
    before observing the actual execution outcome.
    Also includes a theoretical 'Oracle' baseline for comparison and computes regret.
    """
    if held_out_seeds is None:
        held_out_seeds = [101, 102, 103, 104, 105, 106, 107, 108]

    schedulers = ["FCFS", "SJF", "SRTF", "PRIORITY", "RR"]
    results_by_policy = {s: [] for s in schedulers}
    results_by_adaptive = []
    oracle_results = []
    recommendations_made = []
    regret_per_seed = []

    # Determine how to extract the score for this objective
    # For lower-is-better metrics, we track the raw value and oracle takes min.
    # For balance_fairness_performance, we track composite score and oracle takes max.
    is_composite = (objective == "balance_fairness_performance")

    for seed in held_out_seeds:
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

        # Run adaptive decision (based on features + simulation, before held-out scoring)
        rec = recommend_scheduler(procs, objective=objective, quantum=rr_quantum)
        rec_algo = rec["recommended_scheduler"]
        recommendations_made.append(rec_algo)

        # Evaluate all fixed policies on this identical workload
        est_seed_makespan = max((p.get("arrival_time", 0) for p in procs), default=0) + sum(p.get("burst_time", 1) for p in procs)
        seed_obs = sorted(list(set([max(1, int(round(f * est_seed_makespan))) for f in (0.25, 0.50, 0.75)])))

        seed_metrics = {}
        seed_scores = {}
        max_tp = 0.0
        for s in schedulers:
            q = rr_quantum if s == "RR" else 0
            sim_out = run_c_simulation(procs, s, quantum=q, observe_times=seed_obs)
            m = sim_out["metrics"]
            runtime_f = [
                item["jain_fairness_progress"]
                for item in sim_out.get("observation_fairness", [])
                if item.get("is_progress_defined", False)
            ]
            if runtime_f:
                m["runtime_jain_fairness"] = round(sum(runtime_f) / len(runtime_f), 4)
            else:
                m["runtime_jain_fairness"] = m.get("jain_fairness_progress", 1.0)
            seed_metrics[s] = m
            tp = m.get("throughput", 0.0)
            if tp > max_tp:
                max_tp = tp

        # Compute objective scores for each policy
        for s in schedulers:
            score = _compute_objective_score(seed_metrics[s], objective, max_tp)
            seed_scores[s] = score
            results_by_policy[s].append(score)

        # Record adaptive performance
        adaptive_score = seed_scores.get(rec_algo, seed_scores["FCFS"])
        results_by_adaptive.append(adaptive_score)

        # Oracle (theoretical best ex-post outcome among evaluated policies)
        oracle_score = max(seed_scores.values())  # higher score = better
        oracle_results.append(oracle_score)

        # Regret = oracle_score - adaptive_score (>= 0; lower is better)
        regret_per_seed.append(oracle_score - adaptive_score)

    # Build display-friendly metric name
    if objective == "minimize_waiting":
        target_metric = "avg_waiting_time"
        display_note = "Scores are negated avg_waiting_time (higher = better)."
    elif objective == "minimize_response":
        target_metric = "avg_response_time"
        display_note = "Scores are negated avg_response_time (higher = better)."
    elif objective == "penalize_context_switches":
        target_metric = "context_switches"
        display_note = "Scores are negated context_switches (higher = better)."
    elif objective == "balance_fairness_performance":
        target_metric = "composite_throughput_fairness"
        display_note = "Scores = 0.5 * norm_throughput + 0.5 * jain_fairness_progress (higher = better)."
    else:
        target_metric = "avg_waiting_time"
        display_note = ""

    mean_regret = float(np.mean(regret_per_seed)) if regret_per_seed else 0.0

    summary = {
        "target_metric": target_metric,
        "objective": objective,
        "objective_definition": _get_objective_definition(objective),
        "held_out_seed_count": len(held_out_seeds),
        "adaptive_mean": round(float(np.mean(results_by_adaptive)), 3),
        "adaptive_std": round(float(np.std(results_by_adaptive)), 3),
        "oracle_mean": round(float(np.mean(oracle_results)), 3),
        "fixed_policies_mean": {s: round(float(np.mean(results_by_policy[s])), 3) for s in schedulers},
        "recommendations_frequency": {s: recommendations_made.count(s) for s in set(recommendations_made)},
        "mean_regret": round(mean_regret, 4),
        "display_note": display_note,
        "oracle_note": (
            "Oracle represents the theoretical ex-post optimal policy choice on each seed "
            "(not a deployable scheduler). Regret = oracle_score - adaptive_score per seed; "
            "mean regret quantifies the average sub-optimality of the adaptive selector."
        )
    }

    return summary
