---
name: open
description: Review the PR linked in a Slack message that the listener did not pick up (posted in a channel without mentioning you, or sent while it was off). Takes one or more Slack message links. Use when the user pastes a Slack message link and asks to review it, or runs /agentic-reviewer:open.
disable-model-invocation: true
argument-hint: "<slack message link> [...]"
---

# Open a review from a Slack message

Run, with the `reviewer.yaml` of the current folder (or the one the user names):

```bash
uv run --quiet --script "${CLAUDE_PLUGIN_ROOT}/listener/listener.py" open --config "<absolute path to reviewer.yaml>" $ARGUMENTS
```

It treats each message as an explicit request: same org and skip rules as the listener, the triage only picks
between a code review and a deploy checklist, ⏳ goes on the message, and the review opens in its own Orca terminal.
Report each line it prints (opened, or skipped and why).
