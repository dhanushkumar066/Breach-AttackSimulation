# PWNDORA BASLab — Breach & Attack Simulation Training Module

**Track:** T-03 EPME (Enterprise Product Module Extension)
**Problem Statement:** BSCDS26-EPME-02
**Event:** BrewingSec CyberDev Summit 2026 · KGiSL / KiTE Campus, Coimbatore
**Target product:** [PWNDORA](https://pwndora.net) by BlackPerl DFIR Pvt. Ltd.

A learner picks an attack playbook. The backend reveals **one ATT&CK technique at a
time — with the technique identity hidden** — and shows only the Windows Security and
Sysmon telemetry that technique would generate. The learner makes a three-part
detection decision, the backend grades it deterministically, and after the final step
produces a **Control Effectiveness Report** with a RiskView360-compatible export.

---

## Quick start

```bash
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| Frontend | http://localhost:3000 | nginx serving the built SPA, proxying `/api` |
| API | http://localhost:8000/api/health | FastAPI |
| API docs | http://localhost:8000/docs | Interactive OpenAPI |

Both containers expose healthchecks; `frontend` waits for `api` to report healthy.

### Running without Docker

```bash
python -m venv .venv && .venv/Scripts/activate
pip install -r api/requirements.txt
uvicorn api.main:app --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000`, so the browser stays
single-origin in dev exactly as it does in the container.

> **Windows note:** npm scripts fail if the checkout path contains an `&`
> (cmd.exe splits the `node_modules\.bin` PATH entry at the ampersand). Either clone
> to a path without `&`, or use Docker, where the in-container path is always clean.
> Direct invocation — `node node_modules/vite/bin/vite.js build` — works regardless.

---

## The mechanic

1. **Select a playbook** — three campaigns, six techniques each, in kill-chain order.
2. **Read the evidence** — a log console with Windows Security / Sysmon / Raw JSON
   tabs, line numbers, cyan field names and amber suspicious values.
3. **Decide** (three parts, all required):
   - **A — Technique:** searchable dropdown over all 679 ATT&CK Enterprise techniques,
     built from MITRE's published dataset (see *ATT&CK data provenance* below).
   - **B — Indicators:** checklist mixing that step's true indicators with plausible
     red herrings, in a session-specific order. Nothing marks which is which.
   - **C — Response:** one of seven containment actions.
4. **Get graded and coached** — an overlay reveals the technique, the per-part score
   breakdown, which indicators you missed, which red herrings you fell for, and the
   Sigma rule that would have caught it. The *Detection Coach* then explains, for each
   of the three parts, what went wrong, why it happened and what habit prevents a
   repeat (see *Detection Coach* below).
5. **Advance** — the next technique stays locked until the current one is submitted
   (the API answers `403` if you try).
6. **Report** — detection rate, per-technique control status, control gaps with
   remediation, Sigma rules to deploy, and the RiskView360 JSON export.
7. **Watch the replay** — the report carries an *Attack Replay*: a play/pause
   walkthrough of how the intrusion actually unfolded, stage by stage, marking which
   stages you caught and what control would have stopped each one.
8. **Run Again** — the second run links to the first, and the comparison view shows a
   per-technique delta table and grouped bar chart.

### Scoring

```
step_score = 0.40 × technique_correct
           + 0.35 × indicator_jaccard      (|submitted ∩ reference| / |submitted ∪ reference|)
           + 0.25 × response_correct        (weights sum to 1.00)

session_score  = mean(step_scores) × 100
detection_rate = techniques_correctly_identified / total × 100
```

Control status per technique:

| Status | Condition |
| --- | --- |
| `DETECTED` | technique correct **and** step_score ≥ 0.75 |
| `PARTIALLY_DETECTED` | technique correct **and** step_score < 0.75 |
| `MISSED` | technique incorrect |

---

## Judge test walkthrough

### 1. Confirm the content loaded

```bash
curl -s http://localhost:8000/api/health
```

Expect `playbooks: 3`, `techniques: 18`, `mitre_techniques: 679`.

### 2. Run a playbook in the UI

Open http://localhost:3000 and start **Operation Midnight Strike** (APT29, Hard).

**Step 1 produces exactly these scores** — the evidence is Security EID 4688 and
Sysmon EID 1 showing `powershell.exe` spawned by `WINWORD.EXE` with `-Enc -W Hidden`:

| What you submit | Expected step score |
| --- | --- |
| `T1566.001` + **all five** true indicators + `Isolate Host` | **100.0** (0.40 / 0.35 / 0.25) |
| `T1566.001` + these three indicators + `Isolate Host` | **86.0** (Jaccard 0.6 → 0.21) |
| `T1566.001` + those three indicators + `Alert SOC Only` | **61.0** (response 0.00) |

The "three indicators" row means exactly:

- `ParentImage ends with 'WINWORD.EXE'`
- `CommandLine contains '-Enc' (base64-encoded payload)`
- `Security EID 4688 NewProcessName: powershell.exe spawned by an Office application`

Selecting a red herring **lowers** the score — it enlarges the Jaccard union. Adding
one red herring to those three gives Jaccard 0.5 and a step score of 82.5.

### 3. Verify determinism

Start a second session on the same playbook and submit the identical answers. Every
`step_score`, the `session_score` and the `detection_rate` are byte-identical — no
randomness, no clock reads, no ordering effects anywhere in `scoring_engine.py`.

Re-submitting the *same* step is refused with `409` so a learner cannot iterate
towards the answer; determinism is verified by replaying the run, not the step.

### 4. Verify the step gate

```bash
SID=$(curl -s -X POST http://localhost:8000/api/session/start \
  -H 'Content-Type: application/json' \
  -d '{"playbook_id":"pb-apt29-midnight-strike"}' | python -c "import sys,json;print(json.load(sys.stdin)['session_id'])")

curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/session/$SID/advance
# 403 — the current step has not been evaluated

curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/session/$SID/report
# 409 — the run is not complete
```

### 5. Verify the evidence hides the answer

```bash
curl -s http://localhost:8000/api/session/$SID/current-step | grep -c T1566
# 0 — no technique id, name, tactic or Sigma rule is present before submission
```

The API refuses to start if any log field leaks its own technique id: real Sysmon
configs tag rules with `technique_id=…`, which would hand the learner the answer, so
`session_manager.py` rejects that at load time.

### 6. Inspect the RiskView360 export

Finish a run, then use **Export RiskView360 JSON** on the report page, or:

```bash
curl -s http://localhost:8000/api/session/$SID/export/riskview360
```

Schema: `schema_version`, `source`, `export_timestamp`, `session_reference`,
`playbook_name`, `overall_detection_rate`, `session_score`, `attack_coverage[]`,
`control_gaps[]`, `recommended_training[]`.

---

## Content accuracy

18 techniques across 3 playbooks, each with 2–4 log records using the correct
channels and event IDs:

| Playbook | Actor | Difficulty | Kill chain |
| --- | --- | --- | --- |
| Operation Midnight Strike | APT29 | Hard | T1566.001 → T1059.001 → T1055.001 → T1003.001 → T1078 → T1021.002 |
| LockBit Ransomware Kill Chain | LockBit 3.0 | Moderate | T1190 → T1059.003 → T1112 → T1490 → T1486 → T1041 |
| Silent Web Breach & Data Exfiltration | Unnamed APT | Moderate | T1190 → T1505.003 → T1552.001 → T1078 → T1005 → T1048.003 |

Event IDs in use — Security: 4624, 4656, 4663, 4672, 4688, 4769, 5140, 7045;
Sysmon: 1, 3, 7, 8, 10, 11, 13. IIS W3SVC access-log records carry `event_id: 0`
because access logs are not EVTX records; the log viewer renders them under their own
tab with a `W3SVC ACCESS` badge.

Every technique ships a complete Sigma v2 rule with a unique UUID v4 `id`. All 18 are
parsed at startup and every `condition` is checked to reference only detection blocks
that are actually defined.

### ATT&CK data provenance

The Part A dropdown is **not** hand-authored. `api/data/enterprise-attack-techniques.json`
is generated from MITRE's officially published STIX 2.1 bundle:

```bash
python api/data/build_attack_catalog.py           # fetch and regenerate
python api/data/build_attack_catalog.py --check   # verify without writing
```

It yields **679 techniques** (211 base + 468 sub-techniques) across all 14 tactics,
carrying MITRE's own names, tactic placements and descriptions.

Two deliberate choices:

- **Build time, not run time.** The generated JSON is committed and bundled, so the
  running module still makes zero external calls during judging. Re-run the script
  only when you want a newer ATT&CK release.
- **Pinned to ATT&CK v17.1.** ATT&CK v18 split *Defense Evasion* into the new *Stealth*
  and *Defense Impairment* tactics. The problem statement and the playbooks both use
  the Defense Evasion vocabulary, so pinning keeps the tactic shown in the dropdown
  identical to the one revealed after submission. `--latest` tracks the current
  release instead; both v18 tactic names are already mapped.

The script refuses to overwrite the catalog if any playbook technique is absent from
the release being ingested, so an upstream revocation fails the build loudly instead
of leaving a technique the learner could never select.

### Detection Coach — explaining the mistake, not just marking it

Scoring says *what* was wrong. The coach says *why it happened* and *what to change*,
which is the only part a learner can act on. Every graded step returns three
diagnoses — one per decision part — each with a headline, a cause and a fix, plus a
single takeaway drawn from whichever part cost the most marks.

A learner who picks a Persistence technique for the phishing stage, ticks one decoy
and under-responds gets:

```
TECHNIQUE   Wrong kill-chain phase: T1547.001 (Registry Run Keys / Startup Folder)
            is Persistence; this stage is Initial Access.
    why     You read this as persistence, but the evidence is about initial access:
            ParentImage ends with 'WINWORD.EXE'.
    fix     Before naming a technique, name the phase.

INDICATORS  4 of 5 indicators missed and 1 decoy selected.
    why     Everything you missed sits in command-line content, while you did read
            process ancestry — the gap is a whole class of telemetry, not a detail.
            Medium is the default integrity level for an ordinary user process;
            elevation shows as High or System, so that option's reasoning is inverted.
    fix     For each option ask whether the parenthetical claim is actually true.

RESPONSE    You chose Alert SOC Only; the stage called for Isolate Host.
    why     Alert SOC Only creates a ticket but changes nothing on the host. Code has
            already executed from a document the user opened.
    fix     Ask what the adversary keeps if you take your action.
```

Two layers produce this, and neither is a model:

- **Derived** — the technique diagnosis compares the learner's pick against the real
  one *using the MITRE catalog*: same tactic, same technique family, or wrong
  kill-chain phase. That covers all 679 possible wrong answers without anyone having
  to anticipate them. The indicator diagnosis classifies each indicator into a signal
  family (process ancestry, command-line, network, file, registry, authentication,
  cross-process access) and names the family the learner never read — a blind spot,
  not a list.
- **Authored** — 72 decoy explanations and 18 response rationales live in
  `playbooks.json` beside the content they explain, because a misconception like
  *"%%1936 means full administrator token"* deserves a precise correction rather than
  a generated approximation.

The same reasoning as the replay applies: deterministic, offline, and factually
correct about Windows internals — three properties a bundled language model would
have cost. The coach runs strictly *after* `evaluate_step` and never feeds back into
it, so the score remains a pure function of the decision.

### Attack Replay — and why it is not machine learning

The report carries a play/pause walkthrough of how the intrusion unfolded, stage by
stage. It is worth being explicit about what generates it, because "simulate the
attack" sounds like a modelling problem and is not one here.

Every hop shown is **read directly out of log fields the learner has already seen**:

| Rendered as | Read from |
| --- | --- |
| `WINWORD.EXE spawned powershell.exe` | Sysmon EID 1 `ParentImage` → `Image`, Security EID 4688 `ParentProcessName` → `NewProcessName` |
| `powershell.exe injected into explorer.exe` | Sysmon EID 8 `SourceImage` → `TargetImage`, `StartAddress` |
| `explorer.exe accessed lsass.exe` | Sysmon EID 10 `TargetImage`, `GrantedAccess` |
| `WS-FINANCE-04 authenticated to DC-CORP-01` | Security EID 4624 `IpAddress`, `WorkstationName`, `LogonType` |
| `10.10.10.88 mounted \\*\ADMIN$` | Security EID 5140 `ShareName`, `ShareLocalPath` |

That is parsing, not prediction. Consequences that matter for judging:

- **Deterministic.** The same session always yields byte-identical replay JSON,
  verified across all three playbooks — so it cannot undermine the scoring guarantee.
- **Offline.** No model, no inference, no API call. `api/services/attack_replay.py`
  imports nothing beyond the existing models.
- **Unscored and read-only.** It is generated only for a *completed* run, from
  evidence already revealed, and nothing on this path touches a score. The learner
  never builds or orders anything — this is per-step feedback, deliberately not the
  incident-reconstruction mechanic that belongs to DILE-02.

```bash
curl -s http://localhost:8000/api/session/$SID/replay   # 409 until the run completes
```

### Playbook schema

`api/data/playbooks.schema.json` is a JSON Schema (draft 2020-12) for the playbook
library, generated from the same Pydantic models the API validates against at
startup, so the published contract cannot drift from the enforced one:

```bash
python api/data/build_playbook_schema.py           # regenerate
python api/data/build_playbook_schema.py --check   # validate playbooks.json against it
```

Rules that JSON Schema cannot express — technique must exist in the ATT&CK catalog,
indicator pools must be disjoint, Sigma must parse, no log field may leak its own
technique id — are enforced by `PlaybookCatalog.load()` and documented inline in the
schema's `description` fields.

---

## Security by design

- **No secrets.** Nothing is hardcoded and nothing is read from a secret store —
  the module has no credentials to hold.
- **No runtime egress.** All content is bundled; the module never calls out. There is
  no webfont link either, so the UI renders identically offline.
- **CORS is explicit.** `BASLAB_CORS_ORIGINS` lists exact origins; the API refuses to
  start if it is set to `*`.
- **Every input validated.** Pydantic v2 models with `extra="forbid"`, regex-bound
  technique ids, `Literal`-typed response actions, and length caps on all collections.
- **Session handles are ULIDs**, validated for shape before the store is touched, so
  the API cannot be used to enumerate live sessions.
- **Submitted indicators are checked against what the server actually offered**, so a
  crafted client cannot post the reference indicators it never saw.
- **The store is bounded** — 500 sessions max, 6-hour TTL, oldest-first eviction — so
  repeated `session/start` calls cannot exhaust memory.
- **Containers drop privileges** (the API runs as a non-root user) and nginx sets
  CSP, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`.
- **Answer-key content is mounted read-only** so a running container cannot rewrite it.

## Tech stack

**Backend** — Python 3.11, FastAPI 0.115, Pydantic v2, uvicorn, python-ulid, PyYAML.
In-memory session store; no database.

**Frontend** — React 18 + TypeScript 5.6, Vite 5, Zustand + Immer, Tailwind CSS 3,
Framer Motion, Lucide, Recharts, react-select, react-syntax-highlighter.

**Infrastructure** — Docker multi-stage builds, docker-compose, nginx reverse proxy
and SPA host.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and
[PWNDORA_INTEGRATION.md](PWNDORA_INTEGRATION.md) for the platform integration surface.

## Verification status

- Backend: 54 end-to-end assertions pass — technique concealment, the 403/409 guards,
  deterministic replay, perfect/zero runs, report and RiskView360 schemas, comparison.
- `playbooks.json` validates against the published JSON Schema; the ATT&CK catalog
  validates as containing every technique the playbooks reference.
- Frontend: `tsc --noEmit` clean; production build succeeds (~934 kB across five
  chunks, report and comparison routes lazy-loaded).
- All four screens were driven in a browser against the live API: playbook library,
  session console, Control Effectiveness Report and run comparison.
- `docker compose up` was **not** executed — Docker is not installed on the machine
  this was built on. Both services were run natively instead (uvicorn + the built
  bundle behind a proxy that mirrors `nginx.conf`).
