import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./adaptive_scheduling.db")

# For SQLite, check_same_thread=False is needed for multi-threaded FastAPI workers
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from sqlalchemy import inspect, text

def run_migrations(target_engine=None):
    """
    Documented idempotent database migration: inspects the schema and safely adds
    any missing columns to existing tables without data loss.
    """
    eng = target_engine or engine
    inspector = inspect(eng)
    if "simulations" in inspector.get_table_names():
        existing_cols = {col["name"] for col in inspector.get_columns("simulations")}
        columns_to_add = [
            ("avg_waiting_time", "FLOAT"),
            ("median_waiting_time", "FLOAT"),
            ("max_waiting_time", "INTEGER"),
            ("p95_waiting_time", "FLOAT"),
            ("waiting_time_std", "FLOAT"),
            ("avg_turnaround_time", "FLOAT"),
            ("avg_response_time", "FLOAT"),
            ("max_response_time", "INTEGER"),
            ("throughput", "FLOAT"),
            ("cpu_utilization", "FLOAT"),
            ("makespan", "INTEGER"),
            ("context_switches", "INTEGER"),
            ("preemptions", "INTEGER"),
            ("starvation_count", "INTEGER"),
            ("waiting_time_gini", "FLOAT"),
            ("jain_fairness_cpu", "FLOAT"),
            ("jain_fairness_progress", "FLOAT"),
        ]
        with eng.connect() as conn:
            for col_name, col_type in columns_to_add:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE simulations ADD COLUMN {col_name} {col_type}"))
            conn.commit()


def init_db():
    from backend import models
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
