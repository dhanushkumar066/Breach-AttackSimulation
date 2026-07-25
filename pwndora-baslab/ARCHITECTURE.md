# Architecture — PWNDORA BASLab

Problem Statement BSCDS26-EPME-02 · Track T-03 EPME

---

## 1. System shape

Two services, one origin from the browser's point of view.

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│  React 18 SPA · Zustand store · Framer Motion                    │
└───────────────┬──────────────────────────────────────────────────┘
                │ same-origin  /api/*
┌───────────────▼──────────────────────────────────────────────────┐
│  frontend  (nginx:alpine, :80 → host :3000)                      │
│  • serves the hashed Vite build                                  │
│  • SPA history fallback for /session /report /comparison         │
│  • proxy_pass /api/ → http://api:8000/api/                       │
│  • CSP, nosniff, frame-options, referrer-policy                  │
└───────────────┬──────────────────────────────────────────────────┘
                │ docker network
┌───────────────▼──────────────────────────────────────────────────┐
│  api  (python:3.11-slim, uvicorn :8000, non-root)                │
│  routers → services → models                                     │
│  in-memory dict[str, SessionState]                               │
│  data/playbooks.json · data/enterprise-attack-techniques.json    │
└──────────────────────────────────────────────────────────────────┘
```

Because nginx proxies `/api`, the browser never performs a cross-origin request in
the container. CORS on the API exists for the Vite dev server and for embedding
inside the PWNDORA shell, and it is always an explicit origin list.

---

## 2. Backend component map

| Layer | Module | Responsibility |
| --- | --- | --- |
| Entry | `api/main.py` | App wiring, CORS, security headers, startup validation, `/api/health` |
| Routers | `routers/playbooks.py` | `GET /api/playbooks`, `/playbooks/{id}`, `/response-actions` |
| | `routers/sessions.py` | start · current-step · evaluate · advance · report · export · comparison |
| | `routers/mitre.py` | `GET /api/mitre/techniques`, `/mitre/tactics` |
| Services | `services/session_manager.py` | `PlaybookCatalog` (load + validate + project) and `SessionManager` (bounded in-memory store) |
| | `services/scoring_engine.py` | `evaluate_step`, `aggregate_session_score`, `running_score`, `control_status` |
| | `services/report_generator.py` | `build_report`, `build_riskview360_export`, `build_comparison` |
| Models | `models/playbook.py` | `LogEntry`, `Technique`, `Playbook`, `PlaybookMeta`, `MitreTechnique`, `PlaybookLibrary` |
| | `models/session.py` | `Decision`, `StepResult`, `SessionState`, request/response DTOs |
| | `models/report.py` | `TechniqueResult`, `ControlGap`, `ControlEffectivenessReport`, `RiskView360Export`, `ComparisonResult` |
| Data | `data/playbooks.json` | 3 playbooks · 18 techniques · log evidence · indicators · red herrings · Sigma |
| | `data/enterprise-attack-techniques.json` | 679 ATT&CK Enterprise techniques, generated from MITRE's STIX bundle |
| | `data/playbooks.schema.json` | JSON Schema for the playbook library, generated from the Pydantic models |
| Build tools | `data/build_attack_catalog.py` | Downloads the official ATT&CK STIX bundle and regenerates the catalog |
| | `data/build_playbook_schema.py` | Regenerates and validates `playbooks.schema.json` |

Routers hold HTTP concerns only. Every scoring and reporting function is pure, which
is what makes the determinism claim testable in isolation.

---

## 3. The concealment boundary

The single most important design constraint: **the learner must not be able to see
the technique before submitting.** Three mechanisms enforce it.

1. **Projection, not filtering.** `PlaybookCatalog.build_step_response()` constructs a
   `StepResponse` containing only `log_evidence`, `checkbox_options` and
   `response_actions`. The `Technique` object — id, name, tactic, reference
   indicators, Sigma rule — is never handed to a serialiser before submission.
   `PlaybookMeta.from_playbook()` does the same for the selection screen.

2. **Content validation at load.** Sysmon deployments commonly tag rules
   (`RuleName: technique_id=T1003.001,…`). Copying that into the evidence would print
   the answer inside the log the learner is reading. `PlaybookCatalog.load()` rejects
   any log field whose value contains the technique's own id or an ATT&CK rule tag,
   so the whole class of leak fails at startup rather than in review.

3. **Checkbox construction.** True indicators and red herrings are concatenated and
   shuffled with a seed derived from `sha256(session_id:step_index)`. The order is
   stable across refresh (so the UI does not shuffle under the learner) but differs
   between learners, and it carries no signal about correctness.

---

## 4. Session lifecycle and state machine

```
                 POST /session/start
                        │  creates ULID, step_index=0, status=pending
                        ▼
              ┌──► [step pending] ──────────────┐
              │            │                    │ POST /advance → 403
              │            │ POST /evaluate     │ (nothing submitted yet)
              │            ▼                    │
              │     [step submitted]  ──────────┘
              │            │  answer key + Sigma revealed in the response
              │            │ POST /advance
              │            ▼
              └──── step_index+1 (while step_index < total-1)
                           │
                           │ advance on the final step
                           ▼
                      [completed]  → GET /report
                                   → GET /export/riskview360
                                   → GET /comparison?compare_with=…
```

`SessionState` carries `session_id`, `playbook_id`, `current_step_index`,
`step_status`, the accumulated `step_results`, `completed`, timestamps and an optional
`base_session_id` linking a re-run to its original.

**Guards:** `advance` before `evaluate` → `403`. `evaluate` twice on one step →
`409`. `report` or `export` before completion → `409`. Unknown or malformed session
id → `404`, indistinguishable from each other. Indicators that were not offered for
the step → `422`.

**Storage:** a process-local `dict` behind a `threading.Lock`, capped at 500 sessions
with a 6-hour TTL and oldest-first eviction. No database, by design — nothing a
learner submits outlives the process.

---

## 5. Scoring

```python
technique_score  = 1.0 if decision.technique_id == technique.technique_id else 0.0
indicator_score  = |submitted ∩ reference| / |submitted ∪ reference|      # Jaccard
response_score   = 1.0 if decision.response_action == correct_action else 0.0

step_score = 0.40*technique_score + 0.35*indicator_score + 0.25*response_score
```

Jaccard rather than plain recall is deliberate: it penalises the learner for
selecting red herrings as well as for missing true indicators, so "tick everything"
is a losing strategy. On a step with 5 true indicators, ticking all 9 options scores
0.556 on Part B; ticking only the 5 correct ones scores 1.0.

`aggregate_session_score` averages step scores over the whole playbook.
`running_score` — used by the live header ticker — divides by *total* steps rather
than graded steps, so the number climbs monotonically instead of jumping around.

---

## 6. Data flow for one step

```
  BASSession mounts
        │
        │ store.currentLogEvidence, currentCheckboxOptions
        ▼
  LogViewer ── tabs by channel ──────────► learner reads evidence
  DetectionForm ── Part A/B/C ──────────► store.selected{TechniqueId,Indicators,ResponseAction}
        │
        │ submitDetection()
        ▼
  POST /api/session/{id}/evaluate
        │
        │ scoring_engine.evaluate_step()  (pure)
        ▼
  StepResult { scores, breakdown, technique identity, matched/missed, sigma }
        │
        ├─► store.lastStepResult  → StepFeedback overlay + TechniqueReveal
        ├─► store.stepHistory     → StepProgress rail (tactic labels appear here only)
        └─► store.runningScore    → Header ticker
        │
        │ advanceStep()
        ▼
  POST /api/session/{id}/advance → next StepResponse, or completed → /report
```

---

## 7. Frontend structure

```
src/
├── main.tsx · App.tsx           React Router; report + comparison lazy-loaded
├── store/useBASLabStore.ts      Zustand + Immer — the only mutable app state
├── api/client.ts                typed fetch wrappers, ApiError, same-origin
├── types/baslab.ts              1:1 mirrors of the Pydantic response models
├── components/
│   ├── ui/                      GlassPanel · CyberBadge · GlowButton · ScoreRing · SigmaViewer
│   ├── layout/                  Header (timer, live score) · StepProgress (kill-chain rail)
│   ├── session/                 LogViewer · DetectionForm · StepFeedback · TechniqueReveal
│   └── report/                  TechniqueResultRow · GapSummary · SigmaRecommendations · ComparisonPanel
└── pages/                       PlaybookSelector · BASSession · ReportPage · ComparisonPage
```

The store never derives an answer locally. Correctness, missed indicators and Sigma
content all arrive from the backend after submission, so nothing in the bundle can be
read to shortcut the exercise.

**Bundle strategy.** `manualChunks` splits react / framer-motion / recharts /
syntax-highlighter, and the report and comparison routes are `React.lazy`. The
playbook library and session console — the two screens a learner starts on — load
without pulling in the 372 kB chart chunk. `PrismLight` registers only YAML and JSON
instead of every Prism grammar, which alone removed ~700 kB.

---

## 8. Rendering the evidence

`LogViewer` builds its tabs from the channels actually present in the step, so a step
with no Sysmon record shows no Sysmon tab, and the IIS access-log tab appears only for
web-tier techniques. Field names in `CRITICAL_FIELDS` render cyan; values matching a
suspicion heuristic (`-enc`, `lsass.exe`, `0x1fffff`, known-bad IPs, `.locked`, …)
render amber. Line numbers run continuously across the records in a tab, and the Raw
JSON tab shows the exact payload the API returned.

---

## 9. Deliberate non-goals

Scoped out because they belong to problem statement DILE-02, not this one: the
drag-and-drop timeline canvas, evidence pool, D3 causal-link visualiser, weighted
Kendall-Tau sequence scoring and the incident-reconstruction mechanic. Also excluded:
React Three Fiber, `@dnd-kit`, any paid or runtime API call, and any database.
