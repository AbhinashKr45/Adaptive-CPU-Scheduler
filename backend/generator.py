import math
from typing import List, Dict, Any, Optional
import numpy as np

PRESET_CONFIGS = {
    "balanced": {
        "name": "Balanced Workload",
        "description": "Moderate burst lengths (mean 8) with low-to-medium variability and staggered arrivals.",
        "arrival_distribution": "staggered",
        "burst_distribution": "normal",
        "mean_burst": 8.0,
        "burst_std": 2.5,
        "skew_level": "low",
        "max_arrival": 20
    },
    "short_heavy": {
        "name": "Short-Job-Heavy Workload",
        "description": "Predominance of quick interactive tasks (bursts 1-4) with occasional background tasks.",
        "arrival_distribution": "uniform",
        "burst_distribution": "exponential",
        "mean_burst": 3.0,
        "burst_std": 2.0,
        "skew_level": "medium",
        "max_arrival": 25
    },
    "long_heavy": {
        "name": "Long-Job-Heavy Workload",
        "description": "Computationally intensive batch jobs with long execution bursts (mean 25).",
        "arrival_distribution": "uniform",
        "burst_distribution": "normal",
        "mean_burst": 25.0,
        "burst_std": 5.0,
        "skew_level": "low",
        "max_arrival": 30
    },
    "mixed": {
        "name": "Bimodal Mixed Workload",
        "description": "Mixture of high-frequency short requests and sporadic heavy computational jobs.",
        "arrival_distribution": "bursty",
        "burst_distribution": "pareto",
        "mean_burst": 10.0,
        "burst_std": 12.0,
        "skew_level": "high",
        "max_arrival": 30
    },
    "low_variability": {
        "name": "Low Burst Variability (CV ~ 0.2)",
        "description": "Consistent, predictable job lengths with very narrow deviation.",
        "arrival_distribution": "uniform",
        "burst_distribution": "normal",
        "mean_burst": 12.0,
        "burst_std": 2.4,
        "skew_level": "low",
        "max_arrival": 20
    },
    "medium_variability": {
        "name": "Medium Burst Variability (CV ~ 0.6)",
        "description": "Moderate spread in execution demands representing typical mixed OS processes.",
        "arrival_distribution": "uniform",
        "burst_distribution": "normal",
        "mean_burst": 12.0,
        "burst_std": 7.2,
        "skew_level": "medium",
        "max_arrival": 25
    },
    "high_variability": {
        "name": "High Burst Variability (CV >= 1.2)",
        "description": "High variance in process demands with extreme outliers (bursts ranging from 1 to 50+).",
        "arrival_distribution": "bursty",
        "burst_distribution": "pareto",
        "mean_burst": 12.0,
        "burst_std": 15.0,
        "skew_level": "high",
        "max_arrival": 30
    },
    "staggered_arrivals": {
        "name": "Staggered Arrivals",
        "description": "Processes arriving at steady, predictable time intervals.",
        "arrival_distribution": "staggered",
        "burst_distribution": "uniform",
        "mean_burst": 8.0,
        "burst_std": 3.0,
        "skew_level": "low",
        "max_arrival": 40
    },
    "small_demo": {
        "name": "Small Demonstration Workload",
        "description": "Compact workload suitable for manual verification and step-by-step Gantt trace inspection.",
        "arrival_distribution": "staggered",
        "burst_distribution": "uniform",
        "mean_burst": 6.0,
        "burst_std": 2.5,
        "skew_level": "low",
        "max_arrival": 6
    },
    "equal_demand": {
        "name": "Equal CPU-Demand Workload",
        "description": "All processes require identical CPU burst length. Isolates arrival sequencing and priority from burst disparity.",
        "arrival_distribution": "staggered",
        "burst_distribution": "uniform",
        "mean_burst": 8.0,
        "burst_std": 0.0,
        "skew_level": "low",
        "max_arrival": 20
    },
    "highly_unequal": {
        "name": "Highly Unequal CPU-Demand Workload",
        "description": "Extreme burst time disparity (Pareto right-skewed). Highlights convoy effects, head-of-line blocking, and starvation.",
        "arrival_distribution": "uniform",
        "burst_distribution": "pareto",
        "mean_burst": 15.0,
        "burst_std": 25.0,
        "skew_level": "high",
        "max_arrival": 20
    },
    "simultaneous_arrivals": {
        "name": "Simultaneous Arrivals",
        "description": "All processes arrive at tick 0 with varying CPU burst lengths. Isolates pure scheduling policy ordering.",
        "arrival_distribution": "simultaneous",
        "burst_distribution": "normal",
        "mean_burst": 10.0,
        "burst_std": 4.5,
        "skew_level": "medium",
        "max_arrival": 0
    },
    "high_contention": {
        "name": "High Contention Workload",
        "description": "Many processes arriving within a tight arrival window, creating severe ready-queue contention.",
        "arrival_distribution": "uniform",
        "burst_distribution": "normal",
        "mean_burst": 12.0,
        "burst_std": 4.0,
        "skew_level": "medium",
        "max_arrival": 4
    }
}


