
#include <stdio.h>
#include "../src/core/scheduler.h"
#include "../src/schedulers/srtf.h"

static int test_select(
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)ready_queue;
    (void)current_time;

    if (queue_size == 0) {
        return -1;
    }

    return 0;
}

static int test_preempt(
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

static int test_srtf_selects_shortest(void) {
    Process ready_queue[2];

    ready_queue[0] = process_create(1, 0, 6, 1);
    ready_queue[1] = process_create(2, 0, 2, 1);

    int selected = srtf_select_process(
        ready_queue,
        2,
        0
    );

    if (selected != 1) {
        printf("FAIL: SRTF did not select the shortest process\n");
        return 1;
    }

    printf("PASS: SRTF selects the shortest process\n");
    return 0;
}

static int test_srtf_tie_breaks_by_pid(void) {
    Process ready_queue[2];

    ready_queue[0] = process_create(2, 0, 3, 1);
    ready_queue[1] = process_create(1, 0, 3, 1);

    int selected = srtf_select_process(
        ready_queue,
        2,
        0
    );

    if (selected != 1) {
        printf("FAIL: SRTF tie-breaking by PID failed\n");
        return 1;
    }

    printf("PASS: SRTF tie-breaking by PID\n");
    return 0;
}

static int test_srtf_empty_queue(void) {
    int selected = srtf_select_process(NULL, 0, 0);

    if (selected != -1) {
        printf("FAIL: SRTF should reject an empty queue\n");
        return 1;
    }

    

    printf("PASS: SRTF empty queue\n");
    return 0;
}

int main(void) {
    Scheduler scheduler;

    scheduler.select_process = test_select;
    scheduler.should_preempt = test_preempt;

    Process processes[1];
    processes[0] = process_create(1, 0, 5, 1);

    int selected = scheduler.select_process(
        processes, 1, 0
    );

    int preempt = scheduler.should_preempt(
        &processes[0], NULL, 0, 0
    );

    if (selected != 0 || preempt != 0) {
        printf("FAIL: Scheduler interface test\n");
        return 1;
    }

     if (test_srtf_selects_shortest() != 0) {
        return 1;
    }
    if (test_srtf_tie_breaks_by_pid() != 0) {
        return 1;
    }

    if (test_srtf_empty_queue() != 0) {
        return 1;
    }
    

    printf("PASS: Scheduler interface test\n");
    return 0;
}
