#include <stdio.h>

#include "../src/core/process.h"
#include "../src/schedulers/sjf.h"

static int test_sjf_selects_shortest_job(void) {
    Process queue[3];

    queue[0] = process_create(1, 0, 6, 1);
    queue[1] = process_create(2, 0, 3, 1);
    queue[2] = process_create(3, 0, 1, 1);

    int selected = sjf_select_process(queue, 3, 0);

    if (selected != 2) {
        printf("FAIL: SJF shortest-job selection\n");
        return 1;
    }

    printf("PASS: SJF shortest-job selection\n");
    return 0;
}

static int test_sjf_tie_breaks_by_pid(void) {
    Process queue[2];

    queue[0] = process_create(2, 0, 3, 1);
    queue[1] = process_create(1, 0, 3, 1);

    int selected = sjf_select_process(queue, 2, 0);

    if (selected != 1) {
        printf("FAIL: SJF PID tie-break\n");
        return 1;
    }

    printf("PASS: SJF PID tie-break\n");
    return 0;
}

static int test_sjf_empty_queue(void) {
    int selected = sjf_select_process(NULL, 0, 0);

    if (selected != -1) {
        printf("FAIL: SJF empty queue\n");
        return 1;
    }

    printf("PASS: SJF empty queue\n");
    return 0;
}

static int test_sjf_does_not_preempt(void) {
    Process current = process_create(1, 0, 6, 1);
    Process queue[2];

    queue[0] = current;
    queue[1] = process_create(2, 2, 1, 1);

    int result = sjf_should_preempt(&current, queue, 2, 2);

    if (result != 0) {
        printf("FAIL: SJF preempted the running process\n");
        return 1;
    }

    printf("PASS: SJF does not preempt\n");
    return 0;
}

static int test_sjf_scheduler_factory(void) {
    Scheduler scheduler = create_sjf_scheduler();

    if (scheduler.select_process != sjf_select_process) {
        printf("FAIL: SJF selection callback\n");
        return 1;
    }

    if (scheduler.should_preempt != sjf_should_preempt) {
        printf("FAIL: SJF preemption callback\n");
        return 1;
    }

    printf("PASS: SJF scheduler factory\n");
    return 0;
}

int main(void) {
    if (test_sjf_selects_shortest_job() != 0) return 1;
    if (test_sjf_tie_breaks_by_pid() != 0) return 1;
    if (test_sjf_empty_queue() != 0) return 1;
    if (test_sjf_does_not_preempt() != 0) return 1;
    if (test_sjf_scheduler_factory() != 0) return 1;

    printf("\nPASS: All SJF unit tests\n");
    return 0;
}