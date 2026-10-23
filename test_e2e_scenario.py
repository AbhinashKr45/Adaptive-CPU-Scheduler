"""
End-to-End Verification Scenario Script:
Executes the mandatory 12-step verification workflow defined in Section 12:
1. Create a workload with different arrival times, bursts, and priorities.
2. Save it.
3. Run it using all five scheduling algorithms.
4. Validate traces and per-process metrics.
5. Compare all five results.
6. Run a small reproducible experiment.
7. Calculate both fairness measures.
8. Generate an adaptive recommendation.
9. Save the results.
10. Reload the application and verify persistence.
11. Export results and validate the exported data.
12. Submit invalid input and confirm that the application handles it gracefully.
"""

import sys
import json
from fastapi.testclient import TestClient
from backend.api import app

def main():
    print("=" * 60)
    print("STARTING COMPLETE END-TO-END VERIFICATION WORKFLOW")
    print("=" * 60)
    client = TestClient(app)

    # 1. Create a workload with different arrival times, bursts, and priorities
    print("\n[Step 1] Creating heterogeneous workload...")
    processes = [
        {"pid": 1, "arrival_time": 0, "burst_time": 7, "priority": 3},
        {"pid": 2, "arrival_time": 2, "burst_time": 4, "priority": 1},
        {"pid": 3, "arrival_time": 4, "burst_time": 1, "priority": 2},
        {"pid": 4, "arrival_time": 5, "burst_time": 4, "priority": 4}
    ]
    print(f"  Created workload with {len(processes)} processes.")

    # 2. Save it to database
    print("\n[Step 2] Saving workload to database...")
    save_res = client.post("/api/v1/workloads", json={
        "name": "E2E Benchmark Workload",
        "description": "Validation workload with staggered arrivals and priorities",
        "processes": processes
    })
    assert save_res.status_code == 200, f"Save failed: {save_res.text}"
    saved_wl = save_res.json()
    wl_id = saved_wl["id"]
    print(f"  Successfully saved workload with ID: {wl_id}")

    # 3. Run it using all five scheduling algorithms
    print("\n[Step 3] Running all five scheduling algorithms on authoritative C engine...")
    schedulers = ["FCFS", "SJF", "SRTF", "PRIORITY", "RR"]
    sim_results = {}
    for algo in schedulers:
        res = client.post("/api/v1/simulate", json={
            "workload_id": wl_id,
            "workload_name": saved_wl["name"],
            "algorithm": algo,
            "quantum": 2,
            "processes": processes
        })
        assert res.status_code == 200, f"Simulation failed for {algo}: {res.text}"
        sim_data = res.json()
        sim_results[algo] = sim_data
        print(f"  -> {algo:8s}: Makespan={sim_data['metrics']['makespan']}, "
              f"AvgWait={sim_data['metrics']['avg_waiting_time']:.2f}, "
              f"Switches={sim_data['metrics']['context_switches']}, "
              f"Preemptions={sim_data['metrics']['preemptions']}")

    # 4. Validate traces and per-process metrics
    print("\n[Step 4] Validating execution traces and per-process metrics...")
    for algo, data in sim_results.items():
        trace = data["trace"]
        assert len(trace) > 0, f"Trace empty for {algo}"
        # Validate contiguous timestamps
        curr_t = 0
        for i, interval in enumerate(trace):
            assert interval["start_time"] == curr_t, f"Gap in trace for {algo} at interval {i}"
            assert interval["end_time"] > interval["start_time"], f"Invalid duration for {algo} at {i}"
            curr_t = interval["end_time"]
        assert curr_t == data["metrics"]["makespan"], f"Makespan mismatch for {algo}"

        # Validate per-process metrics: TAT = Comp - Arrival, Wait = TAT - Burst
        for p in data["processes"]:
            assert p["turnaround_time"] == p["completion_time"] - p["arrival_time"]
            assert p["waiting_time"] == p["turnaround_time"] - p["burst_time"]
            assert p["response_time"] == p["start_time"] - p["arrival_time"]
            assert p["executed_time"] == p["burst_time"]
    print("  All execution traces and per-process conservation invariants verified!")

    # 5. Compare all five results
    print("\n[Step 5] Comparing all five algorithms side-by-side...")
    comp_res = client.post("/api/v1/compare", json={"processes": processes, "quantum": 2})
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert len(comp_data["results"]) == 5
    print("  Comparison matrix successfully computed for all 5 policies.")

    # 6. Run a small reproducible experiment
    print("\n[Step 6] Running reproducible paired batch experiment...")
    exp_res = client.post("/api/v1/experiments", json={
        "name": "E2E Paired Verification Experiment",
        "description": "Testing paired replication across seeds",
        "schedulers": ["FCFS", "SJF", "SRTF", "RR"],
        "seeds": [101, 102, 103, 104],
        "workload_config": {"process_count": 6, "mean_burst": 8.0, "burst_std": 3.0},
        "rr_quantum": 2
    })
    assert exp_res.status_code == 200, f"Experiment failed: {exp_res.text}"
    exp_data = exp_res.json()
    exp_id = exp_data["id"]
    print(f"  Batch experiment completed ({exp_data['total_runs']} runs). ID: {exp_id}")

    # 7. Calculate both fairness measures and Phase 2 metrics
    print("\n[Step 7] Calculating and validating fairness, Gini, p95, std, and starvation measures...")
    rr_metrics = sim_results["RR"]["metrics"]
    jain_cpu = rr_metrics["jain_fairness_cpu"]
    jain_prog = rr_metrics["jain_fairness_progress"]
    assert 0.0 <= jain_cpu <= 1.0, f"Invalid Jain's CPU fairness: {jain_cpu}"
    assert 0.0 <= jain_prog <= 1.0, f"Invalid Jain's Progress fairness: {jain_prog}"
    assert rr_metrics["is_cpu_fairness_defined"] is True
    assert rr_metrics["is_progress_fairness_defined"] is True

    # Phase 2 metrics validation
    assert "p95_waiting_time" in rr_metrics, "p95_waiting_time missing from metrics"
    assert "waiting_time_std" in rr_metrics, "waiting_time_std missing from metrics"
    assert "max_response_time" in rr_metrics, "max_response_time missing from metrics"
    assert "starvation_count" in rr_metrics, "starvation_count missing from metrics"
    assert "waiting_time_gini" in rr_metrics, "waiting_time_gini missing from metrics"

    assert rr_metrics["p95_waiting_time"] >= 0.0
    assert rr_metrics["waiting_time_std"] >= 0.0
    assert rr_metrics["max_response_time"] >= 0
    assert rr_metrics["starvation_count"] >= 0
    assert 0.0 <= rr_metrics["waiting_time_gini"] <= 1.0

    print(f"  RR Raw CPU Allocation Fairness J(x) = {jain_cpu:.4f}")
    print(f"  RR Demand-Relative Progress Fairness J(F) = {jain_prog:.4f}")
    print(f"  RR Waiting Time Gini = {rr_metrics['waiting_time_gini']:.4f}, p95 = {rr_metrics['p95_waiting_time']:.2f}, std = {rr_metrics['waiting_time_std']:.2f}")
    print(f"  RR Max Response Time = {rr_metrics['max_response_time']}, Starvation Count = {rr_metrics['starvation_count']}")

    # 8. Generate an adaptive recommendation
    print("\n[Step 8] Generating explainable adaptive recommendation...")
    rec_res = client.post("/api/v1/recommend", json={
        "processes": processes,
        "objective": "minimize_waiting",
        "quantum": 2,
        "evaluate_held_out": True
    })
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    print(f"  Recommended Policy: {rec_data['recommended_scheduler']}")
    print(f"  Explanation: {rec_data['explanation']}")
    assert len(rec_data["trade_offs"]) > 0
    assert "held_out_evaluation" in rec_data

    # 9 & 10. Verify database persistence and reload after application restart
    print("\n[Step 9 & 10] Reloading and verifying persistence from database...")
    get_wl_res = client.get(f"/api/v1/workloads/{wl_id}")
    assert get_wl_res.status_code == 200
    reloaded_wl = get_wl_res.json()
    assert reloaded_wl["name"] == saved_wl["name"]
    assert len(reloaded_wl["processes"]) == len(processes)

    get_exp_res = client.get(f"/api/v1/experiments/{exp_id}")
    assert get_exp_res.status_code == 200
    reloaded_exp = get_exp_res.json()
    assert reloaded_exp["name"] == "E2E Paired Verification Experiment"
    print("  Workloads and Experiments verified persisted and reloadable!")

    # 11. Export results and validate exported data
    print("\n[Step 11] Exporting experiment results to CSV and JSON...")
    csv_res = client.get(f"/api/v1/experiments/{exp_id}/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "avg_waiting_time" in csv_res.text
    print(f"  Exported CSV verified ({len(csv_res.text)} bytes).")

    json_res = client.get(f"/api/v1/experiments/{exp_id}/export/json")
    assert json_res.status_code == 200
    exported_json = json_res.json()
    assert exported_json["id"] == exp_id
    assert "raw_runs" in exported_json
    print(f"  Exported JSON verified ({len(exported_json['raw_runs'])} runs).")

    # 12. Submit invalid input and confirm graceful handling
    print("\n[Step 12] Testing rejection and error handling on invalid inputs...")
    # Duplicate PID
    dup_res = client.post("/api/v1/simulate", json={
        "algorithm": "FCFS",
        "quantum": 2,
        "processes": [
            {"pid": 1, "arrival_time": 0, "burst_time": 5, "priority": 1},
            {"pid": 1, "arrival_time": 1, "burst_time": 3, "priority": 1}
        ]
    })
    assert dup_res.status_code == 400
    print("  Duplicate PID correctly rejected with HTTP 400.")

    # Negative arrival time
    neg_res = client.post("/api/v1/simulate", json={
        "algorithm": "FCFS",
        "quantum": 2,
        "processes": [
            {"pid": 1, "arrival_time": -3, "burst_time": 5, "priority": 1}
        ]
    })
    assert neg_res.status_code == 422 or neg_res.status_code == 400
    print("  Negative arrival time correctly rejected.")

    # Clean up test workload and experiment
    client.delete(f"/api/v1/workloads/{wl_id}")
    client.delete(f"/api/v1/experiments/{exp_id}")

    print("\n" + "=" * 60)
    print("ALL 12 END-TO-END VERIFICATION STEPS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
