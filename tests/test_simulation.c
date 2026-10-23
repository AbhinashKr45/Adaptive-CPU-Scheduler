
#include <stdio.h>

#include "../src/core/simulation.h"
#include "../src/schedulers/fcfs.h"
#include "../src/schedulers/srtf.h"
#include "../src/schedulers/sjf.h"
#include "../src/schedulers/priority.h"




static int test_cpu_idle_time(void) {
    Process processes[1];

    processes[0] = process_create(1, 2, 2, 1);

    Scheduler scheduler = create_fcfs_scheduler();

    int result = simulation_run(
        processes, 1, scheduler
    );

    if (result != 0) {
        printf("FAIL: Idle-time simulation returned an error\n");
        return 1;
    }

    if (
        processes[0].start_time != 2 ||
        processes[0].completion_time != 4 ||
        processes[0].remaining_time != 0
    ) {
        printf("FAIL: CPU idle-time handling\n");
        return 1;
    }

    printf("PASS: CPU idle-time test\n");
    return 0;
}


static int test_invalid_burst_time(void) {
    Process processes[1];

    processes[0] = process_create(1, 0, 0, 1);

    Scheduler scheduler = create_fcfs_scheduler();

    int result = simulation_run(
        processes, 1, scheduler
    );

    if (result != -1) {
        printf("FAIL: Zero burst time was not rejected\n");
        return 1;
    }

    printf("PASS: Invalid burst-time test\n");
    return 0;
}


static int test_invalid_input_preserves_state(void) {
    Process processes[2];

    processes[0] = process_create(1, 0, 3, 1);
    processes[1] = process_create(2, 0, 0, 2);

    Scheduler scheduler = create_fcfs_scheduler();

    int result = simulation_run(
        processes, 2, scheduler
    );

    if (result != -1) {
        printf("FAIL: Invalid workload was not rejected\n");
        return 1;
    }

    if (
        processes[0].remaining_time != 3 ||
        processes[0].start_time != -1 ||
        processes[0].completion_time != -1
    ) {
        printf("FAIL: Valid process state changed\n");
        return 1;
    }

    printf("PASS: Invalid input preserves process state\n");
    return 0;
}


static int test_srtf_select(
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)current_time;

    if (queue_size <= 0) {
        return -1;
    }

    int best = 0;

    for (int i = 1; i < queue_size; i++) {
        if (
            ready_queue[i].remaining_time <
                ready_queue[best].remaining_time ||
            (
                ready_queue[i].remaining_time ==
                    ready_queue[best].remaining_time &&
                ready_queue[i].pid < ready_queue[best].pid
            )
        ) {
            best = i;
        }
    }

    return best;
}

static int test_srtf_preempt(
    Process *current_process,
    Process ready_queue[],
    int queue_size,
    int current_time
) {
    (void)current_time;

    int best = test_srtf_select(
        ready_queue, queue_size, current_time
    );

    if (best < 0) {
        return 0;
    }

    return ready_queue[best].remaining_time <
           current_process->remaining_time;
}

static int test_srtf_preemption(void) {
    Process processes[2];

    processes[0] = process_create(1, 0, 5, 1);
    processes[1] = process_create(2, 2, 1, 2);

    Scheduler scheduler = {
        test_srtf_select,
        test_srtf_preempt,
        SCHEDULER_SRTF,
        0,
        "SRTF_TEST"
    };

    int result = simulation_run(
        processes, 2, scheduler
    );

    if (result != 0) {
        printf("FAIL: SRTF simulation returned an error\n");
        return 1;
    }

    if (
        processes[0].start_time != 0 ||
        processes[0].completion_time != 6 ||
        processes[0].remaining_time != 0
    ) {
        printf("FAIL: P1 state incorrect after preemption\n");
        return 1;
    }

    if (
        processes[1].start_time != 2 ||
        processes[1].completion_time != 3 ||
        processes[1].remaining_time != 0
    ) {
        printf("FAIL: P2 did not preempt P1 correctly\n");
        return 1;
    }

    printf("PASS: SRTF preemption test\n");
    return 0;
}

static int test_production_srtf(void) {
    Process processes[2];

    processes[0] = process_create(1, 0, 5, 1);
    processes[1] = process_create(2, 2, 1, 2);

    Scheduler scheduler = create_srtf_scheduler();

    int result = simulation_run(
        processes, 2, scheduler
    );

    if (result != 0) {
        printf("FAIL: Production SRTF returned an error\n");
        return 1;
    }

    if (
        processes[0].start_time != 0 ||
        processes[0].completion_time != 6 ||
        processes[0].remaining_time != 0
    ) {
        printf("FAIL: Production SRTF P1 state incorrect\n");
        return 1;
    }

    if (
        processes[1].start_time != 2 ||
        processes[1].completion_time != 3 ||
        processes[1].remaining_time != 0
    ) {
        printf("FAIL: Production SRTF P2 state incorrect\n");
        return 1;
    }

    printf("PASS: Production SRTF integration test\n");
    return 0;
}


