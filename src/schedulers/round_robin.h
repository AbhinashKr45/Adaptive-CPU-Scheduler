#ifndef ROUND_ROBIN_H
#define ROUND_ROBIN_H

#include "../core/scheduler.h"

int round_robin_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
);

int round_robin_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
);

Scheduler create_round_robin_scheduler(int quantum);

#endif
