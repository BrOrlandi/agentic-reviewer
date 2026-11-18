#!/bin/bash
# Wake the reviewer session when the listener records something new about a PR, and print the panel.
# Usage: wait-events.sh
# Keeps its cursor in ~/.agentic-reviewer/panel.cursor, so relaunching it never loses or repeats an event.
# Waits 10 s after the first new event so a burst (opened, then reviewing) arrives as one wake-up.
home="${AGENTIC_REVIEWER_HOME:-$HOME/.agentic-reviewer}"
events="$home/events.jsonl"
cursor_file="$home/panel.cursor"
here="$(cd "$(dirname "$0")" && pwd)"
size() { [ -f "$events" ] && wc -c < "$events" | tr -d ' ' || echo 0; }
mkdir -p "$home"
[ -f "$cursor_file" ] || size > "$cursor_file"
cursor=$(cat "$cursor_file")
[ "$(size)" -lt "$cursor" ] && cursor=0  # the events file was replaced: start over
while [ "$(size)" -le "$cursor" ]; do sleep 5; done
sleep 10
n=$(size)
python3 -I "$here/panel.py" --since "$cursor" --until "$n"
echo "$n" > "$cursor_file"
