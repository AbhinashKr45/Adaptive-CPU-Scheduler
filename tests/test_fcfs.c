
#include <stdio.h>
#include "../src/schedulers/fcfs.h"

int main(void) {
    Process processes[3];

    processes[0] = process_create(1, 2, 5, 1);
    processes[1] = process_create(2, 0, 3, 2);
    processes[2] = process_create(3, 1, 2, 3);

    Scheduler scheduler = create_fcfs_scheduler();

    int selected = scheduler.select_process(
        processes, 3, 2
    );

    if (selected < 0 || selected >= 3 ||
        processes[selected].pid != 2) {
        printf("FAIL: FCFS selection test\n");
        return 1;
    }

    int preempt = scheduler.should_preempt(
        &processes[0], processes + 1, 2, 2
    );

    if (preempt != 0) {
        printf("FAIL: FCFS preemption test\n");
        return 1;
    }

    printf("PASS: FCFS selection test\n");
    printf("PASS: FCFS non-preemption test\n");

    return 0;
}
