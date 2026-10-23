#ifndef METRICS_H
#define METRICS_H

#include "process.h"

typedef struct {
    double avg_waiting_time;
    double median_waiting_time;
    int max_waiting_time;

    double avg_turnaround_time;
    double median_turnaround_time;

    double avg_response_time;
    double median_response_time;

    double throughput;
    double cpu_utilization;
    int total_busy_time;
    int total_idle_time;
    int makespan;

    int context_switches;
    int preemptions;

    double starvation_ratio; /* max_waiting_time / (avg_waiting_time + 1e-9) */

    double jain_fairness_cpu;      /* Raw CPU service fairness: (sum x)^2 / (n * sum x^2) */
    double jain_fairness_progress; /* Demand-relative progress fairness: min(service/demand, 1.0) */
    int is_cpu_fairness_defined;
    int is_progress_fairness_defined;
} AggregateMetrics;

void metrics_calculate_process(Process *process);

double metrics_calculate_jains_index(const double values[], int count, int *is_defined);

void metrics_calculate_aggregate(
    Process processes[],
    int process_count,
    int total_busy_time,
    int total_idle_time,
    int makespan,
    int context_switches,
    int preemptions,
    AggregateMetrics *out_metrics
);

#endif
