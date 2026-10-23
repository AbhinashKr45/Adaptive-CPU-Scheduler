import io
import json
import csv
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db, init_db
from backend.models import Workload, SimulationRun, Experiment, RecommendationRecord
from backend.schemas import (
    ProcessItem, SimulationRequest, SimulationResponse,
    CompareRequest, CompareResponse,
    WorkloadCreateRequest, WorkloadResponse, WorkloadGenerateRequest,
    ExperimentCreateRequest, RecommendationRequest
)
from backend.c_bridge import run_c_simulation
from backend.generator import (
    generate_workload, generate_preset_workload,
    calculate_workload_characteristics, PRESET_CONFIGS
)
from backend.experiments import run_experiment_batch, export_experiment_to_dataframe
from backend.recommender import recommend_scheduler, evaluate_adaptive_policy_on_held_out_seeds

# Initialize DB tables
init_db()

app = FastAPI(
    title="Adaptive OS CPU Scheduling Analysis API",
    description="Authoritative C-driven CPU Scheduling Simulation, Fairness & Statistical Analysis Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Adaptive OS Scheduling API",
        "c_engine": "authoritative"
    }


@app.get("/api/v1/overview")
def get_system_overview(db: Session = Depends(get_db)):
    """Provides real database-backed platform statistics, recent runs, and shortcuts."""
    workload_count = db.query(Workload).count()
    simulation_count = db.query(SimulationRun).count()
    experiment_count = db.query(Experiment).count()

    recent_sims = db.query(SimulationRun).order_by(desc(SimulationRun.created_at)).limit(5).all()
    recent_experiments = db.query(Experiment).order_by(desc(Experiment.created_at)).limit(5).all()

    sims_data = []
    for s in recent_sims:
        try:
            m = json.loads(s.metrics_json)
        except Exception:
            m = {}
        sims_data.append({
            "id": s.id,
            "workload_name": s.workload_name,
            "algorithm": s.algorithm,
            "quantum": s.quantum,
            "avg_waiting_time": m.get("avg_waiting_time", 0.0),
            "cpu_utilization": m.get("cpu_utilization", 0.0),
            "created_at": s.created_at.isoformat()
        })

    exp_data = []
    for e in recent_experiments:
        try:
            summary = json.loads(e.summary_json)
            scheds = json.loads(e.schedulers_json)
            seeds = json.loads(e.seeds_json)
        except Exception:
            summary, scheds, seeds = {}, [], []
        exp_data.append({
            "id": e.id,
            "name": e.name,
            "schedulers": scheds,
            "seed_count": len(seeds),
            "created_at": e.created_at.isoformat()
        })

    return {
        "workload_count": workload_count,
        "simulation_count": simulation_count,
        "experiment_count": experiment_count,
        "recent_simulations": sims_data,
        "recent_experiments": exp_data
    }


# ==========================================
# WORKLOADS API
# ==========================================

@app.get("/api/v1/workloads/presets")
def get_workload_presets():
    """Returns list of research workload presets with their parameters and descriptions."""
    presets = []
    for k, v in PRESET_CONFIGS.items():
        presets.append({
            "key": k,
            "name": v["name"],
            "description": v["description"],
            "config": v
        })
    return presets


@app.post("/api/v1/workloads/presets/{key}")
def generate_from_preset(key: str, process_count: int = Query(10, ge=1, le=1000), seed: int = Query(42)):
    if key not in PRESET_CONFIGS:
        raise HTTPException(status_code=404, detail=f"Preset '{key}' not found.")
    wl = generate_preset_workload(key, process_count=process_count, seed=seed)
    return wl


@app.post("/api/v1/workloads/generate")
def generate_custom_workload(req: WorkloadGenerateRequest):
    wl = generate_workload(
        process_count=req.process_count,
        seed=req.seed,
        arrival_distribution=req.arrival_distribution,
        burst_distribution=req.burst_distribution,
        mean_burst=req.mean_burst,
        burst_std=req.burst_std,
        skew_level=req.skew_level,
        max_arrival=req.max_arrival,
        priority_distribution=req.priority_distribution,
        min_priority=req.min_priority,
        max_priority=req.max_priority
    )
    return wl


@app.get("/api/v1/workloads")
def list_workloads(db: Session = Depends(get_db)):
    workloads = db.query(Workload).order_by(desc(Workload.created_at)).all()
    res = []
    for w in workloads:
        try:
            procs = json.loads(w.processes_json)
            g_cfg = json.loads(w.generator_config_json) if w.generator_config_json else None
        except Exception:
            procs, g_cfg = [], None
        chars = calculate_workload_characteristics(procs)
        res.append({
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "process_count": w.process_count,
            "processes": procs,
            "generator_config": g_cfg,
            "characteristics": chars,
            "created_at": w.created_at.isoformat()
        })
    return res


