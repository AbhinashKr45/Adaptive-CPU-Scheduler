#include <stdio.h>
#include <math.h>
#include <assert.h>
#include "../src/core/metrics.h"
#include "../src/core/simulation.h"
#include "../src/schedulers/fcfs.h"

static int test_jains_index_hand_worked(void) {
    int is_def = 0;

    /* Equal values -> 1.0 */
    double equal_vals[] = {10.0, 10.0, 10.0, 10.0};
    double j_eq = metrics_calculate_jains_index(equal_vals, 4, &is_def);
    if (!is_def || fabs(j_eq - 1.0) > 1e-6) {
        printf("FAIL: Jain's equal values expected 1.0, got %f\n", j_eq);
        return 1;
    }

    /* Hand-worked example 2: [2, 4, 6, 8] -> 5/6 = 0.833333 */
    double unequal_vals[] = {2.0, 4.0, 6.0, 8.0};
    double j_uneq = metrics_calculate_jains_index(unequal_vals, 4, &is_def);
    double expected_uneq = 5.0 / 6.0;
    if (!is_def || fabs(j_uneq - expected_uneq) > 1e-5) {
        printf("FAIL: Jain's unequal expected %f, got %f\n", expected_uneq, j_uneq);
        return 1;
    }

    /* Extreme disparity: [10, 0] -> 0.5 */
    double extreme_vals[] = {10.0, 0.0};
    double j_ext = metrics_calculate_jains_index(extreme_vals, 2, &is_def);
    if (!is_def || fabs(j_ext - 0.5) > 1e-6) {
        printf("FAIL: Jain's extreme expected 0.5, got %f\n", j_ext);
        return 1;
    }

    /* Zero vector -> undefined */
    double zero_vals[] = {0.0, 0.0, 0.0};
    double j_zero = metrics_calculate_jains_index(zero_vals, 3, &is_def);
    if (is_def != 0) {
        printf("FAIL: Jain's zero values should be undefined\n");
        return 1;
    }
    (void)j_zero;

    printf("PASS: Jain's index hand-worked validation test\n");
    return 0;
}

static int test_demand_relative_progress_fairness(void) {
    /* Process 1: demand 2, completed (service 2) -> progress = 1.0
       Process 2: demand 10, partial (service 5)  -> progress = 0.5
       J(F) = 2.25 / 2.50 = 0.90
    */
    int is_def = 0;
    double progress_vals[] = {1.0, 0.5};
    double j_prog = metrics_calculate_jains_index(progress_vals, 2, &is_def);
    if (!is_def || fabs(j_prog - 0.90) > 1e-6) {
        printf("FAIL: Demand progress fairness expected 0.90, got %f\n", j_prog);
        return 1;
    }

    /* When all processes complete, progress is 1.0 for all, so J(F) is 1.0 */
    double all_completed[] = {1.0, 1.0, 1.0, 1.0, 1.0};
    double j_all = metrics_calculate_jains_index(all_completed, 5, &is_def);
    if (!is_def || fabs(j_all - 1.0) > 1e-6) {
        printf("FAIL: Fully completed progress fairness expected 1.0, got %f\n", j_all);
        return 1;
    }

    printf("PASS: Demand-relative progress fairness test\n");
    return 0;
}

static int test_process_metrics_definitions(void) {
    /* Arrival 2, Burst 5, Start 4, Completion 9:
       Turnaround = 9 - 2 = 7
       Response = 4 - 2 = 2
       Waiting = 7 - 5 = 2
       Executed = 5
    */
    Process p = process_create(1, 2, 5, 1);
    p.start_time = 4;
    p.completion_time = 9;
    p.remaining_time = 0;

    metrics_calculate_process(&p);

    if (p.turnaround_time != 7 || p.response_time != 2 || p.waiting_time != 2 || p.executed_time != 5) {
        printf("FAIL: Process metrics calculation error: TAT=%d, Resp=%d, Wait=%d, Exec=%d\n",
               p.turnaround_time, p.response_time, p.waiting_time, p.executed_time);
        return 1;
    }

    printf("PASS: Per-process metrics definitions test\n");
    return 0;
}

static int test_aggregate_metrics_conservation(void) {
    /* Total busy time must equal sum of bursts for fully completed workload */
    Process procs[3];
    procs[0] = process_create(1, 0, 4, 1);
    procs[1] = process_create(2, 1, 3, 1);
    procs[2] = process_create(3, 3, 5, 1);

    Scheduler fcfs = create_fcfs_scheduler();
    SimulationResult res;

    int status = simulation_run_detailed(procs, 3, fcfs, &res);
    if (status != 0) {
        printf("FAIL: Simulation returned error\n");
        return 1;
    }

    int total_burst = 4 + 3 + 5;
    if (res.metrics.total_busy_time != total_burst) {
        printf("FAIL: Busy time %d != sum of bursts %d\n", res.metrics.total_busy_time, total_burst);
        simulation_result_free(&res);
        return 1;
    }

    if (res.metrics.total_busy_time + res.metrics.total_idle_time != res.metrics.makespan) {
        printf("FAIL: Busy (%d) + Idle (%d) != Makespan (%d)\n",
               res.metrics.total_busy_time, res.metrics.total_idle_time, res.metrics.makespan);
        simulation_result_free(&res);
        return 1;
    }

    simulation_result_free(&res);
    printf("PASS: Conservation of CPU service and makespan test\n");
    return 0;
}

