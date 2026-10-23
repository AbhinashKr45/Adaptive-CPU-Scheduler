#include "round_robin.h"
#include <stddef.h>

int round_robin_select_process(
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)current_time;

    if (ready_queue == NULL || queue_size <= 0) {
        return -1;
    }

    /* In Round Robin, the ready queue is maintained in FIFO arrival/preemption order.
       Therefore, the head of the ready queue (index 0) is always the next eligible process. */
    return 0;
}

int round_robin_should_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)current_process;
    (void)ready_queue;
    (void)queue_size;
    (void)current_time;

    /* Preemption is governed by time quantum expiry in the simulation loop. */
    return 0;
}

Scheduler create_round_robin_scheduler(int quantum) {
    Scheduler scheduler;

    scheduler.select_process = round_robin_select_process;
    scheduler.should_preempt = round_robin_should_preempt;
    scheduler.type = SCHEDULER_ROUND_ROBIN;
    scheduler.time_quantum = (quantum > 0) ? quantum : 1;
    scheduler.name = "Round Robin";

    return scheduler;
}
