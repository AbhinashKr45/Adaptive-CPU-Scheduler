#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

static int case_insensitive_cmp(const char *s1, const char *s2) {
    while (*s1 && *s2) {
        int c1 = tolower((unsigned char)*s1);
        int c2 = tolower((unsigned char)*s2);
        if (c1 != c2) return c1 - c2;
        s1++;
        s2++;
    }
    return tolower((unsigned char)*s1) - tolower((unsigned char)*s2);
}
#include "src/core/simulation.h"
#include "src/schedulers/fcfs.h"
#include "src/schedulers/sjf.h"
#include "src/schedulers/srtf.h"
#include "src/schedulers/priority.h"
#include "src/schedulers/round_robin.h"

#define MAX_PROCESSES 10000

/* Simple lightweight JSON parser for process array */
static int parse_json_processes(const char *json_str, Process out_procs[], int max_count) {
    int count = 0;
    const char *p = json_str;

    while (*p && count < max_count) {
        /* Find start of object '{' */
        p = strchr(p, '{');
        if (!p) break;
        p++;

        int pid = -1;
        int arrival = 0;
        int burst = -1;
        int prio = 0;
        int found_pid = 0, found_burst = 0;

        while (*p && *p != '}') {
            /* Skip whitespace and quotes */
            while (*p && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n' || *p == ',' || *p == '\"')) p++;
            if (!*p || *p == '}') break;

            char key[64] = {0};
            int k_len = 0;
            while (*p && *p != '\"' && *p != ':' && k_len < 63) {
                key[k_len++] = *p++;
            }
            while (*p && (*p == '\"' || *p == ':' || *p == ' ')) p++;

            /* Parse number */
            int val = 0;
            int sign = 1;
            if (*p == '-') { sign = -1; p++; }
            while (*p >= '0' && *p <= '9') {
                val = val * 10 + (*p - '0');
                p++;
            }
            val *= sign;

            if (strcmp(key, "pid") == 0 || strcmp(key, "id") == 0) {
                pid = val;
                found_pid = 1;
            } else if (strcmp(key, "arrival_time") == 0 || strcmp(key, "arrival") == 0) {
                arrival = val;
            } else if (strcmp(key, "burst_time") == 0 || strcmp(key, "burst") == 0) {
                burst = val;
                found_burst = 1;
            } else if (strcmp(key, "priority") == 0) {
                prio = val;
            }

            while (*p && *p != ',' && *p != '}') p++;
            if (*p == ',') p++;
        }

        if (found_pid && found_burst) {
            out_procs[count++] = process_create(pid, arrival, burst, prio);
        }

        if (*p == '}') p++;
    }

    return count;
}

int main(int argc, char *argv[]) {
    const char *algo_name = "FCFS";
    int quantum = 2;
    const char *input_file = NULL;
    const char *observe_times_str = NULL;
    double starvation_mult = DEFAULT_STARVATION_MULTIPLIER;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--algorithm") == 0 && i + 1 < argc) {
            algo_name = argv[++i];
        } else if (strcmp(argv[i], "--quantum") == 0 && i + 1 < argc) {
            quantum = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--input") == 0 && i + 1 < argc) {
            input_file = argv[++i];
        } else if (strcmp(argv[i], "--observe-times") == 0 && i + 1 < argc) {
            observe_times_str = argv[++i];
        } else if (strcmp(argv[i], "--starvation-mult") == 0 && i + 1 < argc) {
            starvation_mult = atof(argv[++i]);
        } else if (strcmp(argv[i], "--help") == 0) {
            printf("Usage: %s [--algorithm FCFS|SJF|SRTF|PRIORITY|RR] [--quantum Q] [--input FILE] [--observe-times T1,T2,...] [--starvation-mult M]\n", argv[0]);
            return 0;
        }
    }

    /* Read JSON payload from file or stdin */
    char *buffer = NULL;

    if (input_file) {
        FILE *f = fopen(input_file, "rb");
        if (!f) {
            fprintf(stderr, "{\"status\":\"error\",\"message\":\"Could not open input file\"}\n");
            return 1;
        }
        fseek(f, 0, SEEK_END);
        long sz = ftell(f);
        fseek(f, 0, SEEK_SET);
        buffer = malloc(sz + 1);
        if (!buffer) { fclose(f); return 1; }
        fread(buffer, 1, sz, f);
        buffer[sz] = '\0';
        fclose(f);
    } else {
        /* Read from stdin */
        size_t capacity = 65536;
        buffer = malloc(capacity);
        if (!buffer) return 1;
        size_t bytes_read = 0;
        int c;
        while ((c = getchar()) != EOF) {
            if (bytes_read + 2 >= capacity) {
                capacity *= 2;
                char *new_buf = realloc(buffer, capacity);
                if (!new_buf) { free(buffer); return 1; }
                buffer = new_buf;
            }
            buffer[bytes_read++] = (char)c;
        }
        buffer[bytes_read] = '\0';
    }

    if (!buffer || strlen(buffer) == 0) {
        fprintf(stderr, "{\"status\":\"error\",\"message\":\"Empty input payload\"}\n");
        free(buffer);
        return 1;
    }

    Process procs[MAX_PROCESSES];
    int count = parse_json_processes(buffer, procs, MAX_PROCESSES);
    free(buffer);

    if (count <= 0) {
        fprintf(stderr, "{\"status\":\"error\",\"message\":\"No valid processes found in input JSON\"}\n");
        return 1;
    }

    /* Validate duplicate PIDs or invalid times */
    if (processes_validate(procs, count) != 0) {
        fprintf(stderr, "{\"status\":\"error\",\"message\":\"Workload validation failed: duplicate PID or invalid arrival/burst time\"}\n");
        return 1;
    }

    Scheduler scheduler;
    if (case_insensitive_cmp(algo_name, "FCFS") == 0) {
        scheduler = create_fcfs_scheduler();
    } else if (case_insensitive_cmp(algo_name, "SJF") == 0) {
        scheduler = create_sjf_scheduler();
    } else if (case_insensitive_cmp(algo_name, "SRTF") == 0) {
        scheduler = create_srtf_scheduler();
    } else if (case_insensitive_cmp(algo_name, "PRIORITY") == 0) {
        scheduler = create_priority_scheduler();
    } else if (case_insensitive_cmp(algo_name, "RR") == 0 || case_insensitive_cmp(algo_name, "ROUND_ROBIN") == 0 || case_insensitive_cmp(algo_name, "ROUND ROBIN") == 0) {
        if (quantum <= 0) {
            fprintf(stderr, "{\"status\":\"error\",\"message\":\"Round Robin quantum must be positive\"}\n");
            return 1;
        }
        scheduler = create_round_robin_scheduler(quantum);
    } else {
        fprintf(stderr, "{\"status\":\"error\",\"message\":\"Unknown scheduling algorithm\"}\n");
        return 1;
    }

    SimulationResult res;
    int status = simulation_run_detailed(procs, count, scheduler, &res);
    if (status != 0) {
        fprintf(stderr, "{\"status\":\"error\",\"message\":\"Simulation execution failed\"}\n");
        return 1;
    }

    if (starvation_mult > 0.0) {
        res.metrics.starvation_count = metrics_calculate_starvation_count(
            res.processes, res.process_count, res.metrics.avg_waiting_time, starvation_mult
        );
    }

    /* Output JSON */
    printf("{\n");
    printf("  \"status\": \"success\",\n");
    printf("  \"algorithm\": \"%s\",\n", scheduler.name ? scheduler.name : algo_name);
    printf("  \"quantum\": %d,\n", (scheduler.type == SCHEDULER_ROUND_ROBIN) ? scheduler.time_quantum : 0);
    printf("  \"metrics\": {\n");
    printf("    \"avg_waiting_time\": %.4f,\n", res.metrics.avg_waiting_time);
    printf("    \"median_waiting_time\": %.4f,\n", res.metrics.median_waiting_time);
    printf("    \"max_waiting_time\": %d,\n", res.metrics.max_waiting_time);
    printf("    \"p95_waiting_time\": %.4f,\n", res.metrics.p95_waiting_time);
    printf("    \"waiting_time_std\": %.4f,\n", res.metrics.waiting_time_std);
    printf("    \"avg_turnaround_time\": %.4f,\n", res.metrics.avg_turnaround_time);
    printf("    \"median_turnaround_time\": %.4f,\n", res.metrics.median_turnaround_time);
    printf("    \"avg_response_time\": %.4f,\n", res.metrics.avg_response_time);
    printf("    \"median_response_time\": %.4f,\n", res.metrics.median_response_time);
    printf("    \"max_response_time\": %d,\n", res.metrics.max_response_time);
    printf("    \"throughput\": %.6f,\n", res.metrics.throughput);
    printf("    \"cpu_utilization\": %.6f,\n", res.metrics.cpu_utilization);
    printf("    \"total_busy_time\": %d,\n", res.metrics.total_busy_time);
    printf("    \"total_idle_time\": %d,\n", res.metrics.total_idle_time);
    printf("    \"makespan\": %d,\n", res.metrics.makespan);
    printf("    \"context_switches\": %d,\n", res.metrics.context_switches);
    printf("    \"preemptions\": %d,\n", res.metrics.preemptions);
    printf("    \"starvation_ratio\": %.4f,\n", res.metrics.starvation_ratio);
    printf("    \"starvation_count\": %d,\n", res.metrics.starvation_count);
    printf("    \"waiting_time_gini\": %.6f,\n", res.metrics.waiting_time_gini);
    printf("    \"jain_fairness_cpu\": %.6f,\n", res.metrics.jain_fairness_cpu);
    printf("    \"jain_fairness_progress\": %.6f,\n", res.metrics.jain_fairness_progress);
    printf("    \"is_cpu_fairness_defined\": %s,\n", res.metrics.is_cpu_fairness_defined ? "true" : "false");
    printf("    \"is_progress_fairness_defined\": %s\n", res.metrics.is_progress_fairness_defined ? "true" : "false");
    printf("  },\n");

    /* Processes array */
    printf("  \"processes\": [\n");
    for (int i = 0; i < res.process_count; i++) {
        Process *p = &res.processes[i];
        printf("    {\"pid\": %d, \"arrival_time\": %d, \"burst_time\": %d, \"priority\": %d, \"start_time\": %d, \"completion_time\": %d, \"waiting_time\": %d, \"response_time\": %d, \"turnaround_time\": %d, \"executed_time\": %d}%s\n",
               p->pid, p->arrival_time, p->burst_time, p->priority,
               p->start_time, p->completion_time, p->waiting_time,
               p->response_time, p->turnaround_time, p->executed_time,
               (i + 1 < res.process_count) ? "," : "");
    }
    printf("  ],\n");

    /* Trace intervals */
    printf("  \"trace\": [\n");
    for (int i = 0; i < res.trace_count; i++) {
        TraceInterval *ti = &res.trace[i];
        printf("    {\"pid\": %d, \"start_time\": %d, \"end_time\": %d, \"is_idle\": %s}%s\n",
               ti->pid, ti->start_time, ti->end_time,
               ti->is_idle ? "true" : "false",
               (i + 1 < res.trace_count) ? "," : "");
    }
    printf("  ],\n");

    /* Observation-time fairness */
    int observe_times[64];
    int observe_count = 0;

    if (observe_times_str != NULL && strlen(observe_times_str) > 0) {
        char *str_copy = malloc(strlen(observe_times_str) + 1);
        if (str_copy) {
            strcpy(str_copy, observe_times_str);
            char *tok = strtok(str_copy, ",");
            while (tok && observe_count < 64) {
                int t = atoi(tok);
                if (t >= 0) {
                    observe_times[observe_count++] = t;
                }
                tok = strtok(NULL, ",");
            }
            free(str_copy);
        }
    } else if (res.metrics.makespan > 0) {
        /* Default quartile observation points */
        int ms = res.metrics.makespan;
        int t1 = ms / 4;
        int t2 = ms / 2;
        int t3 = (ms * 3) / 4;
        int t4 = ms;
        if (t1 > 0) observe_times[observe_count++] = t1;
        if (t2 > t1) observe_times[observe_count++] = t2;
        if (t3 > t2) observe_times[observe_count++] = t3;
        if (t4 > t3) observe_times[observe_count++] = t4;
    }

    printf("  \"observation_fairness\": [\n");
    for (int i = 0; i < observe_count; i++) {
        ObservationTimeFairness otf;
        simulation_compute_fairness_at_time(&res, observe_times[i], &otf);
        printf("    {\"observation_time\": %d, \"jain_fairness_cpu\": %.6f, \"jain_fairness_progress\": %.6f, \"is_cpu_defined\": %s, \"is_progress_defined\": %s, \"processes_arrived\": %d, \"processes_completed\": %d}%s\n",
               otf.observation_time, otf.jain_fairness_cpu, otf.jain_fairness_progress,
               otf.is_cpu_defined ? "true" : "false",
               otf.is_progress_defined ? "true" : "false",
               otf.processes_arrived, otf.processes_completed,
               (i + 1 < observe_count) ? "," : "");
    }
    printf("  ]\n");
    printf("}\n");

    simulation_result_free(&res);
    return 0;
}
