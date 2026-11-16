STYLE = r"""
<style>
/* Layout: one reading column; diagrams break out to full width in their own scroll boxes. */
:root {
  --bg: #f6f8f8; --surface: #ffffff; --fg: #15201f; --muted: #5a6866; --line: #dbe3e2;
  --accent: #0f766e; --accent-soft: #d7ece9;
  --research: #3b5b9a; --research-soft: #dfe7f6; --proto: #a3601b; --proto-soft: #f3e3cf; --task: #7a4a9a; --task-soft: #ece2f3;
  --display: "Space Grotesk", "Inter", system-ui, sans-serif; --body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0f1615; --surface: #162120; --fg: #e6eeed; --muted: #9db0ad; --line: #26403c;
  --accent: #5cc8bb; --accent-soft: #163b37; --research: #9db6ea; --research-soft: #1d2a45; --proto: #e7a865; --proto-soft: #3b2814; --task: #c9a3e6; --task-soft: #2f2140; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0f1615; --surface: #162120; --fg: #e6eeed; --muted: #9db0ad; --line: #26403c;
  --accent: #5cc8bb; --accent-soft: #163b37; --research: #9db6ea; --research-soft: #1d2a45; --proto: #e7a865; --proto-soft: #3b2814; --task: #c9a3e6; --task-soft: #2f2140; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 15px; line-height: 1.55; }
.wrap { max-width: 1120px; margin: 0 auto; padding-block: 40px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 40px; }
h1, h2, h3, h4 { font-family: var(--display); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(28px, 4vw, 40px); letter-spacing: -0.02em; }
h2 { font-size: 22px; }
h4 { font-size: 15px; font-weight: 600; font-family: var(--body); }
p { margin: 0; }
.eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
header { display: grid; gap: 14px; }
.dest { border-left: 3px solid var(--accent); padding: 10px 16px; background: var(--accent-soft); border-radius: 0 8px 8px 0; max-width: 72ch; }
.stats { display: flex; flex-wrap: wrap; gap: 8px; }
.stat { font-size: 13px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-variant-numeric: tabular-nums; }
.stat b { font-weight: 600; }
section { display: grid; gap: 14px; min-width: 0; }
.lede { color: var(--muted); max-width: 75ch; }
.diagram { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; overflow-x: auto; }
.diagram pre.mermaid { margin: 0; min-width: 720px; background: #ffffff; border-radius: 8px; padding: 12px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 24px; align-items: start; }
.col { display: grid; gap: 10px; min-width: 0; align-content: start; }
.count { font-family: var(--mono); font-size: 13px; color: var(--muted); font-weight: 500; }
.p-done { background: var(--line); color: var(--muted); }
.ans { margin: 0; padding-left: 18px; font-size: 13px; color: var(--muted); display: grid; gap: 4px; }
.empty { color: var(--muted); font-size: 14px; }
ul.tickets { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.ticket { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; min-width: 0; }
.thead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.thead h4 { flex: 1 1 200px; min-width: 0; }
.num { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.pill { font-size: 11px; font-weight: 600; letter-spacing: .03em; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.p-grilling { background: var(--accent-soft); color: var(--accent); }
.p-research { background: var(--research-soft); color: var(--research); }
.p-prototype { background: var(--proto-soft); color: var(--proto); }
.p-task { background: var(--task-soft); color: var(--task); }
.q { font-size: 13.5px; color: var(--muted); }
.deps { font-size: 12.5px; }
.lbl { font-weight: 600; margin-right: 4px; }
.ref.done { opacity: .55; text-decoration: line-through; }
.ref { display: inline-block; padding: 0 6px; border: 1px dashed var(--line); border-radius: 6px; margin: 2px 2px 0 0; }
.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 24px; }
.notes ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--muted); font-size: 14px; }
.notes b { color: var(--fg); font-weight: 600; }
footer { font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 16px; }
code { font-family: var(--mono); font-size: 12.5px; }
</style>
"""
