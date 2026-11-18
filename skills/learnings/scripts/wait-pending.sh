#!/bin/bash
# Exit as soon as a review session proposes a new learning, so the reviewer session wakes up and asks the user.
# Usage: wait-pending.sh <reviewer folder>
# Prints "PENDING <n>" (n = proposals waiting) and exits 0.
pending="$1/pending-learnings.jsonl"
count() { [ -f "$pending" ] && grep -c . "$pending" || echo 0; }
start=$(count)
# Proposals already waiting when the wait starts are reported right away.
if [ "$start" -gt 0 ]; then echo "PENDING $start"; exit 0; fi
while sleep 20; do
    n=$(count)
    if [ "$n" -gt 0 ]; then echo "PENDING $n"; exit 0; fi
done
