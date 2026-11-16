# Constraint solvers for Auto-fill at scale: greedy vs CP-SAT, Timefold, MILP, metaheuristics

_Researched 2026-11-16 with the `research` skill (background agent). Network limits: only GitHub (github.com, raw.githubusercontent.com) could be fetched. developers.google.com, docs.timefold.ai, highs.dev, link.springer.com, arxiv.org, schedulingbenchmarks.org, watt.cs.kuleuven.be, gerad.ca and ideas.repec.org did not resolve. Solver facts come from the projects' own source and docs on GitHub (primary). Claims marked **(LC)** rest only on search-result summaries. They are lower confidence; re-verify them before quoting externally._

## Answer

- **Ship greedy in v1.** Zoe's v1 gap-filling pass already respects locks and records why it made each pick. No solver beats it on explanations, and none adds less to the stack. Its weak spot is fairness across the whole period, because each pick is final and nothing goes back to rebalance earlier choices.
- **CP-SAT (OR-Tools, Apache-2.0) is the best fit for a future solver adapter.** It is the strongest open-source CP solver. It models the rules Zoe uses (rest, consecutive days, weekly caps) directly. It can hard-fix Locked Assignments, take hints, and explain infeasibility through assumptions. It has no official Node binding, so it needs a Python sidecar.
- **HiGHS via `highs-js` (MIT, WASM) is the only option that runs in-process in Node.** It is single-threaded, though. A MILP for rest and sequence rules needs many linking constraints, so I expect it to scale worse than CP-SAT at 300 staff × 3 months. That is an inference and still needs a benchmark.
- **Timefold Community (Apache-2.0) is a capable local-search engine with native pinning, but it runs on the JVM.** Its explanation features (Score Analysis and the Recommendation API) are **Enterprise-only (commercial)**. That removes its biggest advantage for Zoe.
- **Gurobi is the fastest MILP solver but has commercial, quote-only licensing.** CBC (EPL-2.0) is in volunteer maintenance. Neither is a good fit for an open-source core.
- **The literature favours exact or hybrid methods.** Exact or hybrid IP methods won both nurse rostering competitions (INRC-I and INRC-II). Pure exact solvers struggle on the largest benchmark instances, where column-generation and metaheuristic hybrids win **(LC)**. None of the top entries was a plain greedy method.
- **When to add the adapter:** add a CP-SAT adapter behind the same Auto-fill interface when a department reports fairness spread (Load max−min or standard deviation, per FTE) above an agreed threshold after greedy runs. Also add it when greedy leaves gaps unfilled that a feasibility check shows could be filled. Keep greedy as the default and as the fallback.

## Findings