def calculate_workload_characteristics(processes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates empirical statistical properties of the workload processes."""
    if not processes:
        return {
            "process_count": 0,
            "mean_burst": 0.0,
            "std_burst": 0.0,
            "cv_burst": 0.0,
            "min_burst": 0,
            "max_burst": 0,
            "skewness": 0.0,
            "short_job_ratio": 0.0,
            "long_job_ratio": 0.0,
            "mean_arrival": 0.0,
            "arrival_span": 0
        }

    bursts = np.array([p["burst_time"] for p in processes], dtype=float)
    arrivals = np.array([p["arrival_time"] for p in processes], dtype=float)

    n = len(bursts)
    mean_b = float(np.mean(bursts))
    std_b = float(np.std(bursts))
    cv_b = float(std_b / mean_b) if mean_b > 1e-6 else 0.0

    # Fisher-Pearson skewness
    if n > 2 and std_b > 1e-6:
        m3 = float(np.mean((bursts - mean_b) ** 3))
        skewness = float(m3 / (std_b ** 3))
    else:
        skewness = 0.0

    short_jobs = np.sum(bursts <= (mean_b * 0.5))
    long_jobs = np.sum(bursts >= (mean_b * 1.5))

    return {
        "process_count": n,
        "mean_burst": round(mean_b, 3),
        "std_burst": round(std_b, 3),
        "cv_burst": round(cv_b, 3),
        "min_burst": int(np.min(bursts)),
        "max_burst": int(np.max(bursts)),
        "skewness": round(skewness, 3),
        "short_job_ratio": round(float(short_jobs / n), 3),
        "long_job_ratio": round(float(long_jobs / n), 3),
        "mean_arrival": round(float(np.mean(arrivals)), 3),
        "arrival_span": int(np.max(arrivals) - np.min(arrivals))
    }


def generate_workload(
    process_count: int = 10,
    seed: int = 42,
    arrival_distribution: str = "uniform",
    burst_distribution: str = "normal",
    mean_burst: float = 10.0,
    burst_std: float = 4.0,
    skew_level: str = "medium",
    max_arrival: int = 20,
    priority_distribution: str = "uniform",
    min_priority: int = 1,
    max_priority: int = 5,
    min_burst: int = 1,
    max_burst: int = 100
) -> Dict[str, Any]:
    """
    Deterministically generates a workload using explicit configurations and seed.
    Guarantees reproducible generation across all algorithms.
    """
    rng = np.random.default_rng(seed)

    # 1. Generate arrivals
    arr_dist = arrival_distribution.lower()
    if arr_dist == "simultaneous":
        arrivals = np.zeros(process_count, dtype=int)
    elif arr_dist == "staggered":
        step = max(1, max_arrival // max(1, process_count))
        arrivals = np.array([i * step for i in range(process_count)], dtype=int)
    elif arr_dist == "bursty":
        # Clusters of arrivals followed by quiet intervals
        arrivals = []
        cur_t = 0
        while len(arrivals) < process_count:
            cluster_size = int(rng.integers(1, 4))
            for _ in range(cluster_size):
                if len(arrivals) < process_count:
                    arrivals.append(cur_t + int(rng.integers(0, 2)))
            cur_t += int(rng.integers(3, 8))
        arrivals = np.array(arrivals[:process_count], dtype=int)
        arrivals.sort()
    else:  # uniform
        arrivals = rng.integers(0, max(1, max_arrival) + 1, size=process_count)
        arrivals.sort()

    # 2. Generate bursts
    if burst_std < 1e-9:
        raw_bursts = np.full(process_count, mean_burst, dtype=float)
    else:
        b_dist = burst_distribution.lower()
        if b_dist == "exponential":
            raw_bursts = rng.exponential(scale=mean_burst, size=process_count)
        elif b_dist == "pareto":
            # Right-skewed distribution
            alpha = 1.8 if skew_level == "high" else 2.5
            raw_bursts = (rng.pareto(a=alpha, size=process_count) + 1.0) * (mean_burst * (alpha - 1) / alpha)
        elif b_dist == "uniform":
            low = max(min_burst, int(mean_burst - burst_std * 1.732))
            high = max(low + 1, int(mean_burst + burst_std * 1.732))
            raw_bursts = rng.integers(low, high + 1, size=process_count).astype(float)
        else:  # normal
            raw_bursts = rng.normal(loc=mean_burst, scale=max(0.5, burst_std), size=process_count)

    # Bound and integerize bursts
    bursts = np.clip(np.round(raw_bursts), min_burst, max_burst).astype(int)
    # Ensure at least min_burst
    bursts = np.maximum(bursts, 1)

    # 3. Generate priorities (lower numerical = higher priority)
    p_dist = priority_distribution.lower()
    if p_dist == "fixed":
        priorities = np.full(process_count, min_priority, dtype=int)
    elif p_dist == "normal":
        mid = (min_priority + max_priority) / 2.0
        p_raw = np.round(rng.normal(loc=mid, scale=1.0, size=process_count))
        priorities = np.clip(p_raw, min_priority, max_priority).astype(int)
    else:  # uniform
        priorities = rng.integers(min_priority, max_priority + 1, size=process_count)

    processes = []
    for i in range(process_count):
        processes.append({
            "pid": i + 1,
            "arrival_time": int(arrivals[i]),
            "burst_time": int(bursts[i]),
            "priority": int(priorities[i])
        })

    characteristics = calculate_workload_characteristics(processes)

    return {
        "seed": seed,
        "config": {
            "process_count": process_count,
            "arrival_distribution": arrival_distribution,
            "burst_distribution": burst_distribution,
            "mean_burst": mean_burst,
            "burst_std": burst_std,
            "skew_level": skew_level,
            "max_arrival": max_arrival
        },
        "processes": processes,
        "characteristics": characteristics
    }


def generate_preset_workload(preset_key: str, process_count: int = 10, seed: int = 42) -> Dict[str, Any]:
    """Generates a preset workload from standardized research presets."""
    preset = PRESET_CONFIGS.get(preset_key, PRESET_CONFIGS["balanced"])
    return generate_workload(
        process_count=process_count,
        seed=seed,
        arrival_distribution=preset["arrival_distribution"],
        burst_distribution=preset["burst_distribution"],
        mean_burst=preset["mean_burst"],
        burst_std=preset["burst_std"],
        skew_level=preset["skew_level"],
        max_arrival=preset["max_arrival"]
    )
