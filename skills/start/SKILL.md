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
4. **Launch the learnings wait** in the background too (`run_in_background: true`):
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/skills/learnings/scripts/wait-pending.sh" "<reviewer folder>"
   ```
   It exits with `PENDING <n>` as soon as a review session proposes a learning (or right away if some are
   waiting).
5. **Show the panel and launch the panel wait** in the background (`run_in_background: true`):
   ```bash
   python3 -I "${CLAUDE_PLUGIN_ROOT}/skills/start/scripts/panel.py"          # once, now: PRs already in flight
   "${CLAUDE_PLUGIN_ROOT}/skills/start/scripts/wait-events.sh"                # background
   ```
   The listener appends every PR status change to `~/.agentic-reviewer/events.jsonl`: queued, review opened,
   findings posted, approved, merged/closed, plus PRs it skipped or triage dropped. Verdicts are read from GitHub
   (your latest review on the PR), so they show even when a review session never reports. The wait exits with the
   new events and the whole panel as soon as something changes; it keeps its own cursor, so relaunching it is the
   same command.
6. Tell the user in a few lines: what it watches (the first log line says it), that each PR opens an Orca terminal
   titled `PR <repo>#<n>` which closes itself when the PR is merged or closed, that the log is
   `~/.agentic-reviewer/logs/listener.log`, and that **closing this session stops the listener**.

## When the panel wait ends

This conversation is the panel of every PR the listener found and reviewed. Post its output in the language set in `reviewer.yaml` (`language`: `en` or `pt-BR`),
keeping every link, as:

- one line per **new** event: what happened, in plain words (review opened, findings posted and waiting for the
  author, approved, merged, skipped and why);
- then the **PR table**: status, PR number linked to the PR, repository, title, the review or approval link, and the
  Slack message link (or "GitHub request" when it came from GitHub).

Findings are posted as a `COMMENT` review (the review loop never uses `REQUEST_CHANGES`): call that state "findings
posted, waiting for the author", not "changes requested". Then launch the wait again. Do not add commentary between
events.

## When the learnings wait ends

Run the `/agentic-reviewer:learnings` flow here: ask the user about each proposal. This does not pause anything —
the listener and the review sessions keep running in their own processes while the question is open. When done,
launch the wait again.

## When the listener ends

Read its last lines (`tail -5` of the task output, or the log):

- `STOPPED: another agentic-reviewer listener is already running` → say so; do not relaunch.
- `STOPPED: interrupted`, or the user asked to stop → do not relaunch.
- `reviewer.yaml: …` → a config problem; show it and stop.
- anything else (a crash) → show the last error line, relaunch once; if it dies again within a minute, stop and
  hand it to the user.

Between events, stay quiet: the listener does its work on its own. Answer the user normally while it runs.
