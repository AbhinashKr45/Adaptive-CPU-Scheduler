#include <stdio.h>
#include <assert.h>
#include "../src/core/simulation.h"
#include "../src/schedulers/round_robin.h"

static int test_rr_basic_time_slicing(void) {
    /* Two processes with burst 5 each, quantum 2, arrive at 0 */
    Process procs[2];
    procs[0] = process_create(1, 0, 5, 1);
    procs[1] = process_create(2, 0, 5, 1);

    Scheduler rr = create_round_robin_scheduler(2);
    SimulationResult res;

    int status = simulation_run_detailed(procs, 2, rr, &res);
    if (status != 0) {
        printf("FAIL: Round Robin simulation returned non-zero\n");
        return 1;
    }

    /* P1 runs [0,2], P2 runs [2,4], P1 runs [4,6], P2 runs [6,8], P1 runs [8,9], P2 runs [9,10] */
    if (res.metrics.makespan != 10) {
        printf("FAIL: RR makespan expected 10, got %d\n", res.metrics.makespan);
        simulation_result_free(&res);
        return 1;
    }

    if (res.processes[0].start_time != 0 || res.processes[0].completion_time != 9) {
        printf("FAIL: RR P1 timing incorrect (start: %d, comp: %d)\n",
               res.processes[0].start_time, res.processes[0].completion_time);
        simulation_result_free(&res);
        return 1;
    }

    if (res.processes[1].start_time != 2 || res.processes[1].completion_time != 10) {
        printf("FAIL: RR P2 timing incorrect (start: %d, comp: %d)\n",
               res.processes[1].start_time, res.processes[1].completion_time);
        simulation_result_free(&res);
        return 1;
    }

    /* P1 waiting time = TAT(9) - burst(5) = 4 */
    /* P2 waiting time = TAT(10) - burst(5) = 5 */
    if (res.processes[0].waiting_time != 4 || res.processes[1].waiting_time != 5) {
        printf("FAIL: RR waiting times incorrect (P1: %d, P2: %d)\n",
               res.processes[0].waiting_time, res.processes[1].waiting_time);
        simulation_result_free(&res);
        return 1;
    }

    /* Preemptions: P1 at t=2, P2 at t=4, P1 at t=6, P2 at t=8 -> 4 preemptions */
    if (res.metrics.preemptions != 4) {
        printf("FAIL: Expected 4 preemptions, got %d\n", res.metrics.preemptions);
        simulation_result_free(&res);
        return 1;
    }

    simulation_result_free(&res);
    printf("PASS: Round Robin basic time-slicing test\n");
    return 0;
}

static int test_rr_boundary_completion(void) {
    /* P1 completes exactly at quantum boundary (quantum = 3, burst = 3) */
    Process procs[2];
    procs[0] = process_create(1, 0, 3, 1);
    procs[1] = process_create(2, 0, 4, 1);

    Scheduler rr = create_round_robin_scheduler(3);
    SimulationResult res;

    int status = simulation_run_detailed(procs, 2, rr, &res);
    if (status != 0) {
        printf("FAIL: RR boundary simulation failed\n");
        return 1;
    }

    /* P1 finishes at t=3 without preemption; P2 runs [3,6], preempts, then [6,7] */
    if (res.processes[0].completion_time != 3) {
        printf("FAIL: P1 completion time expected 3, got %d\n", res.processes[0].completion_time);
        simulation_result_free(&res);
        return 1;
    }
    if (res.processes[1].completion_time != 7) {
        printf("FAIL: P2 completion time expected 7, got %d\n", res.processes[1].completion_time);
        simulation_result_free(&res);
        return 1;
    }

    /* P1 completed at boundary: not preempted. P2 ran 3 of 4: 1 preemption. */
    if (res.metrics.preemptions != 1) {
        printf("FAIL: Expected 1 preemption for boundary test, got %d\n", res.metrics.preemptions);
        simulation_result_free(&res);
        return 1;
    }

    simulation_result_free(&res);
    printf("PASS: Round Robin quantum boundary completion test\n");
    return 0;
}

static int test_rr_arrivals_during_quantum(void) {
    /* P1 arrives at 0, burst 6.
       P2 arrives at 2, burst 2.
       Quantum = 4.
       At t=0: P1 runs.
       At t=2: P2 arrives into ready queue.
       At t=4: P1 has 2 remaining. P1 is preempted. P2 is head of queue.
       P2 runs [4, 6] and finishes.
       P1 runs [6, 8] and finishes.
    */
    Process procs[2];
    procs[0] = process_create(1, 0, 6, 1);
    procs[1] = process_create(2, 2, 2, 1);

    Scheduler rr = create_round_robin_scheduler(4);
    SimulationResult res;

    int status = simulation_run_detailed(procs, 2, rr, &res);
    if (status != 0) {
        printf("FAIL: RR arrival during quantum failed\n");
        return 1;
    }

    if (res.processes[1].start_time != 4 || res.processes[1].completion_time != 6) {
        printf("FAIL: P2 timing incorrect (start: %d, comp: %d)\n",
               res.processes[1].start_time, res.processes[1].completion_time);
        simulation_result_free(&res);
        return 1;
    }

    if (res.processes[0].completion_time != 8) {
        printf("FAIL: P1 completion time expected 8, got %d\n", res.processes[0].completion_time);
        simulation_result_free(&res);
        return 1;
    }

    simulation_result_free(&res);
    printf("PASS: Round Robin arrivals during quantum test\n");
    return 0;
}

int main(void) {
    if (test_rr_basic_time_slicing() != 0) return 1;
    if (test_rr_boundary_completion() != 0) return 1;
    if (test_rr_arrivals_during_quantum() != 0) return 1;

    printf("\nPASS: All Round Robin tests\n");
    return 0;
}
