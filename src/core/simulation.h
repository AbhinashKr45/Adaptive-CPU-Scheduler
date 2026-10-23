#ifndef SIMULATION_H
#define SIMULATION_H

#include "process.h"
#include "scheduler.h"
#include "metrics.h"

typedef struct {
    int pid;        /* Process ID, or -1 for idle */
    int start_time;
    int end_time;
    int is_idle;    /* 1 if idle, 0 if executing process */
} TraceInterval;

typedef struct {
    Process *processes;
    int process_count;

    TraceInterval *trace;
    int trace_count;
    int trace_capacity;

    AggregateMetrics metrics;
} SimulationResult;

void simulation_result_init(SimulationResult *result);
void simulation_result_free(SimulationResult *result);

/* Run simulation and populate complete execution trace and aggregate metrics */
int simulation_run_detailed(
    const Process input_processes[],
    int process_count,
    Scheduler scheduler,
    SimulationResult *result
);

/* Backward-compatible simulation run matching existing tests */
int simulation_run(
    Process processes[],
    int process_count,
    Scheduler scheduler
);

/* Observation-time fairness measurement from actual execution traces */
typedef struct {
    int observation_time;           /* T: the time point of measurement */
    double jain_fairness_cpu;       /* Raw CPU service fairness at time T */
    double jain_fairness_progress;  /* Demand-relative progress fairness at time T */
    int is_cpu_defined;             /* 1 if CPU fairness is defined (non-zero service) */
    int is_progress_defined;        /* 1 if progress fairness is defined */
    int processes_arrived;          /* Number of processes arrived by time T */
    int processes_completed;        /* Number of processes completed by time T */
} ObservationTimeFairness;

/*
 * Computes fairness metrics at a specific observation time T from a completed
 * simulation result. Uses the actual execution trace to determine each process's
 * service received up to time T.
 *
 * Only processes that have arrived by time T are included in the fairness
 * calculation (same population across all policies for a given T).
 *
 * For demand-relative progress, Fᵢ(T) = min(service_i(T) / demand_i, 1.0).
 * If no processes have arrived by T, fairness is undefined.
 */
int simulation_compute_fairness_at_time(
    const SimulationResult *result,
    int observation_time,
    ObservationTimeFairness *out_fairness
);

#endif