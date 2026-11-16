# Vendored agent skills

These skills are vendored verbatim from [mattpocock/skills](https://github.com/mattpocock/skills)
(commit `5863806dd4e15c63174bee4e7515a4256792ecfa`), MIT licensed — see `LICENSE-mattpocock-skills`.

They drive the development workflow of **Evenly** (see `/CLAUDE.md`):

| Stage | Skill | Output in this repo |
| --- | --- | --- |
| Setup (once) | `/setup-matt-pocock-skills` | `docs/agents/*`, `## Agent skills` in `CLAUDE.md` |
| Research | `research` | `docs/research/*.md` |
| Alignment | `/grill-with-docs` → `grilling` + `domain-modeling` | `GLOSSARY.md`, `docs/adr/*` |
| Roadmap (multi-session) | `/wayfinder` → map of decision tickets | `.scratch/<effort>/map.md`, `.scratch/<effort>/issues/*` |
| Spec | `/to-spec` | `.scratch/<feature>/spec.md` |
| Tickets | `/to-tickets` | `.scratch/<feature>/issues/NN-*.md` |
| Build | `/implement` → `tdd` at agreed seams, `codebase-design` | `evenly/src/**` + tests |
| Review | `code-review`, `/improve-codebase-architecture` | review notes, new tickets |
| Bugs | `diagnosing-bugs` | regression tests |

To update: re-copy from upstream (or `npx skills@latest update`) and bump the commit above.
