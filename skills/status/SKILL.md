---
name: status
description: Show what the agentic-reviewer is doing — whether the listener runs, the review sessions open in Orca, the queue, recent decisions, pending learnings and rules close to promotion, and anything in the inbox. Use when the user asks for the reviewer's status or runs /agentic-reviewer:status.
disable-model-invocation: true
---

# Reviewer status

Report briefly, from these sources:

1. **Listener**: running when the pid in `~/.agentic-reviewer/listener.lock` is alive (`kill -0 <pid>`).
2. **Open reviews**: `terminals` in `~/.agentic-reviewer/state.json` (`owner/repo#n` → Orca terminal), plus each
   PR's state (`gh pr view <n> --repo <owner/repo> --json state,reviewDecision`).
3. **Queue**: `queue` in the same file.
   The PR panel (status, PR, Slack and review links) is `python3 -I "${CLAUDE_PLUGIN_ROOT}/skills/start/scripts/panel.py"`.
4. **Recent decisions**: the last 15 lines of `~/.agentic-reviewer/logs/listener.log` (opened, skipped and why,
   triage results).
5. **Learnings**, from the reviewer folder:
   - pending proposals: the lines of `pending-learnings.jsonl` (repo and rule) — offer `/agentic-reviewer:learnings`
     when there are any;
   - rules close to promotion: entries in `orgs/<owner>/<repo>.md` at `[xN]` with N ≥ `learning.promote_after` − 1;
   - promotions in flight: `[promoted: <PR>]` entries and their PR state;
   - files near the limit: each `orgs/<owner>/<repo>.md` over 80% of `learning.max_chars` (show size / limit).
6. **Inbox**: files in the `inbox` folder of `reviewer.yaml` (default `~/.agentic-reviewer/inbox`) — things that
   need the user.