static int test_remaining_time_exceeds_burst_time(void) {
    Process processes[1];

    processes[0] = process_create(1, 0, 5, 1);
    processes[0].remaining_time = 8;

    Scheduler scheduler = create_fcfs_scheduler();

    int result = simulation_run(processes, 1, scheduler);

    if (result != -1) {
        printf("FAIL: Remaining time exceeds burst time\n");
        return 1;
    }

    printf("PASS: Remaining time exceeds burst time\n");
    return 0;
}

static int test_rejects_old_process_state(void) {
    Scheduler scheduler = create_fcfs_scheduler();
    Process processes[1];

    processes[0] = process_create(1, 0, 5, 1);
    processes[0].start_time = 0;

    if (simulation_run(processes, 1, scheduler) != -1) {
        printf("FAIL: Accepted a process that already started\n");
        return 1;
    }

    processes[0] = process_create(1, 0, 5, 1);
    processes[0].completion_time = 5;

    if (simulation_run(processes, 1, scheduler) != -1) {
        printf("FAIL: Accepted a process already marked completed\n");
        return 1;
    }

    printf("PASS: Rejects old process state\n");
    return 0;
}

static int test_production_sjf(void) {
    Process processes[2];

    processes[0] = process_create(1, 0, 5, 1);
    processes[1] = process_create(2, 2, 1, 1);

    Scheduler scheduler = create_sjf_scheduler();

    int result = simulation_run(processes, 2, scheduler);

    if (result != 0 ||
        processes[0].completion_time != 5 ||
        processes[1].completion_time != 6 ||
        processes[0].remaining_time != 0 ||
        processes[1].remaining_time != 0) {
        printf("FAIL: Production SJF integration test\n");
        return 1;
    }

    printf("PASS: Production SJF integration test\n");
    return 0;
}

static int test_production_priority(void) {
    Process processes[3];

    processes[0] = process_create(1, 0, 5, 3);
    processes[1] = process_create(2, 0, 2, 1);
    processes[2] = process_create(3, 0, 3, 2);

    Scheduler scheduler = create_priority_scheduler();

    int result = simulation_run(processes, 3, scheduler);

    if (result != 0 ||
        processes[0].completion_time != 10 ||
        processes[1].completion_time != 2 ||
        processes[2].completion_time != 5 ||
        processes[0].remaining_time != 0 ||
        processes[1].remaining_time != 0 ||
        processes[2].remaining_time != 0) {
        printf("FAIL: Production Priority integration test\n");
        return 1;
    }

    printf("PASS: Production Priority integration test\n");
    return 0;
}

int main(void) {
    Process processes[3];

    processes[0] = process_create(1, 0, 3, 1);
    processes[1] = process_create(2, 1, 2, 2);
    processes[2] = process_create(3, 2, 1, 3);

    Scheduler scheduler = create_fcfs_scheduler();

    int result = simulation_run(
        processes,
        3,
        scheduler
    );

    if (result != 0) {
        printf("FAIL: Simulation returned an error\n");
        return 1;
    }

    if (
        processes[0].start_time != 0 ||
        processes[0].completion_time != 3 ||
        processes[0].remaining_time != 0
    ) {
        printf("FAIL: P1 state is incorrect\n");
        return 1;
    }

    if (
        processes[1].start_time != 3 ||
        processes[1].completion_time != 5 ||
        processes[1].remaining_time != 0
    ) {
        printf("FAIL: P2 state is incorrect\n");
        return 1;
    }

    if (
        processes[2].start_time != 5 ||
        processes[2].completion_time != 6 ||
        processes[2].remaining_time != 0
    ) {
        printf("FAIL: P3 state is incorrect\n");
        return 1;
    }

    if (test_cpu_idle_time() != 0) {
        return 1;
    }
    

    if (test_invalid_burst_time() != 0) {
        return 1;
    }

    if (test_invalid_input_preserves_state() != 0) {
        return 1;
    }

    if (test_srtf_preemption() != 0) {
        return 1;
    }

    if (test_production_srtf() != 0) {
        return 1;
    }

    if (test_remaining_time_exceeds_burst_time() != 0) {
        return 1;
    }

    if (test_rejects_old_process_state() != 0) {
        return 1;
    }

    if (test_production_sjf() != 0) {
        return 1;
    }

    if (test_production_priority() != 0) {
        return 1;
    }

    printf("PASS: All simulation tests\n");
    return 0;
}
