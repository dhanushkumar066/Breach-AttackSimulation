# PWNDORA Integration Guide — BASLab Module

How BASLab plugs into the PWNDORA platform as an EPME (Enterprise Product Module
Extension). Problem Statement BSCDS26-EPME-02.

---

## 1. Positioning

PWNDORA today runs hands-on DFIR labs: the learner investigates an incident that has
already happened. BASLab adds the other half of the loop — **did your controls catch
it while it was happening?** — by replaying an adversary kill chain step by step and
scoring the learner's detection decisions against a fixed answer key.

It is additive, not invasive: no PWNDORA schema changes are required to run it, and
the output is a report object the platform can store, list and export.

---

## 2. API surface

Base path `/api`. Every endpoint is JSON in / JSON out, no authentication of its own
(see §5).

| # | Method | Path | Purpose |
| --- | --- | --- | --- |
| 1 | `GET` | `/api/health` | Liveness plus bundled-content counts |
| 2 | `GET` | `/api/playbooks` | Playbook metadata — no answer key |
| 3 | `GET` | `/api/playbooks/{playbook_id}` | One playbook's metadata |
| 4 | `GET` | `/api/response-actions` | The seven valid Part C actions |
| 5 | `GET` | `/api/mitre/techniques?search=&tactic=&limit=` | ATT&CK catalog for the Part A dropdown |
| 6 | `GET` | `/api/mitre/tactics` | Distinct tactic names |
| 7 | `POST` | `/api/session/start` | Create a run; returns the first step |
| 8 | `GET` | `/api/session/{id}/current-step` | Current evidence, technique withheld |
| 9 | `POST` | `/api/session/{id}/evaluate` | Grade the three-part decision |
| 10 | `POST` | `/api/session/{id}/advance` | Next step, or completion |
| 11 | `GET` | `/api/session/{id}/report` | Control Effectiveness Report |
| 12 | `GET` | `/api/session/{id}/export/riskview360` | RiskView360 JSON export |
| 13 | `GET` | `/api/session/{id}/replay` | Kill-chain replay of how the attack unfolded |
| 14 | `GET` | `/api/session/{id}/comparison?compare_with={id}` | Run-over-run delta |

Interactive OpenAPI at `/docs`; the machine-readable schema at `/openapi.json` can be
fed straight into PWNDORA's API gateway registry.

### Status codes the platform should handle

| Code | Meaning |
| --- | --- |
| `403` | `advance` attempted before the current step was evaluated |
| `409` | step already evaluated · report/export requested mid-run · session already complete |
| `422` | validation failure, including indicators never offered for that step |
| `404` | unknown or malformed session id, or unknown playbook |

---

## 3. UI embedding

The frontend is a self-contained SPA with three routes beyond the entry point:
`/session`, `/report`, `/comparison`. There are two supported embedding modes.

**Mode A — route mount (recommended).** Mount the built assets under a PWNDORA path
such as `/labs/baslab` and point that path's `/api` prefix at the BASLab API. The
SPA uses relative `/api` calls only, so no build-time API base URL is required; set
`base` in `vite.config.ts` if the module is not served from the domain root.

**Mode B — iframe.** `nginx.conf` ships `X-Frame-Options: SAMEORIGIN` and
`frame-ancestors 'self'`. To embed from a different PWNDORA origin, change both to
name that origin explicitly — do not remove them.

**Entry point.** The natural launch surface is a card in the PWNDORA lab catalogue.
`GET /api/playbooks` already returns everything such a card needs: `name`,
`threat_actor`, `difficulty`, `description`, `technique_count`, `tactics[]`.

**Theme.** The design tokens in `tailwind.config.js` (obsidian `#030712`, surface
`#0f172a`, cyan `#06b6d4`, amber `#f59e0b`) and the `.glass-panel` component class in
`index.css` are the only styling contract. Re-point those to PWNDORA's tokens and the
module inherits the platform's look without touching component code.

---

## 4. RiskView360 integration

`GET /api/session/{id}/export/riskview360` emits:

```json
{
  "schema_version": "1.0",
  "source": "PWNDORA BASLab",
  "export_timestamp": "2026-07-25T06:31:44.512381+00:00",
  "session_reference": "01KYC2GP0TZAFA8XNE8AVD7MK0",
  "playbook_name": "Operation Midnight Strike",
  "overall_detection_rate": 83.33,
  "session_score": 71.25,
  "attack_coverage": [
    { "technique_id": "T1566.001", "tactic": "Initial Access", "detected": true, "control_status": "DETECTED" }
  ],
  "control_gaps": [
    {
      "technique_id": "T1003.001",
      "technique_name": "LSASS Memory",
      "tactic": "Credential Access",
      "gap_reason": "Technique not identified (submitted T1078, actual T1003.001); 3 of 5 indicators missed",
      "recommended_control": "Enable Credential Guard and LSA Protection (RunAsPPL); deploy Sysmon EID 10 alerting …",
      "sigma_rule_title": "Detect LSASS Memory Access via Process Access"
    }
  ],
  "recommended_training": ["PWNDORA Lab: LSASS Forensics"]
}
```

`attack_coverage[]` maps directly onto an ATT&CK navigator layer or a RiskView360
coverage heatmap: one row per kill-chain step, carrying the tactic for column
placement and `control_status` for the cell colour.

