#include "priority.h"
#include <stdio.h>

int priority_select_process(
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
            ready_queue[i].priority <
                ready_queue[selected_index].priority ||
            (
                ready_queue[i].priority ==
                    ready_queue[selected_index].priority &&
                ready_queue[i].pid <
                    ready_queue[selected_index].pid
            )
        ) {
            selected_index = i;
        }
    }

    return selected_index;
}

int priority_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)current_process;
    (void)ready_queue;
    (void)queue_size;
    (void)current_time;

    return 0;
}

Scheduler create_priority_scheduler(void) {
    Scheduler scheduler;

    scheduler.select_process = priority_select_process;
    scheduler.should_preempt = priority_should_preempt;
    scheduler.type = SCHEDULER_PRIORITY;
    scheduler.time_quantum = 0;
    scheduler.name = "Priority";

    return scheduler;
}