static int test_observation_time_fairness(void) {
    /* P1: arr=0, burst=10
       P2: arr=0, burst=10
       Under FCFS, P1 executes [0, 10), P2 executes [10, 20).
       At T=5: P1 service = 5, P2 service = 0.
       CPU fairness = (5)^2 / (2 * 25) = 0.5
       Progress fairness = (0.5)^2 / (2 * 0.25) = 0.5
       At T=20: P1 service = 10, P2 service = 10.
       CPU fairness = (20)^2 / (2 * 200) = 1.0
       Progress fairness = (2)^2 / (2 * 2) = 1.0
    */
    Process procs[2];
    procs[0] = process_create(1, 0, 10, 1);
    procs[1] = process_create(2, 0, 10, 1);

    Scheduler fcfs = create_fcfs_scheduler();
    SimulationResult res;
    int status = simulation_run_detailed(procs, 2, fcfs, &res);
    if (status != 0) {
        printf("FAIL: Simulation detailed failed\n");
        return 1;
    }

    ObservationTimeFairness fair_t5;
    if (simulation_compute_fairness_at_time(&res, 5, &fair_t5) != 0) {
        printf("FAIL: compute fairness at T=5 failed\n");
        simulation_result_free(&res);
        return 1;
    }
    if (!fair_t5.is_cpu_defined || fabs(fair_t5.jain_fairness_cpu - 0.5) > 1e-5) {
        printf("FAIL: T=5 CPU fairness expected 0.5, got %f\n", fair_t5.jain_fairness_cpu);
        simulation_result_free(&res);
        return 1;
    }
    if (!fair_t5.is_progress_defined || fabs(fair_t5.jain_fairness_progress - 0.5) > 1e-5) {
        printf("FAIL: T=5 progress fairness expected 0.5, got %f\n", fair_t5.jain_fairness_progress);
        simulation_result_free(&res);
        return 1;
    }
    if (fair_t5.processes_arrived != 2 || fair_t5.processes_completed != 0) {
        printf("FAIL: T=5 arrived/completed count mismatch\n");
        simulation_result_free(&res);
        return 1;
    }

    ObservationTimeFairness fair_t20;
    if (simulation_compute_fairness_at_time(&res, 20, &fair_t20) != 0) {
        printf("FAIL: compute fairness at T=20 failed\n");
        simulation_result_free(&res);
        return 1;
    }
    if (!fair_t20.is_cpu_defined || fabs(fair_t20.jain_fairness_cpu - 1.0) > 1e-5) {
        printf("FAIL: T=20 CPU fairness expected 1.0, got %f\n", fair_t20.jain_fairness_cpu);
        simulation_result_free(&res);
        return 1;
    }
    if (!fair_t20.is_progress_defined || fabs(fair_t20.jain_fairness_progress - 1.0) > 1e-5) {
        printf("FAIL: T=20 progress fairness expected 1.0, got %f\n", fair_t20.jain_fairness_progress);
        simulation_result_free(&res);
        return 1;
    }
    if (fair_t20.processes_arrived != 2 || fair_t20.processes_completed != 2) {
        printf("FAIL: T=20 arrived/completed count mismatch\n");
        simulation_result_free(&res);
        return 1;
    }

    simulation_result_free(&res);
    printf("PASS: Observation-time trace fairness test\n");
    return 0;
}

