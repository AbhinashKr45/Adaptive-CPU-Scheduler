#ifndef PRIORITY_H
#define PRIORITY_H

#include "../core/scheduler.h"

int priority_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
);

int priority_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
);

Scheduler create_priority_scheduler(void);

#endif