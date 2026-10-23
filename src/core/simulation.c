#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "simulation.h"

void simulation_result_init(SimulationResult *result) {
    if (result == NULL) return;
    result->processes = NULL;
    result->process_count = 0;
    result->trace = NULL;
    result->trace_count = 0;
    result->trace_capacity = 0;
    memset(&result->metrics, 0, sizeof(AggregateMetrics));
}

void simulation_result_free(SimulationResult *result) {
    if (result == NULL) return;
    if (result->processes) {
        free(result->processes);
        result->processes = NULL;
    }
    if (result->trace) {
        free(result->trace);
        result->trace = NULL;
    }
    result->process_count = 0;
    result->trace_count = 0;
    result->trace_capacity = 0;
}

static int append_trace_interval(SimulationResult *result, int pid, int start_time, int end_time, int is_idle) {
    if (result == NULL || start_time >= end_time) {
        return 0;
    }

    /* Coalesce if same pid and contiguous */
    if (result->trace_count > 0) {
        TraceInterval *last = &result->trace[result->trace_count - 1];
        if (last->pid == pid && last->is_idle == is_idle && last->end_time == start_time) {
            last->end_time = end_time;
            return 0;
        }
    }

    if (result->trace_count >= result->trace_capacity) {
        int new_cap = (result->trace_capacity == 0) ? 64 : result->trace_capacity * 2;
        TraceInterval *new_trace = realloc(result->trace, sizeof(TraceInterval) * new_cap);
        if (new_trace == NULL) {
            return -1;
        }
        result->trace = new_trace;
        result->trace_capacity = new_cap;
    }

    result->trace[result->trace_count].pid = pid;
    result->trace[result->trace_count].start_time = start_time;
    result->trace[result->trace_count].end_time = end_time;
    result->trace[result->trace_count].is_idle = is_idle;
    result->trace_count++;

    return 0;
}

static int build_ready_queue(
    Process processes[],
    int process_count,
    int current_time,
    Process ready_queue[],
    int original_indices[]
) {
    int queue_size = 0;

    for (int i = 0; i < process_count; i++) {
        if (
            processes[i].arrival_time <= current_time &&
            processes[i].remaining_time > 0
        ) {
            ready_queue[queue_size] = processes[i];
            original_indices[queue_size] = i;
            queue_size++;
        }
    }

    return queue_size;
}


