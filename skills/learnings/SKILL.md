---
name: learnings
description: Review what the agentic reviewer learned from authors' feedback — approve, edit or reject new rules proposed by review sessions, promote rules that keep coming back into the repository's REVIEW.md / CLAUDE.md / AGENTS.md through a PR, move rules shared by several repos of an org into that org's criteria, and keep each learnings file under its size limit. Use when a review session proposed a learning (the start session wakes up for it), or when the user runs /agentic-reviewer:learnings.
disable-model-invocation: true
argument-hint: "[reviewer folder]"
---

# Learnings

The reviewer folder (the argument, else the folder with `reviewer.yaml`) holds:

```
CRITERIA.md                  general criteria, every org
orgs/<owner>/CRITERIA.md     criteria for one org (or the user's own account, for personal repos)
orgs/<owner>/<repo>.md       approved learnings for one repository
pending-learnings.jsonl      proposals from review sessions, one JSON per line
```

One folder per org keeps work and personal projects apart, and the size limit applies to **each repository file**,
so working on many projects never squeezes one project's learnings.

Limits come from `reviewer.yaml` → `learning:` — `max_chars` (default 3000 per repository file) and
`promote_after` (default 3).

**This never blocks reviews.** The listener and the review sessions run in their own processes; while this skill
waits for the user's answers they keep working. A pending proposal only means the review does not use that rule
yet.

## Learnings file format

```markdown
# Learnings — owner/repo

- [x3] Feature flags are read through `useFlag`; do not flag direct env reads in `web/`. (#412, #430, #455)
- [x1] Migrations here are always reversible; a missing `down` is a finding. (#470)
- [promoted: <PR URL>] Errors are logged with `logger.error`, never `console.error`. (#301, #322, #340)
```

`[xN]` is how many times the rule came back. Keep each rule ≤ 200 characters and the file under `max_chars`.

## 1. New rules

For each `"kind": "new"` line in `pending-learnings.jsonl`, ask the user — **one question per proposal**, with the question
tool — showing the repository, the rule and its evidence links:

- **Approve** → append `- [x1] <rule> (<PR #>)` to `orgs/<owner>/<repo>.md` (create it with its title).
- **Edit** → take the user's wording, then approve.
- **Reject** → drop it.

If the rule is already in the file (same meaning), reinforce it instead of adding a second line.

Before appending, check the size: if the file would pass `max_chars`, first run **3. Keep the file small**.

## 2. Promotions to the repository

For each `"kind": "promote"` line, and for every rule with `[xN]` where N ≥ `promote_after` that is not yet
promoted, propose moving it into the repository's own instructions:

1. Pick the target file on the default branch: `REVIEW.md` when it exists (rules for reviewers), else
   `AGENTS.md`, else `CLAUDE.md`. Read it and find the section the rule fits; draft the exact lines to add, in
   the file's own language and style.
2. Ask the user, showing the draft and the target file: **Open a PR** / **Edit** / **Not now** (keep counting) /
   **Never** (mark it `[local]` so it is not proposed again).
3. On **Open a PR**: in the local clone (`clones_dir` of `reviewer.yaml`, else a fresh clone in
   `~/.agentic-reviewer/work/`), create a branch `reviewer/learning-<short-slug>` from the default branch, add the
   lines, commit (`docs: <rule in a few words>`), push, and open a PR — ready for review, not a draft — whose body
   explains the rule and links the PRs where it came up. Follow the repository's PR template and conventions.
4. Mark the line `[promoted: <PR URL>]`. A promoted rule stays in the file (the review still uses it) until its PR
   is merged; then delete the line. If the PR is closed unmerged, put the counter back.

Check the state of every `[promoted: …]` PR each time this skill runs.

## 3. Keep the file small

When a repository file passes `max_chars` (or would, with a new rule):

1. Merge rules that say the same thing.
2. Propose promoting the most reinforced ones (section 2).
3. Propose dropping `[x1]` rules older than three months that never came back.

Ask before deleting anything the user approved.

## 4. Rules shared across an org

When the same rule (same meaning) is approved in two or more repositories of the same owner, propose moving it to
`orgs/<owner>/CRITERIA.md`, where it applies to every repository of that org (or of the user's own account). On
approval, add it there as a bullet and delete it from each repository file.

## 5. Finish

Remove every handled line from `pending-learnings.jsonl` (keep the ones the user skipped). Report in one short block what was
approved, edited, rejected, promoted (with PR links) and moved to an org.
