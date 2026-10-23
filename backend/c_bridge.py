import os
import sys
import json
import shutil
import subprocess
from typing import List, Dict, Any, Optional

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLI_EXECUTABLE_NAME = "scheduler_cli.exe" if sys.platform == "win32" else "scheduler_cli"
CLI_PATH = os.path.join(WORKSPACE_ROOT, CLI_EXECUTABLE_NAME)

def ensure_c_engine_compiled() -> str:
    """Ensures that the authoritative C scheduling engine is compiled and available."""
    if os.path.exists(CLI_PATH):
        return CLI_PATH

    # Check if gcc is available
    if not shutil.which("gcc"):
        raise RuntimeError(
            "GCC compiler not found on PATH. The authoritative C scheduling engine requires GCC to compile."
        )

    # Compile using gcc
    compile_cmd = [
        "gcc", "-Wall", "-Wextra", "-Wpedantic", "-std=c99",
        "-Isrc",
        os.path.join(WORKSPACE_ROOT, "src", "core", "process.c"),
        os.path.join(WORKSPACE_ROOT, "src", "core", "metrics.c"),
        os.path.join(WORKSPACE_ROOT, "src", "core", "simulation.c"),
        os.path.join(WORKSPACE_ROOT, "src", "schedulers", "fcfs.c"),
        os.path.join(WORKSPACE_ROOT, "src", "schedulers", "sjf.c"),
        os.path.join(WORKSPACE_ROOT, "src", "schedulers", "srtf.c"),
        os.path.join(WORKSPACE_ROOT, "src", "schedulers", "priority.c"),
        os.path.join(WORKSPACE_ROOT, "src", "schedulers", "round_robin.c"),
        os.path.join(WORKSPACE_ROOT, "main.c"),
        "-o", CLI_PATH
    ]

    res = subprocess.run(compile_cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Failed to compile C scheduling engine: {res.stderr}")

    return CLI_PATH


def run_c_simulation(
    processes: List[Dict[str, Any]],
    algorithm: str,
    quantum: int = 2,
    timeout_sec: float = 15.0,
    observe_times: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    Executes the authoritative C scheduling engine with the given workload and algorithm.
    Validates input and parses output JSON.
    """
    cli_exe = ensure_c_engine_compiled()

    # Normalize algorithm name
    algo = algorithm.strip().upper()
    if algo in ("ROUND_ROBIN", "ROUND ROBIN"):
        algo = "RR"

    cmd = [cli_exe, "--algorithm", algo, "--quantum", str(max(1, quantum))]
    if observe_times:
        cmd.extend(["--observe-times", ",".join(str(int(t)) for t in observe_times)])

    input_payload = json.dumps(processes)

    try:
        proc = subprocess.run(
            cmd,
            input=input_payload,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            cwd=WORKSPACE_ROOT
        )
    except subprocess.TimeoutExpired:
        raise TimeoutError(f"C simulation timed out after {timeout_sec}s")

    if proc.returncode != 0:
        err_msg = proc.stderr.strip() or proc.stdout.strip() or f"Process returned error code {proc.returncode}"
        try:
            err_json = json.loads(err_msg)
            if "message" in err_json:
                err_msg = err_json["message"]
        except Exception:
            pass
        raise ValueError(f"Simulation engine error: {err_msg}")

    try:
        result = json.loads(proc.stdout)
        return result
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse simulation output: {proc.stdout}") from e
