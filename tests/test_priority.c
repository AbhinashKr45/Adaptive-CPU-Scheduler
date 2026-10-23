#include <stdio.h>

#include "../src/core/process.h"
#include "../src/schedulers/priority.h"

static int test_priority_selects_highest_priority(void) {
    Process queue[3];

    queue[0] = process_create(1, 0, 5, 3);
    queue[1] = process_create(2, 0, 2, 1);
    queue[2] = process_create(3, 0, 3, 2);

    int selected = priority_select_process(queue, 3, 0);

    if (selected != 1) {
        printf("FAIL: Priority selection\n");
        return 1;
    }

    printf("PASS: Priority selection\n");
    return 0;
}

static int test_priority_tie_breaks_by_pid(void) {
    Process queue[2];

    queue[0] = process_create(2, 0, 3, 1);
    queue[1] = process_create(1, 0, 5, 1);

    int selected = priority_select_process(queue, 2, 0);

    if (selected != 1) {
        printf("FAIL: Priority PID tie-break\n");
        return 1;
    }

    printf("PASS: Priority PID tie-break\n");
    return 0;
}

static int test_priority_empty_queue(void) {
    int selected = priority_select_process(NULL, 0, 0);

    if (selected != -1) {
        printf("FAIL: Priority empty queue\n");
        return 1;
    }

    printf("PASS: Priority empty queue\n");
    return 0;
}

static int test_priority_does_not_preempt(void) {
    Process current = process_create(1, 0, 5, 3);
    Process queue[2];

    queue[0] = current;
    queue[1] = process_create(2, 2, 1, 1);

    int result = priority_should_preempt(&current, queue, 2, 2);

    if (result != 0) {
        printf("FAIL: Priority preemption\n");
        return 1;
    }

    printf("PASS: Priority does not preempt\n");
    return 0;
}

static int test_priority_scheduler_factory(void) {
    Scheduler scheduler = create_priority_scheduler();

    if (scheduler.select_process != priority_select_process) {
        printf("FAIL: Priority selection callback\n");
        return 1;
    }

    if (scheduler.should_preempt != priority_should_preempt) {
        printf("FAIL: Priority preemption callback\n");
        return 1;
    }

    printf("PASS: Priority scheduler factory\n");
    return 0;
}

int main(void) {
    if (test_priority_selects_highest_priority() != 0) return 1;
    if (test_priority_tie_breaks_by_pid() != 0) return 1;
    if (test_priority_empty_queue() != 0) return 1;
    if (test_priority_does_not_preempt() != 0) return 1;
    if (test_priority_scheduler_factory() != 0) return 1;

    printf("\nPASS: All Priority unit tests\n");
    return 0;
}