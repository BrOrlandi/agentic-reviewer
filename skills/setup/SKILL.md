---
name: setup
description: Set up agentic-reviewer once — interview the user, write reviewer.yaml and CRITERIA.md in the current folder, and check slackcli, gh, Orca and uv. Use when the user installs agentic-reviewer, wants to configure or reconfigure it, or runs /agentic-reviewer:setup.
disable-model-invocation: true
---

# Set up the reviewer

The folder where this runs becomes the **reviewer folder**: `reviewer.yaml` and `CRITERIA.md` live here, and
`/agentic-reviewer:start` is run from here. Both files are personal, so remind the user to keep them out of any
public repository (the plugin's own repo already ignores them).

Before anything else, tell the user which folder that is. When it is not a clone of the agentic-reviewer
repository (no `.claude-plugin/marketplace.json` here), say in one line that the recommended setup is to clone the
repo and run setup inside it, and that continuing here works too: the configuration is saved in this folder, and
`/agentic-reviewer:start` must be run from it. Then continue, unless the user wants to switch.

## 1. Check the tools

| Tool | Check | Fix |
| --- | --- | --- |
| slackcli | `slackcli auth whoami` shows a verified **browser** login | `slackcli auth login-auto` |
| GitHub CLI | `gh auth status` | `gh auth login` |
| Orca | `orca status` | install and open Orca |
| uv | `uv --version` | install uv |

Stop at the first one missing and give the fix.

## 2. Interview

Ask with the question tool, a few at a time, offering the detected values as defaults:

1. **Allowed GitHub orgs** (required) — only their PRs open a review session. Suggest the orgs of the user's
   recent PRs (`gh search prs --author @me --limit 30 --json repository`).
2. **Watched Slack channels** — channels where every PR link is a candidate even without a mention (the triage
   filters notifications out). Default none.
3. **GitHub review requests** — also review PRs where they are personally requested. Default yes.
4. **Orca worktree** for the review terminals — an existing folder, ideally a checkout used only for reviews.
5. **Local clones folder** — where clones live as `<folder>/<repo>`, so the review reads whole files.
6. **Model and effort** for reviews (default `claude-opus-5-5`, `medium`), and the **maximum sessions** open at once
   (default 4).
7. **Inbox** — the folder for things that need them (default `~/.agentic-reviewer/inbox`), and whether to also get
   a Slack DM.
8. **Review criteria** — what they would tell a new reviewer on their team, in general (`CRITERIA.md`) and per
   org (`orgs/<org>/CRITERIA.md`, one per allowed org, plus one for their own GitHub login for personal repos). The PR
   repository's own `REVIEW.md` / `CLAUDE.md` / `AGENTS.md` always come first.
9. **Self-improvement limits** — `learning.max_chars` (default 3000) and `learning.promote_after` (default 3).

## 3. Write the files

- `reviewer.yaml` from `${CLAUDE_PLUGIN_ROOT}/reviewer.example.yaml`, with the answers.
- `CRITERIA.md` from `${CLAUDE_PLUGIN_ROOT}/CRITERIA.example.md`, with their criteria as short bullets.
- `orgs/<org>/CRITERIA.md` for each org they gave criteria for.
- an `orgs/<org>/` folder per allowed org (review sessions add `<repo>.md` learnings there; `/agentic-reviewer:learnings` curates them).

Show both and end with: run `/agentic-reviewer:start` here, and keep this session open while it should listen.
