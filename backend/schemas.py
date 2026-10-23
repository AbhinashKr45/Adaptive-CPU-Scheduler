from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ProcessItem(BaseModel):
    pid: int = Field(..., ge=0, description="Process ID")
    arrival_time: int = Field(..., ge=0, description="Arrival time (>= 0)")
    burst_time: int = Field(..., gt=0, description="CPU burst length (> 0)")
    priority: int = Field(default=1, description="Priority value (lower numerical = higher priority)")


class ProcessResultItem(ProcessItem):
    start_time: int
    completion_time: int
    waiting_time: int
    response_time: int
    turnaround_time: int
    executed_time: int


class TraceIntervalItem(BaseModel):
    pid: int
    start_time: int
    end_time: int
    is_idle: bool


class AggregateMetricsItem(BaseModel):
    avg_waiting_time: float
    median_waiting_time: float
    max_waiting_time: int
    p95_waiting_time: float
    waiting_time_std: float
    avg_turnaround_time: float
    median_turnaround_time: float
    avg_response_time: float
    median_response_time: float
    max_response_time: int
    throughput: float
    cpu_utilization: float
    total_busy_time: int
    total_idle_time: int
    makespan: int
    context_switches: int
    preemptions: int
    starvation_ratio: float
    starvation_count: int
    waiting_time_gini: float
    jain_fairness_cpu: float
    jain_fairness_progress: float
    is_cpu_fairness_defined: bool
    is_progress_fairness_defined: bool


class ObservationFairnessItem(BaseModel):
    observation_time: int
    jain_fairness_cpu: float
    jain_fairness_progress: float
    is_cpu_defined: bool
    is_progress_defined: bool
    processes_arrived: int
    processes_completed: int


class SimulationRequest(BaseModel):
    workload_id: Optional[int] = None
    workload_name: Optional[str] = "Workload"
    algorithm: str = Field(..., description="FCFS, SJF, SRTF, PRIORITY, or RR")
    quantum: int = Field(default=2, ge=1, description="Round Robin time quantum")
    processes: List[ProcessItem] = Field(..., min_length=1)
    observe_times: Optional[List[int]] = None


class SimulationResponse(BaseModel):
    status: str
    algorithm: str
    quantum: int
    metrics: AggregateMetricsItem
    processes: List[ProcessResultItem]
    trace: List[TraceIntervalItem]
    observation_fairness: Optional[List[ObservationFairnessItem]] = None


class CompareRequest(BaseModel):
    processes: List[ProcessItem] = Field(..., min_length=1)
    quantum: int = Field(default=2, ge=1)
    schedulers: Optional[List[str]] = ["FCFS", "SJF", "SRTF", "PRIORITY", "RR"]
    observe_times: Optional[List[int]] = None


class CompareResponse(BaseModel):
    characteristics: Dict[str, Any]
    results: Dict[str, SimulationResponse]


class WorkloadGenerateRequest(BaseModel):
    process_count: int = Field(default=10, ge=1, le=1000)
    seed: int = Field(default=42)
    arrival_distribution: str = Field(default="uniform")
    burst_distribution: str = Field(default="normal")
    mean_burst: float = Field(default=10.0, gt=0)
    burst_std: float = Field(default=4.0, ge=0)
    skew_level: str = Field(default="medium")
    max_arrival: int = Field(default=20, ge=0)
    priority_distribution: str = Field(default="uniform")
    min_priority: int = Field(default=1)
    max_priority: int = Field(default=5)


class WorkloadCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    processes: List[ProcessItem] = Field(..., min_length=1)
    generator_config: Optional[Dict[str, Any]] = None


class WorkloadResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    process_count: int
    processes: List[ProcessItem]
    generator_config: Optional[Dict[str, Any]] = None
    characteristics: Dict[str, Any]
    created_at: str


class ExperimentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    schedulers: List[str] = Field(default=["FCFS", "SJF", "SRTF", "PRIORITY", "RR"])
    seeds: List[int] = Field(default=[42, 43, 44, 45, 46])
    workload_config: Dict[str, Any] = Field(default_factory=dict)
    rr_quantum: int = Field(default=2, ge=1)


class RecommendationRequest(BaseModel):
    processes: List[ProcessItem] = Field(..., min_length=1)
    objective: str = Field(default="minimize_waiting")
    quantum: int = Field(default=2, ge=1)
    selector_mode: str = Field(default="rule_based", description="'rule_based' or 'decision_tree'")
    evaluate_held_out: bool = Field(default=True)


class TraceUploadResponse(BaseModel):
    id: int
    name: str
    filename: str
    format: str
    cleaned_jobs_count: int
    cleaning_report: Dict[str, Any]
    features: Dict[str, Any]
    created_at: str


class TraceListItem(BaseModel):
    id: int
    name: str
    filename: str
    format: str
    cleaned_jobs_count: int
    created_at: str


class TraceSampleRequest(BaseModel):
    method: str = Field(default="random", description="'random' or 'time_window'")
    count: int = Field(default=20, ge=1, le=500)
    scale_factor: float = Field(default=1.0, gt=0)
    max_burst_tick: int = Field(default=100, ge=1)
    window_start_tick: int = Field(default=0, ge=0)
    window_duration_ticks: Optional[int] = Field(default=None)
    seed: int = Field(default=42)
    save_as_workload: bool = Field(default=False)
    workload_name: Optional[str] = None


class TraceSampleResponse(BaseModel):
    trace_id: int
    sampling_config: Dict[str, Any]
    scaling_loss: Dict[str, Any]
    process_count: int
    processes: List[ProcessItem]
    features: Dict[str, Any]
    saved_workload_id: Optional[int] = None


class TraceCompareSyntheticRequest(BaseModel):
    seed: int = Field(default=42)
    sampling_count: int = Field(default=25, ge=5, le=200)
    scale_factor: float = Field(default=1.0, gt=0)


class TraceCompareSyntheticResponse(BaseModel):
    trace_id: int
    trace_features: Dict[str, Any]
    best_generator_params: Dict[str, Any]
    best_composite_distance: float
    comparison_stats: Dict[str, Any]
    synthetic_processes: List[ProcessItem]

