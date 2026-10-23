
#ifndef SRTF_H
#define SRTF_H

#include "../core/scheduler.h"

int srtf_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
);


int srtf_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
);

Scheduler create_srtf_scheduler(void);
#endif
