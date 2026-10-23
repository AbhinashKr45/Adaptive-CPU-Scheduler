import io
import os
import json
import csv
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.database import get_db, init_db
from backend.models import Workload, SimulationRun, Experiment, RecommendationRecord, TraceRecord
from backend.schemas import (
    ProcessItem, SimulationRequest, SimulationResponse,
    CompareRequest, CompareResponse,
    WorkloadCreateRequest, WorkloadResponse, WorkloadGenerateRequest,
    ExperimentCreateRequest, RecommendationRequest,
    TraceUploadResponse, TraceListItem, TraceSampleRequest, TraceSampleResponse,
    TraceCompareSyntheticRequest, TraceCompareSyntheticResponse
)
from backend.c_bridge import run_c_simulation
from backend.generator import (
    generate_workload, generate_preset_workload,
    calculate_workload_characteristics, PRESET_CONFIGS
)
from backend.experiments import run_experiment_batch, export_experiment_to_dataframe
from backend.recommender import recommend_scheduler, evaluate_adaptive_policy_on_held_out_seeds
from backend.traces import (
    parse_trace, clean_trace, scale_trace, sample_trace,
    extract_workload_features, compare_distributions, fit_synthetic_to_trace
)

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
        m = res.get("metrics", {})
        sim_run = SimulationRun(
            workload_id=req.workload_id,
            workload_name=req.workload_name or "Workload",
            algorithm=res["algorithm"],
            quantum=res["quantum"],
            avg_waiting_time=m.get("avg_waiting_time"),
            median_waiting_time=m.get("median_waiting_time"),
            max_waiting_time=m.get("max_waiting_time"),
            p95_waiting_time=m.get("p95_waiting_time"),
            waiting_time_std=m.get("waiting_time_std"),
            avg_turnaround_time=m.get("avg_turnaround_time"),
            avg_response_time=m.get("avg_response_time"),
            max_response_time=m.get("max_response_time"),
            throughput=m.get("throughput"),
            cpu_utilization=m.get("cpu_utilization"),
            makespan=m.get("makespan"),
            context_switches=m.get("context_switches"),
            preemptions=m.get("preemptions"),
            starvation_count=m.get("starvation_count"),
            waiting_time_gini=m.get("waiting_time_gini"),
            jain_fairness_cpu=m.get("jain_fairness_cpu"),
            jain_fairness_progress=m.get("jain_fairness_progress"),
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


# ==========================================
# TRACE LABORATORY API (PHASE 3)
# ==========================================

@app.post("/api/v1/traces/upload", response_model=TraceUploadResponse)
async def upload_trace(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    sample_bundled: Optional[str] = Form(None),
    outlier_percentile: float = Form(99.0),
    db: Session = Depends(get_db)
):
    """
    Uploads or loads a trace (SWF or CSV), runs the cleaning pipeline,
    extracts features, and persists the trace in the database.
    """
    content = ""
    filename = "uploaded_trace.csv"

    if sample_bundled in ["swf", "csv"]:
        ext = sample_bundled
        sample_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "traces", f"sample_workload.{ext}")
        if os.path.exists(sample_path):
            with open(sample_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            filename = f"sample_workload.{ext}"
            if not name:
                name = f"Bundled {sample_bundled.upper()} Benchmark Trace"
        else:
            raise HTTPException(status_code=404, detail=f"Bundled sample {sample_bundled} not found on disk")
    elif file is not None:
        filename = file.filename or "uploaded_trace.csv"
        raw_bytes = await file.read()
        content = raw_bytes.decode("utf-8", errors="replace")
    elif raw_text:
        content = raw_text
        filename = "pasted_trace.csv"
    else:
        raise HTTPException(status_code=400, detail="Must provide a file, raw_text, or sample_bundled ('swf' or 'csv')")

    if not content.strip():
        raise HTTPException(status_code=400, detail="Trace content is empty")

    fmt = "swf" if filename.lower().endswith(".swf") or content.strip().startswith(";") else "csv"
    trace_name = name or (filename.rsplit(".", 1)[0].replace("_", " ").title())

    try:
        raw_df = parse_trace(content, filename_hint=filename)
        if len(raw_df) == 0:
            raise HTTPException(status_code=400, detail="Parser extracted 0 valid job records from input")
        clean_df, report = clean_trace(raw_df, outlier_percentile=outlier_percentile)
        if len(clean_df) == 0:
            raise HTTPException(status_code=400, detail="All jobs were dropped during cleaning pipeline")
        features = extract_workload_features(clean_df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Trace parsing/cleaning failed: {str(e)}")

    record = TraceRecord(
        name=trace_name,
        filename=filename,
        format=fmt,
        raw_content=content,
        cleaning_report_json=json.dumps(report.to_dict()),
        features_json=json.dumps(features),
        cleaned_jobs_count=len(clean_df)
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return TraceUploadResponse(
        id=record.id,
        name=record.name,
        filename=record.filename,
        format=record.format,
        cleaned_jobs_count=record.cleaned_jobs_count,
        cleaning_report=report.to_dict(),
        features=features,
        created_at=record.created_at.isoformat()
    )


@app.get("/api/v1/traces", response_model=List[TraceListItem])
def list_traces(db: Session = Depends(get_db)):
    """Lists all stored workload traces."""
    traces = db.query(TraceRecord).order_by(desc(TraceRecord.created_at)).all()
    return [
        TraceListItem(
            id=t.id,
            name=t.name,
            filename=t.filename,
            format=t.format,
            cleaned_jobs_count=t.cleaned_jobs_count,
            created_at=t.created_at.isoformat()
        )
        for t in traces
    ]


@app.get("/api/v1/traces/{trace_id}")
def get_trace_details(trace_id: int, db: Session = Depends(get_db)):
    """Retrieves full details of a trace including cleaning report and features."""
    t = db.query(TraceRecord).filter(TraceRecord.id == trace_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trace record not found")
    return {
        "id": t.id,
        "name": t.name,
        "filename": t.filename,
        "format": t.format,
        "cleaned_jobs_count": t.cleaned_jobs_count,
        "cleaning_report": json.loads(t.cleaning_report_json),
        "features": json.loads(t.features_json),
        "created_at": t.created_at.isoformat()
    }


@app.get("/api/v1/traces/{trace_id}/features")
def get_trace_features(trace_id: int, db: Session = Depends(get_db)):
    """Returns extracted statistical features for a trace."""
    t = db.query(TraceRecord).filter(TraceRecord.id == trace_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trace record not found")
    return json.loads(t.features_json)


@app.post("/api/v1/traces/{trace_id}/workload", response_model=TraceSampleResponse)
def sample_trace_workload(trace_id: int, req: TraceSampleRequest, db: Session = Depends(get_db)):
    """
    Scales and samples a trace into a simulator-ready workload.
    Guarantees reproducibility and chronological arrival ordering.
    """
    t = db.query(TraceRecord).filter(TraceRecord.id == trace_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trace record not found")

    raw_df = parse_trace(t.raw_content, filename_hint=t.filename)
    clean_df, _ = clean_trace(raw_df)
    scaled_df, scaling_loss = scale_trace(
        clean_df,
        scale_factor=req.scale_factor,
        max_burst_tick=req.max_burst_tick
    )

    procs = sample_trace(
        scaled_df,
        method=req.method,
        count=req.count,
        window_start_tick=req.window_start_tick,
        window_duration_ticks=req.window_duration_ticks,
        seed=req.seed
    )

    features = extract_workload_features(procs)
    saved_wl_id = None

    if req.save_as_workload:
        wl_name = req.workload_name or f"{t.name} Sample ({len(procs)} procs)"
        db_wl = Workload(
            name=wl_name,
            description=f"Trace-derived workload from {t.name} using {req.method} sampling (seed={req.seed}, scale={req.scale_factor})",
            process_count=len(procs),
            processes_json=json.dumps(procs),
            generator_config_json=json.dumps({
                "source_trace_id": t.id,
                "source_trace_name": t.name,
                "sampling_config": req.model_dump(),
                "scaling_loss": scaling_loss
            })
        )
        db.add(db_wl)
        db.commit()
        db.refresh(db_wl)
        saved_wl_id = db_wl.id

    return TraceSampleResponse(
        trace_id=t.id,
        sampling_config=req.model_dump(),
        scaling_loss=scaling_loss,
        process_count=len(procs),
        processes=[ProcessItem(**p) for p in procs],
        features=features,
        saved_workload_id=saved_wl_id
    )


@app.post("/api/v1/traces/{trace_id}/compare-synthetic", response_model=TraceCompareSyntheticResponse)
def compare_trace_with_synthetic(trace_id: int, req: TraceCompareSyntheticRequest, db: Session = Depends(get_db)):
    """
    Compares the trace distribution against synthetic workloads using KS tests and
    Wasserstein distances, and finds best matching generator parameters via grid search.
    """
    t = db.query(TraceRecord).filter(TraceRecord.id == trace_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trace record not found")

    raw_df = parse_trace(t.raw_content, filename_hint=t.filename)
    clean_df, _ = clean_trace(raw_df)
    scaled_df, _ = scale_trace(clean_df, scale_factor=req.scale_factor)
    trace_procs = sample_trace(scaled_df, method="random", count=req.sampling_count, seed=req.seed)

    if not trace_procs:
        raise HTTPException(status_code=400, detail="No processes could be sampled from trace")

    trace_feat = extract_workload_features(trace_procs)
    fit_result = fit_synthetic_to_trace(trace_procs, seed=req.seed)

    return TraceCompareSyntheticResponse(
        trace_id=t.id,
        trace_features=trace_feat,
        best_generator_params=fit_result["best_generator_params"],
        best_composite_distance=fit_result["best_composite_distance"],
        comparison_stats=fit_result["comparison_stats"],
        synthetic_processes=[ProcessItem(**p) for p in fit_result["best_synthetic_processes"]]
    )

