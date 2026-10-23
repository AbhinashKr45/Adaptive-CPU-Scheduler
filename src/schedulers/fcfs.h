
#ifndef FCFS_H
#define FCFS_H

#include "../core/scheduler.h"

int fcfs_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
);

int fcfs_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
);

Scheduler create_fcfs_scheduler(void);

#endif
