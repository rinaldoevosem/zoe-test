#!/usr/bin/env python3
"""Regenerate flowchart.md and zoe-v1-map.html from map.md and issues/*.md.

Run from anywhere: python3 .scratch/zoe-v1/render_map.py
The ticket files are the source of truth; never hand-edit the generated outputs.
"""
import glob, html, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
from _style import STYLE  # noqa: E402

SHORT = {
    "01": "Destination & pilot", "02": "Confirm provisional ADRs", "03": "Where Zoe lives", "04": "Business model & licensing",
    "05": "Compliance: HIPAA / SOC 2", "06": "Hospital SSO & IdPs", "07": "Epic / paging paths", "08": "Payroll formats",
    "09": "Solver options", "10": "Real schedule sample", "11": "Rule catalogue", "12": "Rule authoring UX",
    "13": "Auto-fill strategy", "14": "Auth, tenancy, residency", "15": "Notification channels", "16": "Mobile: PWA vs native",
    "17": "Integration scope", "18": "Nursing scope", "19": "Credentialing scope", "20": "Migration & onboarding",
    "21": "Lock the v1 spec", "22": "Auto-fill benchmark",
}
TYPE = {"grilling": ("Grilling", "HITL"), "research": ("Research", "AFK"), "prototype": ("Prototype", "HITL"), "task": ("Task", "HITL")}
INIT = '%%{init: {"flowchart": {"useMaxWidth": false, "nodeSpacing": 28, "rankSpacing": 56}} }%%'
CLASSES = """  classDef grilling fill:#d7ece9,stroke:#0f766e,color:#0b3b37
  classDef research fill:#dfe7f6,stroke:#3b5b9a,color:#1d2d4f
  classDef prototype fill:#f3e3cf,stroke:#a3601b,color:#4a2b0b
  classDef task fill:#ece2f3,stroke:#7a4a9a,color:#3a2050
  classDef done fill:#e4e7ea,stroke:#5b6670,color:#2a3036
  classDef prov fill:#fbf0c9,stroke:#a8841a,color:#43350a,stroke-dasharray:4 3
  classDef dest fill:#0f766e,stroke:#0b4f4a,color:#ffffff
  classDef backlog fill:#f6f1e7,stroke:#8a7a5a,color:#3d3523,stroke-dasharray:4 3"""


def load():
    out = []
    for p in sorted(glob.glob("issues/*.md")):
        s = open(p).read()
        head = re.search(r"^# (\d+): (.+)$", s, re.M)
        blk = re.search(r"^Blocked by: (.+)$", s, re.M).group(1)
        body = s.split("## Question", 1)[1]
        question, _, answer = body.partition("## Answer")
        out.append(dict(
            n=head.group(1), title=head.group(2), path=p,
            type=re.search(r"^Type: (\w+)", s, re.M).group(1),
            status=re.search(r"^Status: (\w+)", s, re.M).group(1),
            deps=[] if blk.startswith("None") else [b.strip() for b in blk.split(",")],
            q=question.strip(), answer=answer.strip(),
        ))
    return out


def node(t, cls=None):
    return f'T{t["n"]}["{t["n"]} · {SHORT[t["n"]]}<br/><i>{t["type"]}</i>"]:::{cls or t["type"]}'


def decision_map(tickets):
    by = {t["n"]: t for t in tickets}
    done = [t for t in tickets if t["status"] == "resolved"]
    open_ = [t for t in tickets if t["status"] != "resolved"]
    frontier = [t for t in open_ if all(by[d]["status"] == "resolved" for d in t["deps"])]
    blocked = [t for t in open_ if t not in frontier and t["n"] != "21"]
    L = [INIT, "flowchart LR", '  subgraph KNOWN["Decided so far"]',
         '    D1["Incumbent research"]:::done', '    D2["v0 prototype spec<br/>built & tested"]:::done',
         '    D3["ADRs 0001–0008<br/>provisional"]:::prov']
    L += [f"    {node(t, 'done')}" for t in done] + ["  end", '  subgraph FRONTIER["Frontier: takeable now"]']
    L += [f"    {node(t)}" for t in frontier if t["n"] != "21"] + ["  end", '  subgraph FOG["Blocked"]']
    L += [f"    {node(t)}" for t in blocked] + ["  end"]
    L += [f"  {node(by['21'])}", '  DEST(["Destination<br/>pilot-ready v1 spec"]):::dest',
          "  D3 -.reopened by.-> T02", "  D1 -.informs.-> T01"]
    L += [f"  T{d} --> T{t['n']}" for t in tickets for d in t["deps"]]
    L += ["  T21 ==> DEST", CLASSES]
    return "\n".join(L), frontier, blocked, done


