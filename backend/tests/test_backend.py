import pytest
from fastapi.testclient import TestClient
from backend.api import app
from backend.c_bridge import run_c_simulation
from backend.generator import generate_workload, calculate_workload_characteristics, PRESET_CONFIGS
from backend.experiments import run_experiment_batch, compute_summary_stats, compute_paired_comparison
from backend.recommender import recommend_scheduler, evaluate_adaptive_policy_on_held_out_seeds

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["c_engine"] == "authoritative"


def test_c_simulation_fcfs():
    procs = [
        {"pid": 1, "arrival_time": 0, "burst_time": 5, "priority": 1},
        {"pid": 2, "arrival_time": 2, "burst_time": 3, "priority": 2}
    ]
    res = run_c_simulation(procs, "FCFS")
    assert res["status"] == "success"
    assert res["algorithm"] == "FCFS"
    assert res["metrics"]["total_busy_time"] == 8
    assert res["metrics"]["makespan"] == 8
    assert len(res["trace"]) >= 2


def test_c_simulation_rr():
    procs = [
        {"pid": 1, "arrival_time": 0, "burst_time": 4, "priority": 1},
        {"pid": 2, "arrival_time": 0, "burst_time": 4, "priority": 1}
    ]
    res = run_c_simulation(procs, "RR", quantum=2)
    assert res["status"] == "success"
    assert res["algorithm"] == "Round Robin"
    assert res["quantum"] == 2
    assert res["metrics"]["preemptions"] >= 2
    assert res["metrics"]["makespan"] == 8


def test_c_simulation_invalid_input_rejection():
    # Duplicate PIDs
    bad_procs = [
        {"pid": 1, "arrival_time": 0, "burst_time": 4, "priority": 1},
        {"pid": 1, "arrival_time": 1, "burst_time": 3, "priority": 1}
    ]
    with pytest.raises(ValueError):
        run_c_simulation(bad_procs, "FCFS")


def test_workload_generator_reproducibility():
    wl1 = generate_workload(process_count=8, seed=123)
    wl2 = generate_workload(process_count=8, seed=123)
    assert wl1["processes"] == wl2["processes"]
    assert wl1["characteristics"]["process_count"] == 8
    assert "cv_burst" in wl1["characteristics"]


def test_experiments_paired_batch():
    exp = run_experiment_batch(
        schedulers=["FCFS", "SJF", "SRTF"],
        seeds=[10, 11, 12],
        workload_config={"process_count": 5, "mean_burst": 6.0, "burst_std": 2.0}
    )
    assert exp["total_runs"] == 9
    assert "SJF" in exp["summary"]
    assert "avg_waiting_time" in exp["summary"]["SJF"]
    assert exp["summary"]["SJF"]["avg_waiting_time"]["mean"] >= 0.0


def test_adaptive_recommender():
    # Short interactive workload -> recommend RR for response time
    procs = [
        {"pid": 1, "arrival_time": 0, "burst_time": 3, "priority": 1},
        {"pid": 2, "arrival_time": 1, "burst_time": 2, "priority": 1},
        {"pid": 3, "arrival_time": 2, "burst_time": 4, "priority": 1}
    ]
    rec_resp = recommend_scheduler(procs, objective="minimize_response")
    assert rec_resp["recommended_scheduler"] == "RR"

    # Held out seeds evaluation
    wl_cfg = {"process_count": 5, "mean_burst": 8.0, "burst_std": 3.0}
    eval_res = evaluate_adaptive_policy_on_held_out_seeds(wl_cfg, objective="minimize_waiting", held_out_seeds=[201, 202])
    assert "adaptive_mean" in eval_res
    assert "oracle_mean" in eval_res


def test_api_full_flow():
    # 1. Create Workload
    payload = {
        "name": "Integration Test Workload",
        "description": "Test workload created via API",
        "processes": [
            {"pid": 1, "arrival_time": 0, "burst_time": 6, "priority": 1},
            {"pid": 2, "arrival_time": 1, "burst_time": 2, "priority": 2},
            {"pid": 3, "arrival_time": 2, "burst_time": 4, "priority": 3}
        ]
    }
    create_res = client.post("/api/v1/workloads", json=payload)
    assert create_res.status_code == 200
    wl_data = create_res.json()
    wl_id = wl_data["id"]

    # 2. Simulate Workload
    sim_payload = {
        "workload_id": wl_id,
        "algorithm": "SRTF",
        "quantum": 2,
        "processes": payload["processes"]
    }
    sim_res = client.post("/api/v1/simulate", json=sim_payload)
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["algorithm"] == "SRTF"
    assert len(sim_data["trace"]) > 0

    # 3. Compare All 5 Schedulers
    comp_payload = {
        "processes": payload["processes"],
        "quantum": 2
    }
    comp_res = client.post("/api/v1/compare", json=comp_payload)
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert "FCFS" in comp_data["results"]
    assert "SJF" in comp_data["results"]
    assert "SRTF" in comp_data["results"]
    assert "PRIORITY" in comp_data["results"]
    assert "RR" in comp_data["results"]

    # 4. Recommendation
    rec_payload = {
        "processes": payload["processes"],
        "objective": "minimize_waiting",
        "quantum": 2,
        "evaluate_held_out": False
    }
    rec_res = client.post("/api/v1/recommend", json=rec_payload)
    assert rec_res.status_code == 200
    assert "recommended_scheduler" in rec_res.json()

    # 5. Cleanup
    del_res = client.delete(f"/api/v1/workloads/{wl_id}")
    assert del_res.status_code == 200


