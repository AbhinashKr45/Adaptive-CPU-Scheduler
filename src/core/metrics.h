#ifndef METRICS_H
#define METRICS_H

#include "process.h"

typedef struct {
    double avg_waiting_time;
    double median_waiting_time;
    int max_waiting_time;
    double p95_waiting_time;       /* 95th percentile waiting time (linear interpolation) */
    double waiting_time_std;      /* Population standard deviation of waiting time */

    double avg_turnaround_time;
    double median_turnaround_time;

    double avg_response_time;
    double median_response_time;
    int max_response_time;        /* Maximum response time observed */

    double throughput;
    double cpu_utilization;
    int total_busy_time;
    int total_idle_time;
    int makespan;

    int context_switches;
    int preemptions;

    double starvation_ratio;      /* max_waiting_time / (avg_waiting_time + 1e-9) */
    int starvation_count;         /* Number of processes with waiting_time > multiplier * avg_waiting */
    double waiting_time_gini;     /* Gini coefficient of waiting time [0.0, 1.0] */

    double jain_fairness_cpu;      /* Raw CPU service fairness: (sum x)^2 / (n * sum x^2) */
    double jain_fairness_progress; /* Demand-relative progress fairness: min(service/demand, 1.0) */
    int is_cpu_fairness_defined;
    int is_progress_fairness_defined;
} AggregateMetrics;

#define DEFAULT_STARVATION_MULTIPLIER 3.0

void metrics_calculate_process(Process *process);

double metrics_calculate_jains_index(const double values[], int count, int *is_defined);

double metrics_calculate_p95(const double sorted_array[], int n);
double metrics_calculate_std(const double array[], int n, double mean);
double metrics_calculate_gini(const double sorted_array[], int n);
int metrics_calculate_starvation_count(const Process processes[], int n, double avg_waiting, double multiplier);

void metrics_calculate_aggregate_ex(
    Process processes[],
    int process_count,
    int total_busy_time,
    int total_idle_time,
    int makespan,
    int context_switches,
    int preemptions,
    double starvation_multiplier,
    AggregateMetrics *out_metrics
);

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
