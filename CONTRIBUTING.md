# Contributing to the Adaptive OS Scheduling Framework

Thank you for your interest in contributing to the Adaptive OS Scheduling Framework. We welcome contributions in operating systems modeling, statistical benchmarking, algorithm engineering, and data visualization.

---

## Code Quality Standards & Guidelines

### 1. C Engine (`src/` and `main.c`)
- **Language Standard**: ISO C99 (`-std=c99`).
- **Compiler Flags**: All C code must compile cleanly without warnings under:
  ```bash
  gcc -Wall -Wextra -Wpedantic -std=c99
  ```
- **Memory Safety**: Every dynamic allocation (`malloc`/`calloc`) must have a corresponding check and free (`simulation_result_free`, `process_destroy`).
- **Invariants**: Always verify conservation of CPU service and makespan conservation when introducing or modifying scheduling routines.

### 2. Python Backend (`backend/`)
- **Type Annotations**: Use Python typing annotations across all public functions.
- **Pydantic Validation**: Every API endpoint must accept validated Pydantic schemas and enforce physical bounds.
- **Statistical Integrity**: Never report an unadjusted p-value across multiple comparisons; use the monotonic Holm-Bonferroni correction function in `backend/statistics.py`.
- **Zero Leakage Invariant**: The recommender must remain strictly feature-only. Never execute candidate schedulers on the target workload during policy inference.

### 3. Frontend Dashboard (`frontend/`)
- **React & TypeScript**: Follow React 19 functional component conventions with strict typing.
- **Linting & Formatting**: Ensure `npm run lint` passes with 0 errors.
- **Testing**: Maintain Vitest unit and integration coverage for all newly added components and API calls.

---

## Local Development & Testing Workflow

### 1. Build and Run C Unit Tests
```bash
gcc -Wall -Wextra -Wpedantic -std=c99 -Isrc \
  src/core/process.c src/core/metrics.c src/core/simulation.c \
  src/schedulers/fcfs.c src/schedulers/sjf.c src/schedulers/srtf.c \
  src/schedulers/priority.c src/schedulers/round_robin.c \
  tests/test_metrics.c -o tests/bin/test_metrics
./tests/bin/test_metrics
```

### 2. Run Backend Python Tests
```bash
pytest --cov=backend backend/tests
python test_e2e_scenario.py
```

### 3. Run Frontend Tests & Build
```bash
cd frontend
npm test
npm run build
npm run lint
```