`recommended_training[]` is the platform hook — each entry names a PWNDORA lab keyed
to the technique that was missed, so RiskView360 can turn a detection gap into an
enrolment. The mapping lives in `RECOMMENDED_TRAINING` in
`api/services/report_generator.py`; replace those strings with real PWNDORA lab slugs
or ids at integration time. `RECOMMENDED_CONTROLS` in the same module holds the
remediation text and can be re-pointed at BlackPerl's control library.

---

## 5. Security considerations

**BASLab ships no authentication of its own, by design.** The ULID session id is the
capability for a run: unguessable (128 bits), shape-validated before the store is
touched, and unknown-vs-malformed ids return the same `404`. That is appropriate for
a module mounted *behind* PWNDORA's session layer. Before exposing it publicly:

1. **Terminate auth at the platform edge.** Require an authenticated PWNDORA session
   on `/labs/baslab/*` and pass the learner identity as a trusted header. Bind
   `SessionState` to that identity and reject mismatches in `_load_session()`.
2. **Rate-limit `POST /api/session/start`.** The store is bounded (500 sessions,
   6-hour TTL, oldest-first eviction) so it cannot be exhausted, but eviction under
   load would drop other learners' in-flight runs.
3. **Set `BASLAB_CORS_ORIGINS`** to the exact PWNDORA origin. The API refuses to
   start on `*`.

Already handled in-module:

| Concern | Treatment |
| --- | --- |
| Input validation | Pydantic v2, `extra="forbid"`, regex-bound technique ids, `Literal` response actions, length caps |
| Answer-key leakage | Response projection; startup rejection of log fields carrying the technique id |
| Client-side cheating | Submitted indicators are validated against what the server offered for that step |
| Step skipping | `advance` returns `403` until the step is evaluated |
| Answer iteration | Re-evaluating a graded step returns `409` |
| Secrets | None exist anywhere in the module |
| Runtime egress | None — all content bundled, no webfont, no CDN, CSP `default-src 'self'` |
| Container privilege | API runs as non-root; playbook data mounted read-only |
| Transport headers | nginx sets CSP, `nosniff`, frame-options, referrer-policy; API adds `no-store` |

**Dependency surface:** five runtime Python packages (fastapi, uvicorn, pydantic,
python-ulid, PyYAML), all pinned. No cryptography, no ORM, no network client.

---

## 6. Data storage requirements

**Today: none.** Sessions live in a process-local dict; nothing is persisted, so a
restart clears all state and no learner data is retained.

To persist runs on the platform, store the completed report — it is a closed,
self-describing document. A minimal schema:

| Column | Source |
| --- | --- |
| `session_id` (PK) | `report.session_id` (ULID, already sortable by creation time) |
| `learner_id` | PWNDORA identity from the auth layer |
| `playbook_id`, `playbook_name`, `threat_actor` | `report.*` |
| `session_score`, `overall_detection_rate` | `report.*` |
| `techniques_detected`, `total_techniques` | `report.*` |
| `completed_at` | `report.completed_at` (ISO 8601, UTC) |
| `report_json` | the full `ControlEffectivenessReport` |
| `base_session_id` | links a re-run to its original, for the comparison view |

Write once, on completion — there is no partial-progress requirement, because an
unfinished run has no report. Estimated size is a few kB per run; the Sigma YAML in
`sigma_recommendations[]` dominates and can be dropped from the stored copy and
re-derived from `playbooks.json` if space matters.

The seam to change is `SessionManager` in `api/services/session_manager.py`: it
already isolates `create_session` / `get_session` / `update_session` / `delete_session`
behind a lock, so swapping the dict for Redis or Postgres touches that class only.

---

## 7. Content authoring

`api/data/playbooks.json` is mounted read-only into the container and can be extended
without touching code. Each technique object needs:

`technique_id` · `technique_name` · `tactic` · `description` · `log_evidence[]`
(2–4 records: `channel`, `event_id`, `timestamp`, `computer`, `fields{}`) ·
`reference_indicators[]` (≥3) · `red_herring_indicators[]` (≥2) ·
`correct_response_action` (one of the seven) · `sigma_rule_yaml` (valid Sigma v2
with a unique UUID v4 `id`).

The formal contract is published as `api/data/playbooks.schema.json` (JSON Schema
draft 2020-12), generated from the Pydantic models so it cannot drift from what the
API enforces. Validate an authored file before shipping it:

```bash
python api/data/build_playbook_schema.py --check
```

Startup validation enforces all of it — response action in the allowed set, technique
present in the ATT&CK catalog so the learner can actually select it, no indicator in
both pools, Sigma parses and carries a detection block and id, and no log field
leaking the technique id. A malformed playbook fails the process at boot with a
message naming the playbook and technique, rather than surfacing mid-run.

The ATT&CK catalog backing the dropdown is regenerated from MITRE's published STIX
bundle by `api/data/build_attack_catalog.py` (pinned to Enterprise v17.1; `--latest`
tracks the current release). It runs at build time only — the deployed module makes
no outbound request.

## 8. Roadmap fit

- **Near term:** persist reports, wire `recommended_training[]` to real lab slugs,
  bind sessions to PWNDORA identities.
- **Medium term:** author playbooks per industry vertical (the format already
  supports it); expose an instructor view aggregating detection rates per technique
  across a cohort, which `attack_coverage[]` already provides per run.
- **Longer term:** ingest a customer's real Sigma corpus and score their rules against
  the same evidence, turning BASLab from a training module into a live control
  assurance check — the scoring engine's inputs do not change, only the source of the
  reference indicators.