FEATURE_MAP = INIT + """
flowchart LR
  SPEC0["v0 spec<br/>40 stories"]:::done
  subgraph BUILT["Built in v0 (zoe/)"]
    F1["Rule engine<br/>Hard / Soft Violations"]:::done
    F2["Explainable Auto-fill<br/>+ Load fairness"]:::done
    F3["Schedule builder<br/>assign · lock · publish"]:::done
    F4["My schedule (PWA)"]:::done
    F5["Time off + Request Limit<br/>+ Preferences"]:::done
    F6["Trades: swap · giveaway · pickup<br/>auto-approval"]:::done
    F7["Who's On Call + JSON"]:::done
    F8["Calendar Feed (ICS)"]:::done
    F9["Reports · payroll CSV · time clock"]:::done
    F10["Audit trail · notifications<br/>staff & rule settings"]:::done
  end
  subgraph BACKLOG["v0 backlog tickets"]
    B13["Prod auth + RLS"]:::backlog
    B14["Integration adapters"]:::backlog
    B15["Enterprise modules"]:::backlog
    B16["Review follow-ups<br/>Shift Type CRUD …"]:::backlog
  end
  subgraph DECIDE["Decisions that reshape them"]
    X11["11 Rule catalogue"]:::grilling
    X12["12 Rule authoring UX"]:::prototype
    X13["13 Auto-fill strategy"]:::grilling
    X14["14 Auth, tenancy, residency"]:::grilling
    X15["15 Notification channels"]:::grilling
    X16["16 Mobile delivery"]:::prototype
    X17["17 Integration scope"]:::grilling
    X18["18 Nursing scope"]:::grilling
    X19["19 Credentialing scope"]:::grilling
  end
  V1(["v1 spec → /to-tickets → build"]):::dest
  SPEC0 --> F1 & F2 & F3 & F4 & F5 & F6 & F7 & F8 & F9 & F10
  F1 -.-> X11
  F2 -.-> X13
  F10 -.-> X12
  F4 -.-> X16
  F10 -.-> X15
  F7 -.-> X17
  F9 -.-> X17
  B13 -.-> X14
  B14 -.-> X17
  B15 -.-> X18 & X19
  B16 -.-> X11
  X11 & X12 & X13 & X14 & X15 & X16 & X17 & X18 & X19 --> V1
""" + CLASSES


def card(t, by):
    tl, mode = TYPE[t["type"]]
    name = lambda n: f"{n} · {SHORT[n]}"
    deps = "" if not t["deps"] else '<p class="deps"><span class="lbl">Blocked by</span> ' + ", ".join(
        f'<span class="ref{" done" if by[d]["status"] == "resolved" else ""}">{html.escape(name(d))}</span>' for d in t["deps"]) + "</p>"
    if t["status"] == "resolved":
        bullets = []
        for line in t["answer"].splitlines():
            if line.startswith("- "):
                bullets.append(line[2:].strip())
            elif bullets and line.startswith("  ") and line.strip():
                sub = line.strip().removeprefix("- ")
                bullets[-1] += (" " if bullets[-1].endswith(":") else "; ") + sub
        body = '<ul class="ans">' + "".join(f"<li>{html.escape(re.sub(r'[*`]', '', b))}</li>" for b in bullets[:4]) + "</ul>"
        status = '<span class="pill p-done">Resolved</span>'
    else:
        body = f'<p class="q">{html.escape(t["q"])}</p>{deps}'
        status = f'<span class="pill p-{t["type"]}">{tl} · {mode}</span>'
    return f'<li class="ticket"><div class="thead"><span class="num">{t["n"]}</span><h4>{html.escape(t["title"])}</h4>{status}</div>{body}</li>'


def section_list(title, items, by):
    return f'<div class="col"><h3>{title} <span class="count">{len(items)}</span></h3><ul class="tickets">{"".join(card(t, by) for t in items) or "<li class=empty>None</li>"}</ul></div>'


def map_sections():
    s = open("map.md").read()
    grab = lambda h: re.search(rf"## {h}\n\n(.*?)(?=\n## |\Z)", s, re.S).group(1)
    items = lambda block: [re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(l[2:])) for l in block.splitlines() if l.startswith("- ")]
    dest = re.sub(r"\*\*(.+?)\*\*", r"\1", grab("Destination").split("\n")[0])
    return dest, items(grab("Not yet specified")), items(grab("Out of scope"))