### Greedy (today)
Constructive heuristics are fast and easy to explain, but they never revisit an earlier pick. Nurse rostering research has instead been driven by hybrids of IP and local search. The INRC-2010 winner solved sub-problems in sequence with IP and then ran local search over partial schedules (https://econpapers.repec.org/RePEc:eee:ejores:v:219:y:2012:i:2:p:425-433, **LC**). Timefold itself uses a greedy construction heuristic only as a first phase, or for one-off "recommend a fit" queries, and relies on local search for quality (https://github.com/TimefoldAI/timefold-solver/blob/main/docs/src/modules/ROOT/pages/responding-to-change/recommendation-api.adoc). That one-off query is the same job as Zoe's per-gap pick.

### CP-SAT (Google OR-Tools)
- **Licence and languages:** Apache-2.0. The core is C++, with wrappers for Python, Java and C#. There is no official JavaScript binding (https://github.com/google/or-tools). Community WASM ports exist (`cpsat-js`, `or-tools-wasm`), but they are early-stage **(LC)** (https://www.pkgstats.com/pkg:cpsat-js).
- **Solution quality:** CP-SAT won gold in every MiniZinc Challenge 2025 category it entered **(LC)** (https://minizinc.org/challenge/2025/results).
- **Shift scheduling example:** The official example covers hard and soft sequence lengths, weekly sum bounds with linear penalties, forbidden transitions (Night→Morning), fixed assignments and weighted requests. It runs with a default limit of `max_time_in_seconds:10.0` (https://github.com/google/or-tools/blob/stable/examples/python/shift_scheduling_sat.py). These map one-to-one onto Zoe's rules.
- **Re-solving only the gaps:**
  - Locked Assignments can become fixed variables.
  - `add_hint` seeds the search with the existing schedule (https://github.com/google/or-tools/blob/stable/ortools/sat/python/cp_model.py).
  - `fix_variables_to_their_hinted_value` fixes every hinted variable to its hinted value, and `repair_hint` tries to repair an infeasible hint (https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto).
  - The docs say a hint "is not a hard constraint" (https://github.com/google/or-tools/blob/stable/ortools/sat/docs/model.md).
- **Run time and determinism:**
  - `num_workers` sets the thread count, and 0 means use all cores.
  - `interleave_search` makes the search "deterministic (independently of num_workers!)".
  - `max_deterministic_time` gives limits that do not depend on wall-clock speed (https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto).
  - Deterministic runs matter for Zoe's "same input, same output" promise.
- **Explaining infeasibility:** `add_assumptions` combined with `sufficient_assumptions_for_infeasibility` returns a subset of rule literals that together make the model infeasible (https://github.com/google/or-tools/blob/stable/ortools/sat/python/cp_model.py). Zoe could use this to answer "why is this gap unfillable".

### Timefold Solver (ex-OptaPlanner)
- **Licence and editions:** Community is Apache-2.0, for Java and Kotlin (https://github.com/TimefoldAI/timefold-solver). Python support was dropped from 1.25.0 (Aug 2025) and continues only as a community fork **(LC)** (https://pypi.org/project/solverforge-legacy/).
- **Pinning:** "A pinned planning entity doesn't change during solving" (`@PlanningPin`) (https://github.com/TimefoldAI/timefold-solver/blob/main/docs/src/modules/ROOT/pages/domain-modeling/modeling-planning-problems.adoc). Non-disruptive replanning adds a cost to every changed assignment (https://github.com/TimefoldAI/timefold-solver/blob/main/docs/src/modules/ROOT/pages/responding-to-change/non-disruptive-replanning.adoc).
- **Fairness:** `ConstraintCollectors.loadBalance` produces an "unfairness" metric. Lower is fairer, and the value is only comparable within the same dataset (https://github.com/TimefoldAI/timefold-solver/blob/main/docs/src/modules/ROOT/pages/constraints-and-score/load-balancing-and-fairness.adoc).
- **Explanations:**
  - Score Analysis gives per-constraint matches, justifications and indictments (https://github.com/TimefoldAI/timefold-solver/blob/main/docs/src/modules/ROOT/pages/constraints-and-score/understanding-the-score.adoc).
  - The Recommendation API returns candidates ranked by score difference.
  - **Both are in the Enterprise-only feature table**, together with multithreaded solving and nearby selection (https://github.com/TimefoldAI/timefold-solver/blob/main/docs/src/modules/ROOT/pages/commercial-editions/commercial-editions.adoc).

### MILP: HiGHS, CBC, Gurobi
- **HiGHS:** MIT licence. It solves LP, MIP and convex QP, has serial and parallel modes, and has a C/C#/Fortran/Python API (https://github.com/ERGO-Code/HiGHS). It exposes `getIis` (an irreducible infeasible subsystem) for infeasibility explanations (https://github.com/ERGO-Code/HiGHS/blob/master/highs/Highs.h).
- **highs-js:** MIT, v1.15.4. It compiles HiGHS to WebAssembly for Node and the browser. It is **single-threaded** and needs `dispose()` to avoid leaking WASM memory. Models go in as LP or MPS text (https://github.com/lovasoa/highs-js).
- **CBC:** EPL-2.0 and maintained by volunteers. The latest completed release is 2.10.x, and 3.0 is "in preparation" (https://github.com/coin-or/Cbc).
- **Gurobi:** commercial named-user and cloud licences with quote-only pricing. The free academic licences cannot be used commercially **(LC)** (https://www.gurobi.com/pricing/).

### Metaheuristics
Examples are simulated annealing, large neighbourhood search (LNS) and tabu search. They underpin the INRC-II runners-up and the column-generation heuristics that hold best-known solutions on the Curtois instances **(LC)** (https://nrl.northumbria.ac.uk/id/eprint/42639). Building one by hand in TypeScript is feasible, but tuning it is a research project. Timefold or CP-SAT's built-in LNS gives the same benefit without that work.

### (a) Benchmarks: what they say about greedy vs exact
- **INRC-II:** a multi-stage, week-by-week problem with 4- or 8-week horizons. It had 15 submissions and 7 finalists. The winners used a network-flow MILP (Römer & Mellouli) **(LC)** (https://rd.springer.com/content/pdf/10.1007/s10479-017-2623-z.pdf). A branch-and-price/online stochastic method took second prize **(LC)** (https://www.gerad.ca/en/papers/G-2016-78). The code is open (MIT, COIN-OR BCP): https://github.com/legraina/NurseScheduler.
- **Curtois/Burke instances (24, from 8 nurses × 2 weeks upward):** the benchmark paper used branch-and-price and ejection chains **(LC)** (https://econpapers.repec.org/RePEc:eee:ejores:v:237:y:2014:i:1:p:71-81). A commercial MIP solver "was unable to produce solutions on the largest instances", where a column-generation heuristic set best-known values **(LC)** (https://nrl.northumbria.ac.uk/id/eprint/42639).
- **Takeaway:** exact solvers solve small and medium instances to optimality. At large scale, hybrids (decomposition plus local search) win. Plain greedy is not a contender for quality. My inference is that Zoe's sizes (20–300 staff, 1–3 months) fall in the middle of this range and at its upper end.

### (b) Keeping explanations with a solver
1. **Constraint-slack explanations.** Model every Soft rule with an explicit penalty variable. After solving, list for each assignment the rules that are binding or penalised and how much slack each has ("Ana: 2 of 5 shifts/week used, 11 h rest ≥ 10 h min"). Zoe can compute this itself from the solution, so it works with any solver.
2. **Counterfactuals ("why not Bob?").** Re-solve with the assignment Bob→shift forced, then report the objective delta and which rules became violated. Korikov & Beck formalise this with inverse optimization (https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.CP.2021.35), using appointment scheduling as the example **(LC)** (https://www.ijcai.org/proceedings/2021/0564.pdf).
3. **Infeasibility.** Use CP-SAT assumptions or a HiGHS IIS to name the minimal set of conflicting rules for each unfilled gap (sources above).
4. **Hybrid.** Let the solver choose who covers each gap. Then run Zoe's existing greedy ranker on each gap with the solver's choice, and show it as "chosen to balance department Load; best local candidate was X". This keeps the per-pick explanation format Zoe already has.

## Comparison

| | Greedy (today) | CP-SAT | Timefold CE | HiGHS (highs-js) | Gurobi | Hand-rolled metaheuristic |
|---|---|---|---|---|---|---|
| Fairness quality | Locally fair, no global rebalancing | Strong, can prove optimality on mid-size instances | Strong (anytime) | Good if model is tractable | Strongest MILP | Good, needs tuning |
| Run time, 300×90d | ms | Seconds to minutes, time-boxed (to benchmark) | Time-boxed, anytime | Risky single-thread (to benchmark) | Fast | Time-boxed |
| Explainability | Native per pick | Slack, assumptions, counterfactual re-solves | Score Analysis = **Enterprise** | Slack, IIS | Slack, IIS | Custom |
| Respect locks / fill gaps only | Native | Fixed vars, hints | `@PlanningPin` | Fixed bounds | Fixed bounds | Custom |
| Licence | Zoe's own (MIT) | Apache-2.0 | Apache-2.0 (EE commercial) | MIT | Commercial | Zoe's own (MIT) |
| From Node | In-process | Python sidecar (or unofficial WASM) | Java sidecar | In-process WASM | Sidecar plus licence server | In-process |

## Implications for Zoe

- Keep the deterministic greedy Auto-fill as the v1 default. Its per-pick Explanation is a product advantage over QGenda's opaque optimiser (see 0001).
- Define a `Solver` port now (input: draft, Locked Assignments, rules, history; output: assignments plus a structured Explanation per assignment). That way a CP-SAT adapter is purely additive.
- Write the Explanation in terms of rules, slack and counterfactuals, not in solver-specific terms, so the same explanation UI works with any solver.
- Avoid Timefold if its explanation features are the reason to choose it, because they are commercial. Avoid Gurobi for an MIT, self-hostable core.
- A CP-SAT adapter means running a Python sidecar (an HTTP or job-queue worker). That adds deployment surface to self-hosting.

## Open questions for the owner

1. What fairness metric and threshold should trigger the solver: Load range, Load standard deviation, or weekend/night spread?
2. Is a Python sidecar acceptable for self-hosters, or must everything run in Node? If it must, the only option is highs-js, with a scale risk.
3. Should a solver be allowed to move unlocked draft assignments (rebalancing), or only fill Coverage Gaps?
4. What run-time budget do users accept for "Auto-fill a quarter": under 10 s interactive, or a background job?
5. Shall we benchmark greedy against CP-SAT on a synthetic department of 300 staff over 3 months, plus 2–3 Curtois instances, before deciding?

## Sources

- OR-Tools: https://github.com/google/or-tools ; https://github.com/google/or-tools/blob/stable/ortools/sat/python/cp_model.py ; https://github.com/google/or-tools/blob/stable/ortools/sat/sat_parameters.proto ; https://github.com/google/or-tools/blob/stable/ortools/sat/docs/model.md ; https://github.com/google/or-tools/blob/stable/examples/python/shift_scheduling_sat.py
- Timefold: https://github.com/TimefoldAI/timefold-solver (docs under `docs/src/modules/ROOT/pages/`: modeling-planning-problems, non-disruptive-replanning, continuous-planning, load-balancing-and-fairness, understanding-the-score, recommendation-api, commercial-editions)
- HiGHS: https://github.com/ERGO-Code/HiGHS ; https://github.com/lovasoa/highs-js
- CBC: https://github.com/coin-or/Cbc
- Gurobi (LC): https://www.gurobi.com/pricing/
- MiniZinc Challenge 2025 (LC): https://minizinc.org/challenge/2025/results
- INRC-I winner (LC): https://econpapers.repec.org/RePEc:eee:ejores:v:219:y:2012:i:2:p:425-433
- INRC-II (LC): https://rd.springer.com/content/pdf/10.1007/s10479-017-2623-z.pdf ; https://www.gerad.ca/en/papers/G-2016-78 ; https://github.com/legraina/NurseScheduler
- Curtois benchmarks (LC): https://econpapers.repec.org/RePEc:eee:ejores:v:237:y:2014:i:1:p:71-81 ; https://nrl.northumbria.ac.uk/id/eprint/42639
- Counterfactuals (LC): https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.CP.2021.35 ; https://www.ijcai.org/proceedings/2021/0564.pdf
- Timefold Python status (LC): https://pypi.org/project/solverforge-legacy/
- CP-SAT WASM ports (LC): https://www.pkgstats.com/pkg:cpsat-js