@app.post("/api/v1/workloads")
def create_workload(req: WorkloadCreateRequest, db: Session = Depends(get_db)):
    procs_data = [p.model_dump() for p in req.processes]
    # Validate duplicate PIDs
    pids = [p["pid"] for p in procs_data]
    if len(pids) != len(set(pids)):
        raise HTTPException(status_code=400, detail="Duplicate Process IDs found in workload.")

    w = Workload(
        name=req.name,
        description=req.description,
        process_count=len(procs_data),
        processes_json=json.dumps(procs_data),
        generator_config_json=json.dumps(req.generator_config) if req.generator_config else None
    )
    db.add(w)
    db.commit()
    db.refresh(w)

    chars = calculate_workload_characteristics(procs_data)
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "process_count": w.process_count,
        "processes": procs_data,
        "generator_config": req.generator_config,
        "characteristics": chars,
        "created_at": w.created_at.isoformat()
    }


@app.get("/api/v1/workloads/{workload_id}")
def get_workload(workload_id: int, db: Session = Depends(get_db)):
    w = db.query(Workload).filter(Workload.id == workload_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workload not found")
    procs = json.loads(w.processes_json)
    g_cfg = json.loads(w.generator_config_json) if w.generator_config_json else None
    chars = calculate_workload_characteristics(procs)
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "process_count": w.process_count,
        "processes": procs,
        "generator_config": g_cfg,
        "characteristics": chars,
        "created_at": w.created_at.isoformat()
    }


