
#include "process.h"
#include <stddef.h>

Process process_create(
    int pid,
    int arrival_time,
    int burst_time,
    int priority
) {
    Process process;

    process.pid = pid;
    process.arrival_time = arrival_time;
    process.burst_time = burst_time;
    process.remaining_time = burst_time;
    process.priority = priority;

    process.start_time = -1;
    process.completion_time = -1;
    process.waiting_time = 0;
    process.response_time = -1;
    process.turnaround_time = 0;
    process.executed_time = 0;

    return process;
}

int process_validate(const Process *process) {
    if (process == NULL) {
        return -1;
    }
    if (process->pid < 0) {
        return -1;
    }
    if (process->arrival_time < 0) {
        return -1;
    }
    if (process->burst_time <= 0) {
        return -1;
    }
    if (process->remaining_time < 0 || process->remaining_time > process->burst_time) {
        return -1;
    }
    return 0;
}

int processes_validate(const Process processes[], int process_count) {
    if (processes == NULL || process_count <= 0) {
        return -1;
    }

    for (int i = 0; i < process_count; i++) {
        if (process_validate(&processes[i]) != 0) {
            return -1;
        }
        if (processes[i].start_time != -1 || processes[i].completion_time != -1) {
            return -1;
        }
        /* Check duplicate PIDs */
        for (int j = i + 1; j < process_count; j++) {
            if (processes[i].pid == processes[j].pid) {
                return -1;
            }
        }
    }
    return 0;
}

void process_reset(Process *process) {
    if (process == NULL) {
        return;
    }
    process->remaining_time = process->burst_time;
    process->start_time = -1;
    process->completion_time = -1;
    process->waiting_time = 0;
    process->response_time = -1;
    process->turnaround_time = 0;
    process->executed_time = 0;
}

