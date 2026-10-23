#include "srtf.h"
#include <stdio.h>

int srtf_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)current_time;

    if (ready_queue == NULL || queue_size <= 0) {
        return -1;
    }

    int selected_index = 0;

    for (int i = 1; i < queue_size; i++) {
        if (
            ready_queue[i].remaining_time <
                ready_queue[selected_index].remaining_time
            ||
            (
                ready_queue[i].remaining_time ==
                    ready_queue[selected_index].remaining_time
                &&
                ready_queue[i].pid <
                    ready_queue[selected_index].pid
            )
        ) {
            selected_index = i;
        }
    }

    return selected_index;
}

int srtf_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    if (
        current_process == NULL ||
        ready_queue == NULL ||
        queue_size <= 0
    ) {
        return 0;
    }

    int selected_index = srtf_select_process(
        ready_queue,
        queue_size,
        current_time
    );

    if (selected_index < 0) {
        return 0;
    }

    return ready_queue[selected_index].remaining_time <
           current_process->remaining_time;
}

Scheduler create_srtf_scheduler(void) {
    Scheduler scheduler;

    scheduler.select_process = srtf_select_process;
    scheduler.should_preempt = srtf_should_preempt;
    scheduler.type = SCHEDULER_SRTF;
    scheduler.time_quantum = 0;
    scheduler.name = "SRTF";

    return scheduler;
}