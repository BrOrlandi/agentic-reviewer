#!/usr/bin/env python3
"""Render the agentic-reviewer panel from ~/.agentic-reviewer/events.jsonl (written by the listener).

Usage: panel.py [--since BYTES] [--until BYTES] [--hours H]
  --since/--until  byte offsets of the events file: events in that range are listed as new
  --hours          also show PRs that finished (merged, closed, ignored, skipped) in the last H hours (default 24)
Prints Markdown: the new events, then one table row per PR with its latest status.
"""
import argparse
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

HOME = Path(os.environ.get("AGENTIC_REVIEWER_HOME", Path.home() / ".agentic-reviewer"))
EVENTS = HOME / "events.jsonl"
LABEL = {
    "queued": "⏸ queued", "reviewing": "⏳ reviewing", "changes": "🔄 findings posted (waiting for the author)",
    "approved": "✅ approved", "merged": "🟣 merged", "closed": "⚫ closed", "ignored": "⏭ not a review request",
    "skipped": "⏭ skipped", "failed": "❌ could not open",
}
DONE = {"merged", "closed", "ignored", "skipped", "failed"}


def read(until: int | None) -> list[tuple[int, dict]]:
    if not EVENTS.exists():
        return []
    data = EVENTS.read_bytes()
    data = data if until is None else data[:until]
    out, pos = [], 0
    for line in data.splitlines(keepends=True):
        pos += len(line)
        try:
            out.append((pos, json.loads(line)))
        except ValueError:
            continue
    return out


def link(text: str, url: str | None) -> str:
    return f"[{text}]({url})" if url else ""


def row(e: dict) -> str:
    title = (e.get("title") or "").replace("|", "/")[:70]
    verdict = {"changes": link("findings", e.get("link")), "approved": link("approval", e.get("link")),
               "merged": link("your approval", e.get("link")), "closed": link("your approval", e.get("link")),
               }.get(e.get("status"), "")
    slack = link("message", e.get("slack")) or ("GitHub request" if (e.get("origin") or "").startswith("GitHub") else "—")
    when = (e.get("time") or "")[11:16]
    note = (e.get("note") or "").replace("|", "/")[:90]
    return (f"| {LABEL.get(e['status'], e['status'])} | [#{e['number']}]({e['url']}) | {e['repo']} | {title} | "
            f"{verdict or '—'} | {slack} | {when} | {note} |")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", type=int, default=None)
    ap.add_argument("--until", type=int, default=None)
    ap.add_argument("--hours", type=float, default=24)
    a = ap.parse_args()
    events = read(a.until)
    latest: dict[str, dict] = {}
    for _, e in events:
        merged = dict(latest.get(e["key"], {}))
        if e["status"] in ("reviewing", "queued") and merged.get("status") in DONE:
            merged = {}  # a new review of a finished PR starts clean
        merged.pop("link", None)  # the link belongs to the event that carries it (findings, approval)
        merged.update(e)
        latest[e["key"]] = merged
    new = [e for pos, e in events if a.since is not None and pos > a.since]
    if new:
        print("### New")
        for e in new:
            extra = " — " + e["note"] if e.get("note") else ""
            print(f"- {(e.get('time') or '')[11:16]} {LABEL.get(e['status'], e['status'])}: "
                  f"[{e['repo']}#{e['number']}]({e['url']}){extra}")
        print()
    cutoff = datetime.now().astimezone() - timedelta(hours=a.hours)
    shown = [e for e in latest.values()
             if e["status"] not in DONE or datetime.fromisoformat(e["time"]) >= cutoff]
    shown.sort(key=lambda e: (e["status"] in DONE, e.get("time") or ""), reverse=False)
    print("### PRs")
    if not shown:
        print("No PRs on the panel yet.")
        return
    print("| Status | PR | Repo | Title | Verdict | Slack | Updated | Note |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for e in shown:
        print(row(e))


if __name__ == "__main__":
    main()