/* Round Robin simulation implementation */
static int run_round_robin(
    Process procs[],
    int process_count,
    int time_quantum,
    SimulationResult *result
) {
    int *ready_fifo = malloc(sizeof(int) * process_count * 4);
    int *in_queue = calloc(process_count, sizeof(int));
    if (ready_fifo == NULL || in_queue == NULL) {
        free(ready_fifo);
        free(in_queue);
        return -1;
    }

    int fifo_head = 0;
    int fifo_tail = 0;
    int fifo_capacity = process_count * 4;

    #define FIFO_PUSH(idx) do { \
        if (fifo_tail >= fifo_capacity) { \
            int new_c = fifo_capacity * 2; \
            int *new_q = realloc(ready_fifo, sizeof(int) * new_c); \
            if (new_q) { ready_fifo = new_q; fifo_capacity = new_c; } \
        } \
        ready_fifo[fifo_tail++] = (idx); \
        in_queue[(idx)] = 1; \
    } while(0)

    #define FIFO_POP() (ready_fifo[fifo_head++])
    #define FIFO_EMPTY() (fifo_head >= fifo_tail)

    int current_time = 0;
    int completed_count = 0;
    int total_busy = 0;
    int total_idle = 0;
    int context_switches = 0;
    int preemptions = 0;
    int last_running_pid = -1;

    /* Enqueue all processes arriving at time <= 0 sorted by arrival, then PID */
    int initial_ready[process_count];
    int init_count = 0;
    for (int i = 0; i < process_count; i++) {
        if (procs[i].arrival_time <= 0) {
            initial_ready[init_count++] = i;
        }
    }
    /* Simple sort for initial arrivals */
    for (int i = 0; i < init_count - 1; i++) {
        for (int j = i + 1; j < init_count; j++) {
            int a = initial_ready[i];
            int b = initial_ready[j];
            if (procs[a].arrival_time > procs[b].arrival_time ||
               (procs[a].arrival_time == procs[b].arrival_time && procs[a].pid > procs[b].pid)) {
                initial_ready[i] = b;
                initial_ready[j] = a;
            }
        }
    }
    for (int i = 0; i < init_count; i++) {
        FIFO_PUSH(initial_ready[i]);
    }

    while (completed_count < process_count) {
        if (FIFO_EMPTY()) {
            /* CPU is idle. Find earliest arrival among uncompleted processes */
            int next_arr = -1;
            for (int i = 0; i < process_count; i++) {
                if (procs[i].remaining_time > 0) {
                    if (next_arr == -1 || procs[i].arrival_time < next_arr) {
                        next_arr = procs[i].arrival_time;
                    }
                }
            }

            if (next_arr > current_time) {
                append_trace_interval(result, -1, current_time, next_arr, 1);
                total_idle += (next_arr - current_time);
                current_time = next_arr;
            }

            /* Enqueue all processes arriving at current_time */
            int arriving[process_count];
            int arr_c = 0;
            for (int i = 0; i < process_count; i++) {
                if (procs[i].remaining_time > 0 && !in_queue[i] && procs[i].arrival_time <= current_time) {
                    arriving[arr_c++] = i;
                }
            }
            for (int i = 0; i < arr_c - 1; i++) {
                for (int j = i + 1; j < arr_c; j++) {
                    int a = arriving[i];
                    int b = arriving[j];
                    if (procs[a].arrival_time > procs[b].arrival_time ||
                       (procs[a].arrival_time == procs[b].arrival_time && procs[a].pid > procs[b].pid)) {
                        arriving[i] = b;
                        arriving[j] = a;
                    }
                }
            }
            for (int i = 0; i < arr_c; i++) {
                FIFO_PUSH(arriving[i]);
            }

            if (FIFO_EMPTY()) {
                current_time++;
                continue;
            }
        }

        int curr_idx = FIFO_POP();
        in_queue[curr_idx] = 0;
        Process *p = &procs[curr_idx];

        if (last_running_pid != -1 && last_running_pid != p->pid) {
            context_switches++;
        }
        last_running_pid = p->pid;

        if (p->start_time == -1) {
            p->start_time = current_time;
        }

        int run_time = (p->remaining_time < time_quantum) ? p->remaining_time : time_quantum;
        int interval_start = current_time;
        int interval_end = current_time + run_time;

        p->remaining_time -= run_time;
        p->executed_time += run_time;
        total_busy += run_time;
        current_time = interval_end;

        append_trace_interval(result, p->pid, interval_start, interval_end, 0);

        /* Enqueue processes that arrived during (interval_start, interval_end] */
        int newly_arrived[process_count];
        int new_c = 0;
        for (int i = 0; i < process_count; i++) {
            if (i != curr_idx && procs[i].remaining_time > 0 && !in_queue[i]) {
                if (procs[i].arrival_time > interval_start && procs[i].arrival_time <= interval_end) {
                    newly_arrived[new_c++] = i;
                }
            }
        }
        /* Sort newly arrived by arrival_time, then PID */
        for (int i = 0; i < new_c - 1; i++) {
            for (int j = i + 1; j < new_c; j++) {
                int a = newly_arrived[i];
                int b = newly_arrived[j];
                if (procs[a].arrival_time > procs[b].arrival_time ||
                   (procs[a].arrival_time == procs[b].arrival_time && procs[a].pid > procs[b].pid)) {
                    newly_arrived[i] = b;
                    newly_arrived[j] = a;
                }
            }
        }
        for (int i = 0; i < new_c; i++) {
            FIFO_PUSH(newly_arrived[i]);
        }

        if (p->remaining_time == 0) {
            p->completion_time = current_time;
            completed_count++;
        } else {
            /* Quantum expired and remaining > 0: preempted */
            preemptions++;
            FIFO_PUSH(curr_idx);
        }
    }

    free(ready_fifo);
    free(in_queue);

    if (result) {
        int makespan = current_time;
        metrics_calculate_aggregate(
            procs,
            process_count,
            total_busy,
            total_idle,
            makespan,
            context_switches,
            preemptions,
            &result->metrics
        );
    }

    return 0;
}

