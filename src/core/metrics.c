#include "metrics.h"
#include <stdlib.h>
#include <math.h>

void metrics_calculate_process(Process *process) {
    if (process == NULL) {
        return;
    }

    if (process->completion_time >= 0 && process->arrival_time >= 0) {
        process->turnaround_time = process->completion_time - process->arrival_time;
    } else {
        process->turnaround_time = 0;
    }

    if (process->start_time >= 0 && process->arrival_time >= 0) {
        process->response_time = process->start_time - process->arrival_time;
    } else {
        process->response_time = -1;
    }

    process->waiting_time = process->turnaround_time - process->burst_time;
    if (process->waiting_time < 0) {
        process->waiting_time = 0;
    }

    process->executed_time = process->burst_time - process->remaining_time;
}

double metrics_calculate_jains_index(const double values[], int count, int *is_defined) {
    if (values == NULL || count <= 0) {
        if (is_defined) *is_defined = 0;
        return 0.0;
    }

    double sum = 0.0;
    double sum_sq = 0.0;

    for (int i = 0; i < count; i++) {
        double v = values[i];
        if (v < 0.0) v = 0.0;
        sum += v;
        sum_sq += v * v;
    }

    if (sum_sq <= 1e-12) {
        if (is_defined) *is_defined = 0;
        return 0.0;
    }

    if (is_defined) *is_defined = 1;
    double index = (sum * sum) / (count * sum_sq);
    if (index > 1.0) index = 1.0;
    if (index < 0.0) index = 0.0;
    return index;
}

static int compare_doubles(const void *a, const void *b) {
    double diff = (*(const double *)a) - (*(const double *)b);
    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
}

static double calculate_median(double array[], int n) {
    if (n <= 0) return 0.0;
    qsort(array, n, sizeof(double), compare_doubles);
    if (n % 2 == 1) {
        return array[n / 2];
    } else {
        return (array[(n / 2) - 1] + array[n / 2]) / 2.0;
    }
}

void metrics_calculate_aggregate(
    Process processes[],
    int process_count,
    int total_busy_time,
    int total_idle_time,
    int makespan,
    int context_switches,
    int preemptions,
    AggregateMetrics *out_metrics
) {
    if (out_metrics == NULL) {
        return;
    }

    if (processes == NULL || process_count <= 0) {
        out_metrics->avg_waiting_time = 0.0;
        out_metrics->median_waiting_time = 0.0;
        out_metrics->max_waiting_time = 0;
        out_metrics->avg_turnaround_time = 0.0;
        out_metrics->median_turnaround_time = 0.0;
        out_metrics->avg_response_time = 0.0;
        out_metrics->median_response_time = 0.0;
        out_metrics->throughput = 0.0;
        out_metrics->cpu_utilization = 0.0;
        out_metrics->total_busy_time = total_busy_time;
        out_metrics->total_idle_time = total_idle_time;
        out_metrics->makespan = makespan;
        out_metrics->context_switches = context_switches;
        out_metrics->preemptions = preemptions;
        out_metrics->starvation_ratio = 1.0;
        out_metrics->jain_fairness_cpu = 0.0;
        out_metrics->jain_fairness_progress = 0.0;
        out_metrics->is_cpu_fairness_defined = 0;
        out_metrics->is_progress_fairness_defined = 0;
        return;
    }

    double total_waiting = 0.0;
    double total_turnaround = 0.0;
    double total_response = 0.0;
    int max_waiting = 0;

    double *waiting_arr = malloc(sizeof(double) * process_count);
    double *turnaround_arr = malloc(sizeof(double) * process_count);
    double *response_arr = malloc(sizeof(double) * process_count);
    double *cpu_alloc_arr = malloc(sizeof(double) * process_count);
    double *progress_arr = malloc(sizeof(double) * process_count);

    for (int i = 0; i < process_count; i++) {
        metrics_calculate_process(&processes[i]);

        double w = (double)processes[i].waiting_time;
        double tat = (double)processes[i].turnaround_time;
        double resp = (double)processes[i].response_time;

        total_waiting += w;
        total_turnaround += tat;
        total_response += resp;

        if (processes[i].waiting_time > max_waiting) {
            max_waiting = processes[i].waiting_time;
        }

        if (waiting_arr) waiting_arr[i] = w;
        if (turnaround_arr) turnaround_arr[i] = tat;
        if (response_arr) response_arr[i] = resp;

        double executed = (double)processes[i].executed_time;
        double demand = (double)processes[i].burst_time;
        if (cpu_alloc_arr) cpu_alloc_arr[i] = executed;
        if (progress_arr) {
            double prog = (demand > 0.0) ? (executed / demand) : 0.0;
            if (prog > 1.0) prog = 1.0;
            progress_arr[i] = prog;
        }
    }

    out_metrics->avg_waiting_time = total_waiting / process_count;
    out_metrics->avg_turnaround_time = total_turnaround / process_count;
    out_metrics->avg_response_time = total_response / process_count;
    out_metrics->max_waiting_time = max_waiting;

    if (waiting_arr) {
        out_metrics->median_waiting_time = calculate_median(waiting_arr, process_count);
        free(waiting_arr);
    } else {
        out_metrics->median_waiting_time = out_metrics->avg_waiting_time;
    }

    if (turnaround_arr) {
        out_metrics->median_turnaround_time = calculate_median(turnaround_arr, process_count);
        free(turnaround_arr);
    } else {
        out_metrics->median_turnaround_time = out_metrics->avg_turnaround_time;
    }

    if (response_arr) {
        out_metrics->median_response_time = calculate_median(response_arr, process_count);
        free(response_arr);
    } else {
        out_metrics->median_response_time = out_metrics->avg_response_time;
    }

    out_metrics->makespan = makespan;
    out_metrics->total_busy_time = total_busy_time;
    out_metrics->total_idle_time = total_idle_time;
    out_metrics->context_switches = context_switches;
    out_metrics->preemptions = preemptions;

    if (makespan > 0) {
        out_metrics->throughput = (double)process_count / (double)makespan;
        out_metrics->cpu_utilization = (double)total_busy_time / (double)makespan;
    } else {
        out_metrics->throughput = 0.0;
        out_metrics->cpu_utilization = 0.0;
    }

    if (out_metrics->avg_waiting_time > 1e-6) {
        out_metrics->starvation_ratio = (double)max_waiting / out_metrics->avg_waiting_time;
    } else {
        out_metrics->starvation_ratio = 1.0;
    }

    if (cpu_alloc_arr) {
        out_metrics->jain_fairness_cpu = metrics_calculate_jains_index(
            cpu_alloc_arr, process_count, &out_metrics->is_cpu_fairness_defined
        );
        free(cpu_alloc_arr);
    } else {
        out_metrics->jain_fairness_cpu = 0.0;
        out_metrics->is_cpu_fairness_defined = 0;
    }

    if (progress_arr) {
        out_metrics->jain_fairness_progress = metrics_calculate_jains_index(
            progress_arr, process_count, &out_metrics->is_progress_fairness_defined
        );
        free(progress_arr);
    } else {
        out_metrics->jain_fairness_progress = 0.0;
        out_metrics->is_progress_fairness_defined = 0;
    }
}