static int test_fairness_and_starvation_metrics_hand_worked(void) {
    /* Hand-worked example with 3 processes under FCFS:
       P1: arrival=0, burst=4 -> start=0, completion=4, wait=0, response=0
       P2: arrival=0, burst=4 -> start=4, completion=8, wait=4, response=4
       P3: arrival=0, burst=4 -> start=8, completion=12, wait=8, response=8

       Waiting times: w = [0, 4, 8]
       Mean waiting time = (0 + 4 + 8) / 3 = 12 / 3 = 4.0
       Median waiting time = 4.0
       Max waiting time = 8
       Max response time = 8

       Waiting time std (population standard deviation):
       mean = 4.0
       sum_sq_diff = (0-4)^2 + (4-4)^2 + (8-4)^2 = 16 + 0 + 16 = 32
       variance = 32 / 3 = 10.666667
       std = sqrt(32/3) approx 3.265986

       p95 waiting time (linear interpolation, rank = (3-1) * 0.95 = 1.90):
       lower = 1, fraction = 0.90
       p95 = w[1] + 0.90 * (w[2] - w[1]) = 4 + 0.90 * (8 - 4) = 4 + 3.6 = 7.60

       Waiting time Gini coefficient:
       Sorted w = [0, 4, 8], n = 3, sum = 12
       Pairwise diff sum = |0-0| + |0-4| + |0-8| + |4-0| + |4-4| + |4-8| + |8-0| + |8-4| + |8-8|
                         = 0 + 4 + 8 + 4 + 0 + 4 + 8 + 4 + 0 = 32
       Denominator = 2 * n * sum = 2 * 3 * 12 = 72
       Gini = 32 / 72 = 4 / 9 approx 0.444444

       Starvation count (default 3x mean = 3 * 4.0 = 12.0):
       None of [0, 4, 8] exceed 12.0, so starvation_count = 0.
    */
    Process procs[3];
    procs[0] = process_create(1, 0, 4, 1);
    procs[1] = process_create(2, 0, 4, 1);
    procs[2] = process_create(3, 0, 4, 1);

    Scheduler fcfs = create_fcfs_scheduler();
    SimulationResult res;
    int status = simulation_run_detailed(procs, 3, fcfs, &res);
    if (status != 0) {
        printf("FAIL: Simulation failed in hand-worked test\n");
        return 1;
    }

    if (fabs(res.metrics.avg_waiting_time - 4.0) > 1e-5) {
        printf("FAIL: Avg wait expected 4.0, got %f\n", res.metrics.avg_waiting_time);
        simulation_result_free(&res);
        return 1;
    }
    if (res.metrics.max_waiting_time != 8) {
        printf("FAIL: Max wait expected 8, got %d\n", res.metrics.max_waiting_time);
        simulation_result_free(&res);
        return 1;
    }
    if (res.metrics.max_response_time != 8) {
        printf("FAIL: Max response expected 8, got %d\n", res.metrics.max_response_time);
        simulation_result_free(&res);
        return 1;
    }
    double expected_std = sqrt(32.0 / 3.0);
    if (fabs(res.metrics.waiting_time_std - expected_std) > 1e-5) {
        printf("FAIL: Waiting time std expected %f, got %f\n", expected_std, res.metrics.waiting_time_std);
        simulation_result_free(&res);
        return 1;
    }
    if (fabs(res.metrics.p95_waiting_time - 7.6) > 1e-5) {
        printf("FAIL: p95 wait expected 7.6, got %f\n", res.metrics.p95_waiting_time);
        simulation_result_free(&res);
        return 1;
    }
    double expected_gini = 4.0 / 9.0;
    if (fabs(res.metrics.waiting_time_gini - expected_gini) > 1e-5) {
        printf("FAIL: Gini expected %f, got %f\n", expected_gini, res.metrics.waiting_time_gini);
        simulation_result_free(&res);
        return 1;
    }
    if (res.metrics.starvation_count != 0) {
        printf("FAIL: Starvation count expected 0, got %d\n", res.metrics.starvation_count);
        simulation_result_free(&res);
        return 1;
    }
    simulation_result_free(&res);

    /* Second hand-worked case: test starvation count with a skewed workload.
       5 processes with waiting times: [1, 1, 1, 1, 20]
       Mean waiting time = 24 / 5 = 4.8
       Starvation threshold (3x) = 14.4
       Process with wait=20 exceeds 14.4 -> starvation_count should be 1.
    */
    Process procs_starve[5];
    for (int i = 0; i < 5; i++) {
        procs_starve[i] = process_create(i + 1, 0, 1, 1);
    }
    procs_starve[0].waiting_time = 1;
    procs_starve[1].waiting_time = 1;
    procs_starve[2].waiting_time = 1;
    procs_starve[3].waiting_time = 1;
    procs_starve[4].waiting_time = 20;

    int starve_count = metrics_calculate_starvation_count(procs_starve, 5, 4.8, 3.0);
    if (starve_count != 1) {
        printf("FAIL: Expected starvation count 1, got %d\n", starve_count);
        return 1;
    }

    printf("PASS: Hand-worked Gini, p95, std, and starvation metrics test\n");
    return 0;
}

int main(void) {
    if (test_jains_index_hand_worked() != 0) return 1;
    if (test_demand_relative_progress_fairness() != 0) return 1;
    if (test_process_metrics_definitions() != 0) return 1;
    if (test_aggregate_metrics_conservation() != 0) return 1;
    if (test_observation_time_fairness() != 0) return 1;
    if (test_fairness_and_starvation_metrics_hand_worked() != 0) return 1;

    printf("\nPASS: All metrics and fairness tests\n");
    return 0;
}
