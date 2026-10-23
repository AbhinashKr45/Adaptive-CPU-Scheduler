
#include <stdio.h>

#include "../src/core/process.h"
#include "../src/schedulers/srtf.h"

/* Test 1: Select the process with the shortest remaining time. */
static int test_srtf_selects_shortest(void) {
    Process queue[2];

    queue[0] = process_create(1, 0, 6, 1);
    queue[1] = process_create(2, 0, 2, 1);

    int selected = srtf_select_process(queue, 2, 0);

    if (selected != 1) {
        printf("FAIL: SRTF shortest selection\n");
        return 1;
    }

    printf("PASS: SRTF shortest selection\n");
    return 0;
}

/* Test 2: Break equal remaining-time ties using the smaller PID. */
static int test_srtf_tie_breaks_by_pid(void) {
    Process queue[2];

    queue[0] = process_create(2, 0, 3, 1);
    queue[1] = process_create(1, 0, 3, 1);

    int selected = srtf_select_process(queue, 2, 0);

    if (selected != 1) {
        printf("FAIL: SRTF PID tie-break\n");
        return 1;
    }

    printf("PASS: SRTF PID tie-break\n");
    return 0;
}

/* Test 3: An empty queue must return -1. */
static int test_srtf_empty_queue(void) {
    int selected = srtf_select_process(NULL, 0, 0);

    if (selected != -1) {
        printf("FAIL: SRTF empty queue\n");
        return 1;
    }

    printf("PASS: SRTF empty queue\n");
    return 0;
}

/* Test 4: Preempt when another process needs less CPU time. */
static int test_srtf_preempts_for_shorter_process(void) {
    Process current = process_create(1, 0, 5, 1);
    current.remaining_time = 4;

    Process queue[2];
    queue[0] = current;
    queue[1] = process_create(2, 2, 2, 1);

    int result = srtf_should_preempt(&current, queue, 2, 2);

    if (result != 1) {
        printf("FAIL: SRTF should preempt for shorter process\n");
        return 1;
    }

    printf("PASS: SRTF preempts for shorter process\n");
    return 0;
}

/* Test 5: Equal remaining times must not cause preemption. */
static int test_srtf_does_not_preempt_on_tie(void) {
    Process current = process_create(1, 0, 5, 1);
    current.remaining_time = 4;

    Process queue[2];
    queue[0] = current;
    queue[1] = process_create(2, 2, 4, 1);

    int result = srtf_should_preempt(&current, queue, 2, 2);

    if (result != 0) {
        printf("FAIL: SRTF preempted on equal remaining time\n");
        return 1;
    }

    printf("PASS: SRTF does not preempt on tie\n");
    return 0;
}

/* Test 6: A longer process must not preempt the current process. */
static int test_srtf_does_not_preempt_for_longer_process(void) {
    Process current = process_create(1, 0, 5, 1);
    current.remaining_time = 4;

    Process queue[2];
    queue[0] = current;
    queue[1] = process_create(2, 2, 6, 1);

    int result = srtf_should_preempt(&current, queue, 2, 2);

    if (result != 0) {
        printf("FAIL: SRTF preempted for longer process\n");
        return 1;
    }

    printf("PASS: SRTF does not preempt for longer process\n");
    return 0;
}

/* Test 7: Invalid preemption inputs must be handled safely. */
static int test_srtf_preemption_invalid_inputs(void) {
    Process current = process_create(1, 0, 5, 1);

    if (srtf_should_preempt(NULL, NULL, 0, 0) != 0) {
        printf("FAIL: SRTF NULL current-process handling\n");
        return 1;
    }

    if (srtf_should_preempt(&current, NULL, 0, 0) != 0) {
        printf("FAIL: SRTF NULL queue handling\n");
        return 1;
    }

    if (srtf_should_preempt(&current, &current, 0, 0) != 0) {
        printf("FAIL: SRTF empty-queue handling\n");
        return 1;
    }

    printf("PASS: SRTF preemption invalid-input handling\n");
    return 0;
}

static int test_srtf_scheduler_factory(void) {
    Scheduler scheduler = create_srtf_scheduler();

    if (scheduler.select_process != srtf_select_process) {
        printf("FAIL: SRTF selection callback not assigned\n");
        return 1;
    }

    if (scheduler.should_preempt != srtf_should_preempt) {
        printf("FAIL: SRTF preemption callback not assigned\n");
        return 1;
    }

    printf("PASS: SRTF scheduler factory\n");
    return 0;
}

int main(void) {
    if (test_srtf_selects_shortest() != 0) return 1;
    if (test_srtf_tie_breaks_by_pid() != 0) return 1;
    if (test_srtf_empty_queue() != 0) return 1;
    if (test_srtf_preempts_for_shorter_process() != 0) return 1;
    if (test_srtf_does_not_preempt_on_tie() != 0) return 1;
    if (test_srtf_does_not_preempt_for_longer_process() != 0) return 1;
    if (test_srtf_preemption_invalid_inputs() != 0) return 1;

    if (test_srtf_scheduler_factory() != 0) {
        return 1;
    }
    printf("\nPASS: All SRTF unit tests\n");
    return 0;
}
