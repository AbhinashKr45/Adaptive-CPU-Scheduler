
#ifndef SCHEDULER_H
#define SCHEDULER_H

#include "process.h"

typedef int (*SelectProcessFunc)(
    Process ready_queue[],
    int queue_size,
    int current_time
);

typedef int (*ShouldPreemptFunc)(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
);

typedef enum {
    SCHEDULER_CUSTOM = 0,
    SCHEDULER_FCFS = 1,
    SCHEDULER_SJF = 2,
    SCHEDULER_SRTF = 3,
    SCHEDULER_PRIORITY = 4,
    SCHEDULER_ROUND_ROBIN = 5
} SchedulerType;

typedef struct {
    SelectProcessFunc select_process;
    ShouldPreemptFunc should_preempt;
    SchedulerType type;
    int time_quantum;
    const char *name;
} Scheduler;

#endif
