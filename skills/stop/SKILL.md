---
name: stop
description: Stop the agentic-reviewer listener started in this session. Review sessions already open in Orca keep running. Use when the user says stop the reviewer, stop listening, or runs /agentic-reviewer:stop.
disable-model-invocation: true
---

# Stop the listener

1. Stop the background task running `listener.py run` in this session (TaskStop). When it was started elsewhere,
   end it by its pid: `cat ~/.agentic-reviewer/listener.lock`, then `kill <pid>`.
2. Do not relaunch it. Say that review sessions already open in Orca keep going until their PR is merged or closed
   (each closes its own terminal), and that `/agentic-reviewer:start` turns listening back on.