int simulation_run_detailed(
    const Process input_processes[],
    int process_count,
    Scheduler scheduler,
    SimulationResult *result
) {
    if (input_processes == NULL || process_count <= 0) {
        return -1;
    }

    /* Validate inputs */
    if (processes_validate(input_processes, process_count) != 0) {
        return -1;
    }

    if (scheduler.type == SCHEDULER_ROUND_ROBIN) {
        if (scheduler.time_quantum <= 0) {
            return -1;
        }
    } else {
        if (scheduler.select_process == NULL || scheduler.should_preempt == NULL) {
            return -1;
        }
    }

    /* Allocate working copy of processes */
    Process *procs = malloc(sizeof(Process) * process_count);
    if (procs == NULL) {
        return -1;
    }
    memcpy(procs, input_processes, sizeof(Process) * process_count);

    if (result) {
        simulation_result_init(result);
    }

    /* Check for Round Robin */
    if (scheduler.type == SCHEDULER_ROUND_ROBIN) {
        int status = run_round_robin(procs, process_count, scheduler.time_quantum, result);
        if (status == 0 && result) {
            result->processes = procs;
            result->process_count = process_count;
        } else {
            free(procs);
        }
        return status;
    }

    /* Standard / Priority / SJF / SRTF / FCFS simulation */
    Process *ready_queue = malloc(sizeof(Process) * process_count);
    int *original_indices = malloc(sizeof(int) * process_count);

    if (ready_queue == NULL || original_indices == NULL) {
        free(procs);
        free(ready_queue);
        free(original_indices);
        return -1;
    }

    int current_time = 0;
    int completed_count = 0;
    Process *current_process = NULL;
    int status = 0;
    int total_busy = 0;
    int total_idle = 0;
    int context_switches = 0;
    int preemptions = 0;
    int last_running_pid = -1;

    while (completed_count < process_count) {
        int queue_size = build_ready_queue(
            procs,
            process_count,
            current_time,
            ready_queue,
            original_indices
        );

        if (queue_size == 0) {
            /* Find next arrival time to advance idle cleanly */
            int next_arr = -1;
            for (int i = 0; i < process_count; i++) {
                if (procs[i].remaining_time > 0 && procs[i].arrival_time > current_time) {
                    if (next_arr == -1 || procs[i].arrival_time < next_arr) {
                        next_arr = procs[i].arrival_time;
                    }
                }
            }

            int advance_to = (next_arr > current_time) ? next_arr : (current_time + 1);
            append_trace_interval(result, -1, current_time, advance_to, 1);
            total_idle += (advance_to - current_time);
            current_time = advance_to;
            current_process = NULL;
            continue;
        }

        int should_select = (current_process == NULL);

        if (!should_select) {
            should_select = scheduler.should_preempt(
                current_process,
                ready_queue,
                queue_size,
                current_time
            );
        }

        if (should_select) {
            int selected_index = scheduler.select_process(
                ready_queue,
                queue_size,
                current_time
            );

            if (selected_index < 0 || selected_index >= queue_size) {
                status = -1;
                break;
            }

            int process_index = original_indices[selected_index];
            Process *next_proc = &procs[process_index];

            if (current_process != NULL && current_process != next_proc && current_process->remaining_time > 0) {
                preemptions++;
            }

            current_process = next_proc;
        }

        if (last_running_pid != -1 && last_running_pid != current_process->pid) {
            context_switches++;
        }
        last_running_pid = current_process->pid;

        if (current_process->start_time == -1) {
            current_process->start_time = current_time;
        }

        append_trace_interval(result, current_process->pid, current_time, current_time + 1, 0);

        current_process->remaining_time--;
        current_process->executed_time++;
        total_busy++;
        current_time++;

        if (current_process->remaining_time == 0) {
            current_process->completion_time = current_time;
            completed_count++;
            current_process = NULL;
        }
    }

    free(ready_queue);
    free(original_indices);

    if (status == 0 && result) {
        int makespan = current_time;
        metrics_calculate_aggregate(
            procs,
            process_count,
            total_busy,
            total_idle,
            makespan,
            context_switches,
            preemptions,
            &result->metrics
        );
        result->processes = procs;
        result->process_count = process_count;
    } else {
        free(procs);
    }

    return status;
}

