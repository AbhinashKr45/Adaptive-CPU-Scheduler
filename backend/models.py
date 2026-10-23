import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base

class Workload(Base):
    __tablename__ = "workloads"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    process_count = Column(Integer, nullable=False)
    processes_json = Column(Text, nullable=False)
    generator_config_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False, index=True)

    simulations = relationship("SimulationRun", back_populates="workload", cascade="all, delete-orphan")


class SimulationRun(Base):
    __tablename__ = "simulations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workload_id = Column(Integer, ForeignKey("workloads.id", ondelete="SET NULL"), nullable=True, index=True)
    workload_name = Column(String(120), nullable=False)
    algorithm = Column(String(50), nullable=False, index=True)
    quantum = Column(Integer, default=0, nullable=False)
    avg_waiting_time = Column(Float, nullable=True)
    median_waiting_time = Column(Float, nullable=True)
    max_waiting_time = Column(Integer, nullable=True)
    p95_waiting_time = Column(Float, nullable=True)
    waiting_time_std = Column(Float, nullable=True)
    avg_turnaround_time = Column(Float, nullable=True)
    avg_response_time = Column(Float, nullable=True)
    max_response_time = Column(Integer, nullable=True)
    throughput = Column(Float, nullable=True)
    cpu_utilization = Column(Float, nullable=True)
    makespan = Column(Integer, nullable=True)
    context_switches = Column(Integer, nullable=True)
    preemptions = Column(Integer, nullable=True)
    starvation_count = Column(Integer, nullable=True)
    waiting_time_gini = Column(Float, nullable=True)
    jain_fairness_cpu = Column(Float, nullable=True)
    jain_fairness_progress = Column(Float, nullable=True)
    metrics_json = Column(Text, nullable=False)
    trace_json = Column(Text, nullable=False)
    processes_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False, index=True)

    workload = relationship("Workload", back_populates="simulations")


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="completed", nullable=False)
    schedulers_json = Column(Text, nullable=False)
    seeds_json = Column(Text, nullable=False)
    workload_config_json = Column(Text, nullable=False)
    summary_json = Column(Text, nullable=False)
    raw_runs_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False, index=True)


class RecommendationRecord(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workload_id = Column(Integer, nullable=True, index=True)
    objective = Column(String(60), nullable=False)
    recommended_scheduler = Column(String(50), nullable=False)
    explanation = Column(Text, nullable=False)
    workload_features_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False, index=True)