@app.delete("/api/v1/workloads/{workload_id}")
def delete_workload(workload_id: int, db: Session = Depends(get_db)):
    w = db.query(Workload).filter(Workload.id == workload_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workload not found")
    db.delete(w)
    db.commit()
    return {"status": "success", "message": f"Workload {workload_id} deleted"}


# ==========================================
# SIMULATION API
# ==========================================

@app.post("/api/v1/simulate")
def run_simulation(req: SimulationRequest, persist: bool = Query(True), db: Session = Depends(get_db)):
    procs_data = [p.model_dump() for p in req.processes]

    try:
        res = run_c_simulation(procs_data, req.algorithm, quantum=req.quantum, observe_times=req.observe_times)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if persist:
        sim_run = SimulationRun(
            workload_id=req.workload_id,
            workload_name=req.workload_name or "Workload",
            algorithm=res["algorithm"],
            quantum=res["quantum"],
            metrics_json=json.dumps(res["metrics"]),
            trace_json=json.dumps(res["trace"]),
            processes_json=json.dumps(res["processes"])
        )
        db.add(sim_run)
        db.commit()
        db.refresh(sim_run)
        res["id"] = sim_run.id

    return res


# ==========================================
# SCHEDULER COMPARISON API
# ==========================================

@app.post("/api/v1/compare")
def compare_schedulers(req: CompareRequest):
    """Runs all 5 algorithms on the identical workload and returns side-by-side results."""
    procs_data = [p.model_dump() for p in req.processes]
    scheds = req.schedulers or ["FCFS", "SJF", "SRTF", "PRIORITY", "RR"]

    results = {}
    for s in scheds:
        q = req.quantum if s.upper() in ("RR", "ROUND_ROBIN", "ROUND ROBIN") else 0
        try:
            res = run_c_simulation(procs_data, s, quantum=q, observe_times=req.observe_times)
            results[s] = res
        except Exception as e:
            results[s] = {"status": "error", "message": str(e)}

    chars = calculate_workload_characteristics(procs_data)

    return {
        "characteristics": chars,
        "results": results
    }


# ==========================================
# ADAPTIVE RECOMMENDATION API
# ==========================================

@app.post("/api/v1/recommend")
def get_recommendation(req: RecommendationRequest, db: Session = Depends(get_db)):
    procs_data = [p.model_dump() for p in req.processes]

    rec = recommend_scheduler(procs_data, objective=req.objective, quantum=req.quantum)

    # Optional held-out evaluation
    held_out = None
    if req.evaluate_held_out:
        # Create workload config matching characteristics
        chars = rec["workload_characteristics"]
        wl_cfg = {
            "process_count": chars["process_count"],
            "arrival_distribution": "uniform" if chars["arrival_span"] > 0 else "simultaneous",
            "burst_distribution": "normal",
            "mean_burst": chars["mean_burst"],
            "burst_std": chars["std_burst"],
            "skew_level": "high" if chars["skewness"] > 1.0 else "medium",
            "max_arrival": max(10, chars["arrival_span"])
        }
        held_out = evaluate_adaptive_policy_on_held_out_seeds(wl_cfg, objective=req.objective, rr_quantum=req.quantum)

    # Persist recommendation
    record = RecommendationRecord(
        objective=req.objective,
        recommended_scheduler=rec["recommended_scheduler"],
        explanation=rec["explanation"],
        workload_features_json=json.dumps(rec["workload_characteristics"])
    )
    db.add(record)
    db.commit()

    rec["held_out_evaluation"] = held_out
    return rec


# ==========================================
# EXPERIMENT STUDIO API
# ==========================================

@app.post("/api/v1/experiments")
def run_experiment(req: ExperimentCreateRequest, db: Session = Depends(get_db)):
    """Runs a paired batch experiment matrix and persists results."""
    try:
        exp_res = run_experiment_batch(
            schedulers=req.schedulers,
            seeds=req.seeds,
            workload_config=req.workload_config,
            rr_quantum=req.rr_quantum
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    exp = Experiment(
        name=req.name,
        description=req.description,
        status="completed",
        schedulers_json=json.dumps(req.schedulers),
        seeds_json=json.dumps(req.seeds),
        workload_config_json=json.dumps(req.workload_config),
        summary_json=json.dumps(exp_res["summary"]),
        raw_runs_json=json.dumps(exp_res["raw_runs"])
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)

    exp_res["id"] = exp.id
    exp_res["name"] = exp.name
    exp_res["description"] = exp.description
    exp_res["created_at"] = exp.created_at.isoformat()

    return exp_res


@app.get("/api/v1/experiments")
def list_experiments(db: Session = Depends(get_db)):
    exps = db.query(Experiment).order_by(desc(Experiment.created_at)).all()
    res = []
    for e in exps:
        try:
            summary = json.loads(e.summary_json)
            scheds = json.loads(e.schedulers_json)
            seeds = json.loads(e.seeds_json)
            cfg = json.loads(e.workload_config_json)
        except Exception:
            summary, scheds, seeds, cfg = {}, [], [], {}
        res.append({
            "id": e.id,
            "name": e.name,
            "description": e.description,
            "status": e.status,
            "schedulers": scheds,
            "seeds": seeds,
            "workload_config": cfg,
            "summary": summary,
            "created_at": e.created_at.isoformat()
        })
    return res


@app.get("/api/v1/experiments/{experiment_id}")
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    e = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {
        "id": e.id,
        "name": e.name,
        "description": e.description,
        "status": e.status,
        "schedulers": json.loads(e.schedulers_json),
        "seeds": json.loads(e.seeds_json),
        "workload_config": json.loads(e.workload_config_json),
        "summary": json.loads(e.summary_json),
        "raw_runs": json.loads(e.raw_runs_json),
        "created_at": e.created_at.isoformat()
    }


@app.delete("/api/v1/experiments/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    e = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    db.delete(e)
    db.commit()
    return {"status": "success", "message": f"Experiment {experiment_id} deleted"}


@app.get("/api/v1/experiments/{experiment_id}/export/csv")
def export_experiment_csv(experiment_id: int, db: Session = Depends(get_db)):
    e = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    raw_runs = json.loads(e.raw_runs_json)

    df = export_experiment_to_dataframe({"raw_runs": raw_runs})
    output = io.StringIO()
    df.to_csv(output, index=False)
    csv_str = output.getvalue()

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=experiment_{experiment_id}_results.csv"}
    )


@app.get("/api/v1/experiments/{experiment_id}/export/json")
def export_experiment_json(experiment_id: int, db: Session = Depends(get_db)):
    e = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    data = {
        "id": e.id,
        "name": e.name,
        "description": e.description,
        "schedulers": json.loads(e.schedulers_json),
        "seeds": json.loads(e.seeds_json),
        "workload_config": json.loads(e.workload_config_json),
        "summary": json.loads(e.summary_json),
        "raw_runs": json.loads(e.raw_runs_json),
        "created_at": e.created_at.isoformat()
    }
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=experiment_{experiment_id}_results.json"}
    )


# ==========================================
# HISTORY API
# ==========================================

@app.get("/api/v1/history/simulations")
def list_history_simulations(limit: int = 50, db: Session = Depends(get_db)):
    runs = db.query(SimulationRun).order_by(desc(SimulationRun.created_at)).limit(limit).all()
    res = []
    for r in runs:
        res.append({
            "id": r.id,
            "workload_id": r.workload_id,
            "workload_name": r.workload_name,
            "algorithm": r.algorithm,
            "quantum": r.quantum,
            "metrics": json.loads(r.metrics_json),
            "trace_count": len(json.loads(r.trace_json)),
            "process_count": len(json.loads(r.processes_json)),
            "created_at": r.created_at.isoformat()
        })
    return res


@app.get("/api/v1/history/simulations/{run_id}")
def get_history_simulation(run_id: int, db: Session = Depends(get_db)):
    r = db.query(SimulationRun).filter(SimulationRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return {
        "id": r.id,
        "workload_id": r.workload_id,
        "workload_name": r.workload_name,
        "algorithm": r.algorithm,
        "quantum": r.quantum,
        "metrics": json.loads(r.metrics_json),
        "trace": json.loads(r.trace_json),
        "processes": json.loads(r.processes_json),
        "created_at": r.created_at.isoformat()
    }


@app.delete("/api/v1/history/simulations/{run_id}")
def delete_history_simulation(run_id: int, db: Session = Depends(get_db)):
    r = db.query(SimulationRun).filter(SimulationRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    db.delete(r)
    db.commit()
    return {"status": "success", "message": f"Simulation run {run_id} deleted"}