int simulation_run(
    Process processes[],
    int process_count,
    Scheduler scheduler
) {
    if (processes == NULL || process_count <= 0) {
        return -1;
    }

    SimulationResult res;
    int status = simulation_run_detailed(processes, process_count, scheduler, &res);

    if (status == 0) {
        /* Copy updated process metrics back to the input array */
        for (int i = 0; i < process_count; i++) {
            processes[i] = res.processes[i];
        }
        simulation_result_free(&res);
    }

    return status;
}

int simulation_compute_fairness_at_time(
    const SimulationResult *result,
    int observation_time,
    ObservationTimeFairness *out_fairness
) {
    if (result == NULL || out_fairness == NULL || result->processes == NULL || result->process_count <= 0) {
        return -1;
    }

    int T = observation_time;
    int n = result->process_count;

    out_fairness->observation_time = T;
    out_fairness->jain_fairness_cpu = 0.0;
    out_fairness->jain_fairness_progress = 0.0;
    out_fairness->is_cpu_defined = 0;
    out_fairness->is_progress_defined = 0;
    out_fairness->processes_arrived = 0;
    out_fairness->processes_completed = 0;

    /* Allocate per-process service arrays */
    double *service = calloc(n, sizeof(double));
    if (service == NULL) return -1;

    /* Walk the trace to accumulate service per process up to time T */
    for (int t = 0; t < result->trace_count; t++) {
        const TraceInterval *ti = &result->trace[t];
        if (ti->is_idle || ti->pid < 0) continue;
        if (ti->start_time >= T) break;  /* Beyond observation window */

        int effective_end = (ti->end_time < T) ? ti->end_time : T;
        int effective_start = ti->start_time;
        if (effective_start >= effective_end) continue;

        int duration = effective_end - effective_start;

        /* Find the process index by PID */
        for (int i = 0; i < n; i++) {
            if (result->processes[i].pid == ti->pid) {
                service[i] += (double)duration;
                break;
            }
        }
    }

    /* Determine which processes have arrived by time T */
    int arrived_count = 0;
    int completed_count = 0;
    for (int i = 0; i < n; i++) {
        if (result->processes[i].arrival_time <= T) {
            arrived_count++;
            if (result->processes[i].completion_time >= 0 &&
                result->processes[i].completion_time <= T) {
                completed_count++;
            }
        }
    }

    out_fairness->processes_arrived = arrived_count;
    out_fairness->processes_completed = completed_count;

    if (arrived_count == 0) {
        free(service);
        return 0;  /* No processes to measure; fairness undefined but not an error */
    }

    /* Build arrays for only arrived processes */
    double *cpu_arr = malloc(sizeof(double) * arrived_count);
    double *progress_arr = malloc(sizeof(double) * arrived_count);
    if (cpu_arr == NULL || progress_arr == NULL) {
        free(service);
        free(cpu_arr);
        free(progress_arr);
        return -1;
    }

    int idx = 0;
    for (int i = 0; i < n; i++) {
        if (result->processes[i].arrival_time <= T) {
            cpu_arr[idx] = service[i];

            double demand = (double)result->processes[i].burst_time;
            double prog = (demand > 0.0) ? (service[i] / demand) : 0.0;
            if (prog > 1.0) prog = 1.0;
            progress_arr[idx] = prog;
            idx++;
        }
    }

    free(service);

    /* Compute Jain's fairness indices */
    out_fairness->jain_fairness_cpu = metrics_calculate_jains_index(
        cpu_arr, arrived_count, &out_fairness->is_cpu_defined
    );
    out_fairness->jain_fairness_progress = metrics_calculate_jains_index(
        progress_arr, arrived_count, &out_fairness->is_progress_defined
    );

    free(cpu_arr);
    free(progress_arr);
    return 0;
}

