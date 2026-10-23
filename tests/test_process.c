
#include <stdio.h>
#include "../src/core/process.h"

int main(void) {
    Process p1 = process_create(1, 0, 8, 3);

    if (p1.pid != 1 ||
        p1.arrival_time != 0 ||
        p1.burst_time != 8 ||
        p1.remaining_time != 8 ||
        p1.priority != 3 ||
        p1.start_time != -1 ||
        p1.completion_time != -1) {

        printf("FAIL: Process initialization test\n");
        return 1;
    }

    printf("PASS: Process initialization test\n");
    return 0;
}
