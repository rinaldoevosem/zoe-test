#!/usr/bin/env python3
"""Regenerate kanban.html: one board over every Evenly ticket in .scratch/*/issues.

Run from anywhere: python3 .scratch/render_kanban.py
Columns are derived from each ticket's Status, Type and Blocked by lines, so the
markdown tickets stay the source of truth; edit them, then rerun this script.
"""
import datetime
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
REPO_BLOB = "https://github.com/rinaldoevosem/zoe-test/blob/claude/admiring-carson-o9ey05/.scratch"
TRACKERS = [
    ("beta", "Beta build", "evenly-beta"),
    ("v1", "v1 decisions", "evenly-v1"),
    ("v0", "v0 prototype", "evenly-platform"),
]
COLUMNS = [
    ("you", "Needs you", "Decisions, tasks and triage only the owner or the pilot can do."),
    ("ready", "Ready for an agent", "Unblocked work an agent can pick up now."),
    ("blocked", "Blocked", "Waiting on other tickets."),
    ("done", "Done", "Shipped or decided."),
]
HUMAN_TYPES = {"grilling", "task", "hitl", "prototype"}
HUMAN_STATUSES = ("needs-triage", "ready-for-human", "needs-info")


def field(text, name):
    m = re.search(rf"^(?:\*\*)?{name}:(?:\*\*)?\s*(.+)$", text, re.M)
    return m.group(1).strip() if m else ""


def summary(text):
    m = re.search(r"^## (?:Question|What to build)\s*\n+(.+?)(?:\n\n|\Z)", text, re.M | re.S)
    raw = m.group(1) if m else field(text, "What to build")
    raw = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", raw)
    raw = re.sub(r"[`*]", "", raw).replace("\n", " ").strip()
    return raw if len(raw) <= 260 else raw[:257].rsplit(" ", 1)[0] + "…"


def load():
    tickets = {}
    for key, label, folder in TRACKERS:
        for f in sorted((ROOT / folder / "issues").glob("*.md")):
            text = f.read_text()
            head = re.match(r"#\s*(\d+):\s*(.+)", text.splitlines()[0])
            num, title = head.group(1), head.group(2).strip()
            blocked = field(text, "Blocked by")
            tickets[(key, num)] = {
                "project": key, "projectLabel": label, "num": num, "title": title,
                "type": field(text, "Type").lower(), "status": field(text, "Status").lower(),
                "blocked": [] if blocked.lower().startswith("none") else re.findall(r"\b(\d{2})\b", blocked),
                "summary": summary(text), "href": f"{REPO_BLOB}/{folder}/issues/{f.name}",
            }
    return tickets


def is_done(t):
    return t["status"].startswith(("done", "resolved"))


def column(t, tickets):
    if is_done(t):
        return "done", []
    waiting = [b for b in t["blocked"] if (t["project"], b) in tickets and not is_done(tickets[(t["project"], b)])]
    if waiting:
        return "blocked", waiting
    if t["type"] in HUMAN_TYPES or t["status"].startswith(HUMAN_STATUSES):
        return "you", []
    return "ready", []


def card(t, waiting):
    e = html.escape
    kind = t["type"] or t["status"].split(" ")[0]
    chips = f'<span class="chip proj proj-{t["project"]}">{e(t["projectLabel"])} {t["num"]}</span>'
    if kind:
        chips += f'<span class="chip kind">{e(kind)}</span>'
    wait = ""
    if waiting:
        wait = '<p class="wait">Waiting on ' + ", ".join(f"{t['project']} {w}" for w in waiting) + "</p>"
    return (
        f'<li class="card" data-project="{t["project"]}">'
        f'<div class="chips">{chips}</div>'
        f'<a class="title" href="{e(t["href"])}" target="_blank" rel="noopener">{e(t["title"])}</a>'
        f'{wait}<p class="sum">{e(t["summary"])}</p></li>'
    )


def render():
    tickets = load()
    cols = {k: [] for k, _, _ in COLUMNS}
    for t in tickets.values():
        col, waiting = column(t, tickets)
        cols[col].append((t, waiting))
    order = {k: i for i, (k, _, _) in enumerate(TRACKERS)}
    for col in cols.values():
        col.sort(key=lambda tw: (order[tw[0]["project"]], tw[0]["num"]))
    counts = {k: sum(1 for t in tickets.values() if t["project"] == k) for k, _, _ in TRACKERS}
    filters = '<button type="button" class="filter" aria-pressed="true" data-filter="all">All <b>' + str(len(tickets)) + "</b></button>"
    filters += "".join(
        f'<button type="button" class="filter" aria-pressed="false" data-filter="{k}">{html.escape(l)} <b>{counts[k]}</b></button>'
        for k, l, _ in TRACKERS
    )
    columns = "".join(
        f'<section class="col col-{k}" aria-labelledby="h-{k}"><header><h2 id="h-{k}">{html.escape(name)} '
        f'<span class="count" data-count="{k}">{len(cols[k])}</span></h2><p>{html.escape(note)}</p></header>'
        f'<ul>{"".join(card(t, w) for t, w in cols[k])}</ul></section>'
        for k, name, note in COLUMNS
    )
    today = datetime.date.today().isoformat()
    page = (ROOT / "kanban.template.html").read_text()
    return page.replace("{{FILTERS}}", filters).replace("{{COLUMNS}}", columns).replace("{{DATE}}", today)


if __name__ == "__main__":
    out = ROOT / "kanban.html"
    out.write_text(render())
    print(f"wrote {out}")
