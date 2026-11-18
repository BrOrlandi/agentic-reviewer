---
name: status
description: Show what the agentic-reviewer is doing — whether the listener runs, the review sessions open in Orca, the queue, recent decisions and anything in the inbox. Use when the user asks for the reviewer's status or runs /agentic-reviewer:status.
disable-model-invocation: true
---

# Reviewer status

Report briefly, from these sources:

1. **Listener**: running when the pid in `~/.agentic-reviewer/listener.lock` is alive (`kill -0 <pid>`).
2. **Open reviews**: `terminals` in `~/.agentic-reviewer/state.json` (`owner/repo#n` → Orca terminal), plus each
   PR's state (`gh pr view <n> --repo <owner/repo> --json state,reviewDecision`).
3. **Queue**: `queue` in the same file.
4. **Recent decisions**: the last 15 lines of `~/.agentic-reviewer/logs/listener.log` (opened, skipped and why,
   triage results).
5. **Inbox**: files in the `inbox` folder of `reviewer.yaml` (default `~/.agentic-reviewer/inbox`) — things that
   need the user.
