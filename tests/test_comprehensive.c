#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include "../src/core/simulation.h"
#include "../src/schedulers/fcfs.h"
#include "../src/schedulers/sjf.h"
#include "../src/schedulers/srtf.h"
#include "../src/schedulers/priority.h"
#include "../src/schedulers/round_robin.h"

static int test_all_five_algorithms_on_identical_workload(void) {
    /* 4 processes */
    Process base[4];
    base[0] = process_create(1, 0, 8, 3);
    base[1] = process_create(2, 1, 4, 1);
    base[2] = process_create(3, 2, 9, 4);
    base[3] = process_create(4, 3, 5, 2);

    Scheduler schedulers[5];
    schedulers[0] = create_fcfs_scheduler();
    schedulers[1] = create_sjf_scheduler();
    schedulers[2] = create_srtf_scheduler();
    schedulers[3] = create_priority_scheduler();
    schedulers[4] = create_round_robin_scheduler(2);

    for (int s = 0; s < 5; s++) {
        SimulationResult res;
        int status = simulation_run_detailed(base, 4, schedulers[s], &res);
        if (status != 0) {
            printf("FAIL: Algorithm %s failed simulation\n", schedulers[s].name);
            return 1;
        }

        /* Check conservation of service */
        int total_burst = 8 + 4 + 9 + 5; /* 26 */
        if (res.metrics.total_busy_time != total_burst) {
            printf("FAIL: Algorithm %s busy time mismatch\n", schedulers[s].name);
            simulation_result_free(&res);
            return 1;
        }

        /* Check trace integrity */
        int last_time = 0;
        for (int i = 0; i < res.trace_count; i++) {
            if (res.trace[i].start_time != last_time) {
                printf("FAIL: Algorithm %s trace gap at interval %d\n", schedulers[s].name, i);
                simulation_result_free(&res);
                return 1;
            }
            if (res.trace[i].end_time <= res.trace[i].start_time) {
                printf("FAIL: Algorithm %s non-positive interval duration\n", schedulers[s].name);
                simulation_result_free(&res);
                return 1;
            }
            last_time = res.trace[i].end_time;
        }
        if (last_time != res.metrics.makespan) {
            printf("FAIL: Algorithm %s trace end != makespan\n", schedulers[s].name);
            simulation_result_free(&res);
            return 1;
        }

        /* Check all processes completed */
        for (int p = 0; p < 4; p++) {
            if (res.processes[p].remaining_time != 0 || res.processes[p].completion_time < 0) {
                printf("FAIL: Algorithm %s process %d not properly completed\n", schedulers[s].name, p + 1);
                simulation_result_free(&res);
                return 1;
            }
        }

        simulation_result_free(&res);
    }

    printf("PASS: All 5 algorithms ran cleanly on identical workload with trace integrity\n");
    return 0;
}

static int test_simultaneous_arrivals_deterministic_tiebreak(void) {
    /* 3 processes arriving simultaneously at t=0 with identical bursts */
    Process procs[3];
    procs[0] = process_create(10, 0, 4, 2);
    procs[1] = process_create(2,  0, 4, 2);
    procs[2] = process_create(5,  0, 4, 2);

    Scheduler fcfs = create_fcfs_scheduler();
    SimulationResult res;
    int status = simulation_run_detailed(procs, 3, fcfs, &res);
    if (status != 0) return 1;

    /* Should run in PID order: 2, 5, 10 */
    if (res.processes[1].pid != 2 || res.processes[1].start_time != 0) {
        printf("FAIL: PID 2 should have started first at t=0\n");
        simulation_result_free(&res);
        return 1;
    }
    if (res.processes[2].pid != 5 || res.processes[2].start_time != 4) {
        printf("FAIL: PID 5 should have started second at t=4\n");
        simulation_result_free(&res);
        return 1;
    }
    if (res.processes[0].pid != 10 || res.processes[0].start_time != 8) {
        printf("FAIL: PID 10 should have started third at t=8\n");
        simulation_result_free(&res);
        return 1;
    }

    simulation_result_free(&res);
    printf("PASS: Simultaneous arrivals deterministic tie-break test\n");
    return 0;
}

static int test_input_validation_rejections(void) {
    Scheduler fcfs = create_fcfs_scheduler();

    /* Duplicate PIDs */
    Process dups[2];
    dups[0] = process_create(1, 0, 5, 1);
    dups[1] = process_create(1, 2, 3, 1);
    if (simulation_run_detailed(dups, 2, fcfs, NULL) != -1) {
        printf("FAIL: Duplicate PIDs were not rejected\n");
        return 1;
    }

    /* Negative arrival time */
    Process neg_arr[1];
    neg_arr[0] = process_create(1, -5, 5, 1);
    if (simulation_run_detailed(neg_arr, 1, fcfs, NULL) != -1) {
        printf("FAIL: Negative arrival time was not rejected\n");
        return 1;
    }

    /* Zero burst */
    Process zero_b[1];
    zero_b[0] = process_create(1, 0, 0, 1);
    if (simulation_run_detailed(zero_b, 1, fcfs, NULL) != -1) {
        printf("FAIL: Zero burst time was not rejected\n");
        return 1;
    }

    /* Negative burst */
    Process neg_b[1];
    neg_b[0] = process_create(1, 0, -2, 1);
    if (simulation_run_detailed(neg_b, 1, fcfs, NULL) != -1) {
        printf("FAIL: Negative burst time was not rejected\n");
        return 1;
    }

    /* Round Robin invalid quantum */
    Process valid_proc[1];
    valid_proc[0] = process_create(1, 0, 5, 1);
    Scheduler rr_bad = create_round_robin_scheduler(0);
    rr_bad.time_quantum = 0;
    if (simulation_run_detailed(valid_proc, 1, rr_bad, NULL) != -1) {
        printf("FAIL: RR quantum <= 0 was not rejected\n");
        return 1;
    }

    printf("PASS: Input validation rejection tests\n");
    return 0;
}

static int test_larger_workload(void) {
    /* 50 processes */
    int count = 50;
    Process *procs = malloc(sizeof(Process) * count);
    for (int i = 0; i < count; i++) {
        procs[i] = process_create(i + 1, i * 2, (i % 7) + 3, (i % 5) + 1);
    }

    Scheduler srtf = create_srtf_scheduler();
    SimulationResult res;
    int status = simulation_run_detailed(procs, count, srtf, &res);
    if (status != 0) {
        printf("FAIL: Large workload simulation returned error\n");
        free(procs);
        return 1;
    }

    if (res.process_count != count) {
        printf("FAIL: Large workload process count mismatch\n");
        simulation_result_free(&res);
        free(procs);
        return 1;
    }

    simulation_result_free(&res);
    free(procs);
    printf("PASS: Large workload (50 processes) test\n");
    return 0;
}

int main(void) {
    if (test_all_five_algorithms_on_identical_workload() != 0) return 1;
    if (test_simultaneous_arrivals_deterministic_tiebreak() != 0) return 1;
    if (test_input_validation_rejections() != 0) return 1;
    if (test_larger_workload() != 0) return 1;

    printf("\nPASS: All comprehensive tests passed!\n");
    return 0;
}
