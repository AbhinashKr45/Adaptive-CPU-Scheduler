
#ifndef PROCESS_H
#define PROCESS_H

typedef struct {
    int pid;

    int arrival_time;
    int burst_time;
    int remaining_time;
    int priority;

    int start_time;
    int completion_time;

    int waiting_time;
    int response_time;
    int turnaround_time;
    int executed_time;
} Process;

Process process_create(
    int pid,
    int arrival_time,
    int burst_time,
    int priority
);

int process_validate(const Process *process);
int processes_validate(const Process processes[], int process_count);
void process_reset(Process *process);

#endif