def main():
    tickets = load()
    by = {t["n"]: t for t in tickets}
    decision, frontier, blocked, done = decision_map(tickets)
    dest, fog, oos = map_sections()
    with open("flowchart.md", "w") as f:
        f.write(f"""# Zoe v1 — flowcharts

Generated by `render_map.py` from [map.md](./map.md) and `issues/`. Do not edit by hand.

## Decision map (wayfinder)

Solid arrows are **Blocked by** edges. Colour = ticket type: teal grilling (HITL), blue research (AFK), amber prototype (HITL), violet task, grey resolved.

```mermaid
{decision}
```

## Features & specs → decisions

```mermaid
{FEATURE_MAP}
```
""")
    counts = {k: sum(1 for t in tickets if t["type"] == k and t["status"] != "resolved") for k in TYPE}
    open_frontier = [t for t in frontier if t["n"] != "21"]
    page = f"""<title>Zoe v1 Wayfinding Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&family=JetBrains+Mono:wght@500&display=swap">
{STYLE}
<div class="wrap">
<header>
  <span class="eyebrow">Wayfinder map · clinical workforce scheduling</span>
  <h1>Zoe v1 Wayfinding Map</h1>
  <p class="dest"><b>Destination:</b> {html.escape(dest)}</p>
  <div class="stats">
    <span class="stat"><b>{len(done)}</b> of {len(tickets)} resolved</span>
    <span class="stat"><b>{len(open_frontier)}</b> on the frontier</span>
    <span class="stat"><b>{len(blocked) + (0 if by['21'] in frontier else 1)}</b> blocked</span>
    <span class="stat">open: <b>{counts['grilling']}</b> grilling · <b>{counts['research']}</b> research · <b>{counts['prototype']}</b> prototype · <b>{counts['task']}</b> task</span>
  </div>
</header>
<section>
  <h2>Decision map</h2>
  <p class="lede">Solid arrows mean "blocked by": a ticket opens once every ticket pointing into it is resolved. Grilling and prototype tickets need you in the conversation. Research runs without you. Grey boxes are resolved.</p>
  <div class="legend">
    <span><i class="sw" style="background:#d7ece9;border-color:#0f766e"></i>Grilling (with you)</span>
    <span><i class="sw" style="background:#dfe7f6;border-color:#3b5b9a"></i>Research (agent alone)</span>
    <span><i class="sw" style="background:#f3e3cf;border-color:#a3601b"></i>Prototype (with you)</span>
    <span><i class="sw" style="background:#ece2f3;border-color:#7a4a9a"></i>Task</span>
    <span><i class="sw" style="background:#e4e7ea;border-color:#5b6670"></i>Resolved</span>
    <span><i class="sw" style="background:#fbf0c9;border-color:#a8841a"></i>Provisional</span>
  </div>
  <div class="diagram"><pre class="mermaid">{html.escape(decision)}</pre></div>
</section>
<section>
  <h2>Features and specs, mapped to decisions</h2>
  <p class="lede">What the v0 prototype already does, what is left in its backlog, and which decisions on the map will reshape each feature before v1.</p>
  <div class="diagram"><pre class="mermaid">{html.escape(FEATURE_MAP)}</pre></div>
</section>
<section>
  <h2>Tickets</h2>
  <div class="cols">
    {section_list("Frontier: takeable now", open_frontier, by)}
    {section_list("Blocked", blocked + ([] if by['21'] in frontier else [by['21']]), by)}
    {section_list("Resolved", done, by)}
  </div>
</section>
<section class="notes">
  <div class="col"><h2>Not yet specified</h2><ul>{"".join(f"<li>{x}</li>" for x in fog)}</ul></div>
  <div class="col"><h2>Out of scope</h2><ul>{"".join(f"<li>{x}</li>" for x in oos)}</ul></div>
</section>
<footer>Generated from <code>.scratch/zoe-v1/map.md</code> and <code>.scratch/zoe-v1/issues/</code> by <code>render_map.py</code>. Research findings are in <code>docs/research/</code>. Several of them rest on search summaries only; each file says where.</footer>
</div>
"""
    open("zoe-v1-map.html", "w").write(page)
    print(f"resolved={len(done)} frontier={len(open_frontier)} blocked={len(blocked)}")


if __name__ == "__main__":
    main()
