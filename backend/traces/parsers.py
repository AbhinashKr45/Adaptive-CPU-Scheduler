"""
Trace Parsers:
Supports Standard Workload Format (SWF v2.2) and Generic CSV format.
"""

import io
from typing import Optional, Union
import pandas as pd


def parse_swf(content_or_path: Union[str, io.StringIO]) -> pd.DataFrame:
    """
    Parses Standard Workload Format (SWF v2.2) data.
    Header lines start with ';'.
    Field 1: Job Number
    Field 2: Submit Time (seconds)
    Field 3: Wait Time (seconds)
    Field 4: Run Time (seconds)
    Field 15: Queue / Priority
    """
    if isinstance(content_or_path, str) and not content_or_path.startswith(";") and "\n" not in content_or_path and "\r" not in content_or_path:
        # File path
        with open(content_or_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    elif isinstance(content_or_path, io.StringIO):
        lines = content_or_path.readlines()
    else:
        lines = content_or_path.splitlines()

    rows = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith(";") or line.startswith("#"):
            continue

        parts = line.split()
        if len(parts) < 4:
            continue

        try:
            job_id = int(parts[0])
            submit_time = float(parts[1])
            runtime = float(parts[3])
            priority = 1
            if len(parts) >= 15:
                try:
                    q_val = int(parts[14])
                    if q_val > 0:
                        priority = min(q_val, 10)
                except ValueError:
                    priority = 1

            rows.append({
                "job_id": job_id,
                "submit_time": submit_time,
                "runtime": runtime,
                "priority": priority
            })
        except (ValueError, IndexError):
            continue

    return pd.DataFrame(rows)


def parse_csv(
    content_or_path: Union[str, io.StringIO],
    submit_col: Optional[str] = None,
    runtime_col: Optional[str] = None,
    priority_col: Optional[str] = None
) -> pd.DataFrame:
    """
    Parses generic CSV workload traces with user-mappable or auto-detected column names.
    """
    if isinstance(content_or_path, str) and "\n" not in content_or_path and "\r" not in content_or_path:
        df = pd.read_csv(content_or_path)
    elif isinstance(content_or_path, io.StringIO):
        df = pd.read_csv(content_or_path)
    else:
        df = pd.read_csv(io.StringIO(content_or_path))

    col_map = {c.lower().strip(): c for c in df.columns}

    # Auto-detect submit time column
    actual_submit_col = submit_col
    if not actual_submit_col:
        candidates = ["submit_time", "arrival_time", "submit", "arrival", "time", "timestamp", "start_time"]
        for c in candidates:
            if c in col_map:
                actual_submit_col = col_map[c]
                break

    # Auto-detect runtime column
    actual_runtime_col = runtime_col
    if not actual_runtime_col:
        candidates = ["runtime", "burst_time", "burst", "duration", "cpu_time", "run_time"]
        for c in candidates:
            if c in col_map:
                actual_runtime_col = col_map[c]
                break

    # Auto-detect priority column
    actual_priority_col = priority_col
    if not actual_priority_col:
        candidates = ["priority", "prio", "queue", "queue_num"]
        for c in candidates:
            if c in col_map:
                actual_priority_col = col_map[c]
                break

    if not actual_submit_col or not actual_runtime_col:
        raise ValueError(
            f"Unable to find required columns. Available columns: {list(df.columns)}. "
            "Please specify submit_col and runtime_col."
        )

    out = pd.DataFrame()
    out["job_id"] = df["job_id"] if "job_id" in col_map else range(1, len(df) + 1)
    out["submit_time"] = pd.to_numeric(df[actual_submit_col], errors="coerce")
    out["runtime"] = pd.to_numeric(df[actual_runtime_col], errors="coerce")
    if actual_priority_col and actual_priority_col in df.columns:
        out["priority"] = pd.to_numeric(df[actual_priority_col], errors="coerce").fillna(1).astype(int)
    else:
        out["priority"] = 1

    return out


def parse_trace(content_or_path: Union[str, io.StringIO], filename_hint: Optional[str] = None, **kwargs) -> pd.DataFrame:
    """Auto-detects format (SWF vs CSV) and parses accordingly."""
    if filename_hint and filename_hint.lower().endswith(".swf"):
        return parse_swf(content_or_path)

    if isinstance(content_or_path, str):
        if content_or_path.startswith(";") or "; Version:" in content_or_path[:200]:
            return parse_swf(content_or_path)

    return parse_csv(content_or_path, **kwargs)
