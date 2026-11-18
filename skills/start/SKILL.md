---
name: start
description: Start the agentic-reviewer listener in the background of this Claude Code session, so every PR sent to you on Slack (DM, mention, watched channel, your 👀 reaction) or requested from you on GitHub opens its own review session in Orca. Runs while this session is open. Use when the user says start the reviewer, start listening, turn on reviews, or runs /agentic-reviewer:start.
disable-model-invocation: true
argument-hint: "[path to reviewer.yaml]"
---

# Start the listener

1. **Find the config**: the argument, else `./reviewer.yaml`. Missing → tell the user to run
   `/agentic-reviewer:setup` and stop.
2. **Preflight**, and stop with the fix when one fails:
   - `slackcli auth whoami` shows a verified **browser** login (`slackcli auth login-auto` otherwise);
   - `gh auth status` is logged in;
   - Orca is running (`orca status`);
   - `uv --version` works.
3. **Launch it in the background** (`run_in_background: true`) — never in the foreground, never polled:
   ```bash
   uv run --quiet --script "${CLAUDE_PLUGIN_ROOT}/listener/listener.py" run --config "<absolute path to reviewer.yaml>"
   ```
4. Tell the user in a few lines: what it watches (the first log line says it), that each PR opens an Orca terminal
   titled `PR <repo>#<n>` which closes itself when the PR is merged or closed, that the log is
   `~/.agentic-reviewer/logs/listener.log`, and that **closing this session stops the listener**.

## When the background task ends

Read its last lines (`tail -5` of the task output, or the log):

- `STOPPED: another agentic-reviewer listener is already running` → say so; do not relaunch.
- `STOPPED: interrupted`, or the user asked to stop → do not relaunch.
- `reviewer.yaml: …` → a config problem; show it and stop.
- anything else (a crash) → show the last error line, relaunch once; if it dies again within a minute, stop and
  hand it to the user.

Between events, stay quiet: the listener does its work on its own. Answer the user normally while it runs.
