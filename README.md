# agentic-reviewer

<p align="center">
  <img src="docs/hero.png" alt="A teammate asks for a review on Slack, you hand it straight to Claude Code" width="560">
</p>

**Become an agentic code reviewer.** Teammates ask you for a review the way they always do, by dropping a PR link in Slack. A Claude Code session picks it up, reviews the PR against the repository's own rules and your criteria, posts the comments, follows up with the author, and approves once everything is resolved. Each step shows up as a reaction on the Slack message.

You stay the reviewer: reviews and approvals go out under your own GitHub and Slack accounts, and are marked as AI-generated. The agent does the work, while what counts as a good change comes from the repository's rules and the criteria you set.

> Status: private preview. macOS + [Orca](https://orca.build) + [slackcli](https://github.com/shaharia-lab/slackcli) + [Claude Code](https://claude.com/claude-code).

## What it looks like

> **#team-reviews** — **Alex**: hey @you, can you take a look? https://github.com/acme/web/pull/42

1. Within seconds the message gets ⏳: a Claude Code session opened for that PR in an Orca terminal and is reviewing it.
2. The review lands on GitHub as inline comments: a bug with a concrete scenario, a rule from the repo's `REVIEW.md` or `CLAUDE.md` that the change breaks, a missing test. Comments from review bots and other reviewers already on the PR are judged too: the ones the agent agrees with get 👍 and are tracked, and a bot finding it disagrees with gets a reply explaining why.
3. The reaction flips to 🔄: there is something for Alex to fix.
4. Alex pushes a fix and replies in a thread. The agent wakes up, flips back to ⏳, and verifies each fix in the code. A reply saying "Fixed" is not enough. It resolves the threads that are done and pushes back once, with a concrete scenario, on an answer that does not hold.
5. Everything resolved and CI green: the agent approves, and the reaction becomes ✅.
6. If new commits land after the approval, it reviews just the delta and re-approves when it is clean. When the PR is merged or closed, the session closes its own terminal.

A message like *"merged #42, thanks!"* or *"deploy PR is up: staging → main, need an approval"* is triaged before any session opens. The first one is a notification, so nothing happens. The second gets a **release checklist** instead of a line-by-line review: only already-reviewed changes are going in, CI is green, migrations and feature flags are accounted for. Then it approves, or flags what is off.

## The flow

```mermaid
flowchart TD
    A([Slack message with a PR link]) --> B{Trigger?<br/>DM · mention · 👀 reaction · watched channel<br/>· thread ask · GitHub review request}
    B -- no --> Z([ignore])
    B -- yes --> C{Org allowed?}
    C -- no --> I([inbox: review it by hand])
    C -- yes --> D[Semantic triage<br/>message + PR metadata + repo flow<br/>cheap model]
    D -- notification / FYI / merged --> Z
    D -- review request --> E
    D -- deploy approval --> E2[Release checklist]
    E[⏳ open a Claude Code session<br/>in an Orca terminal] --> F[Load rules<br/>repo REVIEW.md · CLAUDE.md · AGENTS.md · other AI md<br/>+ learnings for the repo · org criteria · CRITERIA.md]
    F --> G[Review the diff<br/>verify every finding in the code<br/>judge existing bot and human comments]
    G --> H{Findings?}
    H -- yes --> J[Post one review, COMMENT only<br/>🔄 on the Slack message]
    J --> K[Wait for the author<br/>push · reply · reaction]
    K --> L[⏳ Re-review<br/>verify fixes · judge answers · review new code]
    L --> H
    L -. author says a finding is wrong<br/>and the reason holds .-> S1

    subgraph SI [Self-improvement]
      S1{Rule already learned<br/>for this repo?}
      S1 -- yes --> S2[Reinforce it: x1 → x2 → x3]
      S1 -- no --> S3[Propose a new rule]
      S3 --> S4[/You approve, edit or reject it<br/>in your reviewer session/]
      S4 -- approved --> S5[(orgs/owner/repo.md<br/>max 3,000 chars)]
      S2 --> S5
      S5 -- "x3, or file full" --> S6[/You approve a promotion/]
      S6 --> S7[PR to the repo's<br/>REVIEW.md · AGENTS.md · CLAUDE.md]
      S5 -- same rule in 2+ repos --> S8[(orgs/owner/CRITERIA.md)]
    end
    S5 -. used by the next reviews .-> F
    H -- no --> M{CI green?}
    E2 --> M
    M -- pending --> M2[Comment: approval waits for CI] --> M
    M -- failing, caused by PR --> J
    M -- green --> N[Approve<br/>✅ on the Slack message]
    N --> O{New commits?}
    O -- yes --> P[⏳ Delta review] --> H
    O -- merged / closed --> Q([close the session's terminal])
```

## How it works

You open Claude Code in your reviewer folder (where `reviewer.yaml` and `CRITERIA.md` live), run `/agentic-reviewer:start`, and leave that session open. That session is the switch: while it is open, the listener runs in its background and every PR handed to you opens its own review terminal in Orca. Close the session, or run `/agentic-reviewer:stop`, and nothing listens anymore. Nothing is installed in the system and nothing starts with the Mac.

| Piece | What it does |
| --- | --- |
| **Listener** (`listener/`) | A background process of your Claude Code session, started by `/agentic-reviewer:start`. It runs while that session is open and stops with it. It listens to Slack in real time over the websocket of your own browser session (read from `slackcli`'s keychain entry), catches up with Slack search after every reconnect and every 10 minutes, filters by trigger and org, runs the semantic triage, and opens one Orca terminal per PR, up to `max_sessions` at once (the rest wait in a queue). It closes the terminal when the PR leaves `OPEN`. State and logs live in `~/.agentic-reviewer/`. |
| **Triage** | A cheap model (`claude -p` on Haiku) reads the message, the PR's metadata (title, base and head branches, state, labels, files) and the repository's flow (`REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING`, release docs), and answers `review_request`, `deploy_approval`, `notification` or `other`. Only the first two open a session. |
| **`/agentic-reviewer:review`** | The review loop, one session per PR: rules first and taste last, findings verified in the code, one review per round, never `REQUEST_CHANGES`, never merges. It waits for the author in the background, re-reviews, approves, keeps the approval honest on new commits, and drives the Slack reactions. With `mode=deploy` it runs the release checklist instead. |
| **`learnings`** | Goes through the rules review sessions proposed, promotes the ones that keep coming back into the repository (as a PR), and keeps each learnings file under its limit. |
| **`setup` · `start` · `stop` · `status` · `open`** | `/agentic-reviewer:setup` interviews you once, writes `reviewer.yaml` and `CRITERIA.md`, and checks `slackcli`, `gh`, Orca and `uv`. `start` launches the listener in the background of the current session; `stop` ends it; `status` shows open reviews, the queue, recent decisions and the inbox; `open <slack link>` reviews a message the listener did not pick up. |

### Triggers

| Trigger | Fires when |
| --- | --- |
| Direct message | someone sends you a PR link in a DM |
| Mention | a channel or group message with a PR link mentions you |
| Watched channel | a PR link is posted in a channel listed in `reviewer.yaml`, whether or not you are mentioned (the triage decides) |
| Thread ask | someone mentions you in the thread of a message that has a PR link |
| 👀 reaction | **you** react with :eyes: to any message that has a PR link, in any channel |
| Manual | `/agentic-reviewer:open <slack message link>` |
| GitHub review request | you are **personally** in the PR's requested reviewers. A request to a team, a group or CODEOWNERS does not count |

Your own messages never trigger a review, and neither do PRs you authored, PRs that are not open, or PRs whose current head you already approved. When the review status goes on the message (⏳ → 🔄 / ✅), your 👀 is removed, so the message only shows the current status.

### Where the review criteria come from

Highest priority first:

1. **The PR's repository**: every AI and contributor instruction file it has, at the root and in each directory the PR touches. That means `REVIEW.md`, `CLAUDE.md` (and `.claude/CLAUDE.md`), `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/` or `.cursorrules`, `CONTRIBUTING.md` and the PR template, plus the docs those files point to for the code the PR touches. `REVIEW.md` comes first when it exists, because it is written for reviewers. A pattern the repo endorses is never a finding.
2. **What the reviewer learned in that repository** (`orgs/<owner>/<repo>.md`, see Self-improvement).
3. **Your criteria for that org** (`orgs/<owner>/CRITERIA.md`), including your own account for personal repositories.
4. **Your general criteria** (`CRITERIA.md`), in plain text. For example: "flag any new endpoint without an authorization test", or "we prefer integration tests over unit tests".
5. **Your global Claude Code instructions** (`~/.claude/CLAUDE.md`).

### Self-improvement

The reviewer learns each repository from the people who work in it. When an author answers a finding with a reason that holds ("this is intended, here we read flags through `useFlag`"), in a PR thread, a PR comment or the Slack thread, the review session turns it into one short rule for that repository:

- **New rule** → proposed to you. Your reviewer session (the one that ran `/agentic-reviewer:start`) wakes up and asks you to approve, edit or reject it. Answering never pauses anything: the listener and the review sessions keep working in their own processes, and an unapproved rule is simply not used yet.
- **A rule that comes back** → reinforced on its own (`[x1]` → `[x2]` → `[x3]`), with the PRs as sources.
- **Three times, or the file is full** → you are asked to promote it into the repository's own `REVIEW.md`, `AGENTS.md` or `CLAUDE.md`, so every reviewer and agent on the team gets it. On approval the reviewer opens that PR for you, and the rule leaves your file once it is merged.
- **The same rule in two or more repos of an org** → proposed for that org's criteria, where it applies to all of its repositories.

Learnings live in your reviewer folder, one folder per org and one file per repository, each capped at 3,000 characters (`learning.max_chars`), so work and personal projects stay apart and no project crowds out another:

```
CRITERIA.md                   your criteria, every org
orgs/acme/CRITERIA.md         criteria for the acme org
orgs/acme/web.md              what the reviewer learned in acme/web
orgs/your-login/CRITERIA.md   criteria for your personal repositories
pending-learnings.jsonl       proposals waiting for you
```

Run `/agentic-reviewer:learnings` any time to go through what is pending, promote rules, or tidy a file that is getting full.

### Configuration

`reviewer.yaml`, the criteria and the learnings are personal: they live in your reviewer folder and stay out of git (this repo's `.gitignore` already lists them, so you can use your clone as the reviewer folder). Start from [`reviewer.example.yaml`](reviewer.example.yaml) and [`CRITERIA.example.md`](CRITERIA.example.md), or let `/agentic-reviewer:setup` write them:

```yaml
slack:
  watch_channels: [team-reviews, deploys]  # every PR link here is a candidate; the triage decides
  trigger_reactions: [eyes]
github:
  allowed_orgs: [acme]            # required: PRs from other orgs go to the inbox, never auto-reviewed
  review_requests: true           # only when you are personally requested
  clones_dir: ~/code              # <clones_dir>/<repo>, so the review reads whole files
review:
  model: claude-opus-5-5
  effort: medium
  max_sessions: 4
triage:
  model: claude-haiku-5-5
orca:
  worktree: ~/orca/workspaces/reviews/main   # required: where the review terminals open
learning:
  max_chars: 3000                 # per repository learnings file
  promote_after: 3                # times a rule comes back before it is proposed for the repo
inbox: ~/.agentic-reviewer/inbox  # things that need you: expired Slack session, Orca down, a PR from another org
```

On the first start nothing old is replayed: Slack is read from that moment on, and GitHub review requests already pending are skipped.

## Safety

- **Allowed orgs only.** Each review session runs Claude Code without permission prompts and reads the PR repository's instruction files. Anyone who can DM you, including external people in Slack Connect, can send a link. So only PRs from `allowed_orgs` open a session; anything else lands in the inbox for you to decide.
- **Only the extracted URL** goes into the review session's prompt, never the Slack message text. The triage does read the message, so it runs with no tools, no settings, no MCP servers and no session history, and it can only answer one of four labels.
- **The agent never** merges, pushes, edits the author's code, uses `REQUEST_CHANGES`, or dismisses someone else's review. It does not approve while a critical or security finding is open, while a check the PR caused is failing, or on a head commit it has not reviewed.
- **Credentials stay in the keychain.** The Slack session is read at connect time and never written to disk or logs.
- **The Slack connection is unofficial.** It uses your browser session (`xoxc` token and `d` cookie) the way the Slack web client does. Slack can change the protocol without notice, and logging out of Slack in the browser ends the session. The listener reports that to the inbox.

## Requirements

- macOS
- [Orca](https://orca.build): each review runs in its own Orca terminal
- [Claude Code](https://claude.com/claude-code)
- [slackcli](https://github.com/shaharia-lab/slackcli), logged in with `slackcli auth login-auto`
- [GitHub CLI](https://cli.github.com), logged in as the reviewer
- [uv](https://docs.astral.sh/uv/)

## Install

In Claude Code:

```bash
/plugin marketplace add BrOrlandi/agentic-reviewer
/plugin install agentic-reviewer@agentic-reviewer
```

Then, in the folder you want as your reviewer folder:

```bash
/agentic-reviewer:setup      # once: interview → reviewer.yaml, CRITERIA.md
/agentic-reviewer:start      # each time: listen while this session is open
```

To try the triage on a message without opening anything:

```bash
uv run --script listener/listener.py triage --config reviewer.yaml <slack message link>
```

## Limitations

- **macOS and Orca only.** Credentials come from the macOS keychain, and every review runs in an Orca terminal.
- **Reactions made while the listener is off are not recovered** (Slack search does not find reactions). Remove the 👀 and add it again.
- **Thread asks are seen live only.** A mention in a thread while the listener is off is not caught up; use `/agentic-reviewer:open` with the parent message.
- **The Slack connection is unofficial** (see Safety).

## License

MIT

---

**Liked this skill?** See more of my Claude Code skills in [**my-claude-skills**](https://github.com/BrOrlandi/my-claude-skills): commits, pull requests, PR review, releases, Jira, Slack, hooks and a statusline.
