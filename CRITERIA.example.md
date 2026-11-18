# Review criteria

Copy to `CRITERIA.md` (gitignored) next to your `reviewer.yaml`. The review reads it after the PR repository's own
instruction files (`REVIEW.md`, `CLAUDE.md`, `AGENTS.md`, …); where they conflict, the repository wins.

Write what you would tell a new reviewer on your team. For example:

- Prefer integration tests through real callers over unit tests of trivial functions; small changes may ship
  without new tests.
- Any new endpoint needs an authorization check and a test for the unauthorized case.
- PR descriptions follow the repository template, including its security section.
- Issue keys in titles and descriptions are links.