def test_observation_time_fairness_api():
    processes = [
        {"pid": 1, "arrival_time": 0, "burst_time": 10, "priority": 1},
        {"pid": 2, "arrival_time": 0, "burst_time": 10, "priority": 1}
    ]
    # Request with custom observation times
    sim_res = client.post("/api/v1/simulate", json={
        "algorithm": "RR",
        "quantum": 2,
        "processes": processes,
        "observe_times": [5, 10, 20]
    })
    assert sim_res.status_code == 200
    data = sim_res.json()
    assert "observation_fairness" in data
    obs = data["observation_fairness"]
    assert len(obs) == 3
    assert obs[0]["observation_time"] == 5
    assert obs[0]["is_progress_defined"] is True
    assert obs[0]["processes_arrived"] == 2
    assert obs[2]["observation_time"] == 20
    assert obs[2]["processes_completed"] == 2


def test_trace_api_endpoints():
    """Validates complete Trace Laboratory API workflow via TestClient."""
    # 1. Upload/load bundled trace
    upload_res = client.post("/api/v1/traces/upload", data={"sample_bundled": "swf", "name": "Test SWF Trace"})
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    trace_info = upload_res.json()
    trace_id = trace_info["id"]
    assert trace_info["format"] == "swf"
    assert trace_info["cleaned_jobs_count"] > 0
    assert "cleaning_report" in trace_info
    assert "features" in trace_info

    # 2. List traces
    list_res = client.get("/api/v1/traces")
    assert list_res.status_code == 200
    traces = list_res.json()
    assert any(t["id"] == trace_id for t in traces)

    # 3. Get trace details & features
    details_res = client.get(f"/api/v1/traces/{trace_id}")
    assert details_res.status_code == 200
    assert details_res.json()["name"] == "Test SWF Trace"

    feat_res = client.get(f"/api/v1/traces/{trace_id}/features")
    assert feat_res.status_code == 200
    feat_data = feat_res.json()
    assert "burst_mean" in feat_data
    assert "heavy_tail_index" in feat_data

    # 4. Sample trace and save as workload
    sample_res = client.post(f"/api/v1/traces/{trace_id}/workload", json={
        "method": "random",
        "count": 10,
        "scale_factor": 1.0,
        "seed": 42,
        "save_as_workload": True,
        "workload_name": "Sampled Trace Test WL"
    })
    assert sample_res.status_code == 200
    sample_data = sample_res.json()
    assert sample_data["process_count"] == 10
    assert len(sample_data["processes"]) == 10
    saved_wl_id = sample_data["saved_workload_id"]
    assert saved_wl_id is not None

    # 5. Run simulation on the trace-derived workload
    sim_res = client.post("/api/v1/simulate", json={
        "workload_id": saved_wl_id,
        "algorithm": "FCFS",
        "processes": sample_data["processes"]
    })
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["metrics"]["makespan"] > 0
    assert sim_data["metrics"]["p95_waiting_time"] >= 0.0

    # 6. Compare with synthetic workload
    comp_res = client.post(f"/api/v1/traces/{trace_id}/compare-synthetic", json={
        "seed": 42,
        "sampling_count": 15,
        "scale_factor": 1.0
    })
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert "best_generator_params" in comp_data
    assert "comparison_stats" in comp_data
    assert comp_data["best_composite_distance"] >= 0.0


def test_final_results_api():
    """Validates that final results JSON and REPORT.md can be retrieved via the API."""
    res = client.get("/api/v1/final-results")
    assert res.status_code == 200
    data = res.json()
    assert "summaries" in data
    assert "pairwise" in data
    assert "friedman" in data
    assert "quantum_sweep" in data
    assert "adaptive_regret" in data

    rep_res = client.get("/api/v1/final-results/report")
    assert rep_res.status_code == 200
    assert "report_markdown" in rep_res.json()
    assert len(rep_res.json()["report_markdown"]) > 500


