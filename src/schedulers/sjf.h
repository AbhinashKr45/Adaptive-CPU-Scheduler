#ifndef SJF_H
#define SJF_H

#include "../core/scheduler.h"

int sjf_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
);

int sjf_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
);

Scheduler create_sjf_scheduler(void);

#endif