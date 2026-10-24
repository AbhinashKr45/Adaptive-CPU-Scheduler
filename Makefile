CC ?= gcc
CFLAGS = -Wall -Wextra -Wpedantic -std=c99 -Isrc
LDFLAGS ?= -lm

CORE_SRCS = src/core/process.c src/core/metrics.c src/core/simulation.c
SCHED_SRCS = src/schedulers/fcfs.c src/schedulers/sjf.c src/schedulers/srtf.c src/schedulers/priority.c src/schedulers/round_robin.c
ALL_SRCS = $(CORE_SRCS) $(SCHED_SRCS)

# OS Detection
ifeq ($(OS),Windows_NT)
    PLATFORM := Windows
    EXE_EXT := .exe
    SHLIB_EXT := .dll
    SHLIB_FLAGS := -shared
    RM := del /Q /F
else
    UNAME_S := $(shell uname -s 2>/dev/null || echo Linux)
    EXE_EXT :=
    ifeq ($(UNAME_S),Darwin)
        PLATFORM := macOS
        SHLIB_EXT := .dylib
        SHLIB_FLAGS := -dynamiclib -fPIC
    else
        PLATFORM := Linux
        SHLIB_EXT := .so
        SHLIB_FLAGS := -shared -fPIC
    endif
    RM := rm -f
endif

CLI_TARGET := scheduler_cli$(EXE_EXT)
SHLIB_TARGET := scheduler$(SHLIB_EXT)

TEST_NAMES := test_fcfs test_sjf test_srtf test_priority test_process test_scheduler test_simulation test_rr test_metrics test_comprehensive
TEST_TARGETS := $(addsuffix $(EXE_EXT), $(TEST_NAMES))

.PHONY: all clean test

all: $(CLI_TARGET) $(SHLIB_TARGET)

$(CLI_TARGET): $(ALL_SRCS) main.c
	$(CC) $(CFLAGS) $(ALL_SRCS) main.c -o $(CLI_TARGET) $(LDFLAGS)

$(SHLIB_TARGET): $(ALL_SRCS)
	$(CC) $(SHLIB_FLAGS) $(CFLAGS) $(ALL_SRCS) -o $(SHLIB_TARGET) $(LDFLAGS)

# Test binaries pattern
%$(EXE_EXT): tests/%.c $(ALL_SRCS)
	$(CC) $(CFLAGS) $(ALL_SRCS) $< -o $@ $(LDFLAGS)

test: $(TEST_TARGETS)
	./test_fcfs$(EXE_EXT)
	./test_sjf$(EXE_EXT)
	./test_srtf$(EXE_EXT)
	./test_priority$(EXE_EXT)
	./test_process$(EXE_EXT)
	./test_scheduler$(EXE_EXT)
	./test_simulation$(EXE_EXT)
	./test_rr$(EXE_EXT)
	./test_metrics$(EXE_EXT)
	./test_comprehensive$(EXE_EXT)

clean:
ifeq ($(OS),Windows_NT)
	-@erase /Q /F $(CLI_TARGET) $(SHLIB_TARGET) $(TEST_TARGETS) *.o 2>nul || true
	-@rm -f $(CLI_TARGET) $(SHLIB_TARGET) $(TEST_TARGETS) *.o *.exe *.dll *.so *.dylib 2>/dev/null || true
else
	$(RM) $(CLI_TARGET) $(SHLIB_TARGET) $(TEST_TARGETS) *.o *.so *.dylib
endif
