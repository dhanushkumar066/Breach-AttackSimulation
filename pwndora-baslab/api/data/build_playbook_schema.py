"""Emit ``playbooks.schema.json`` from the Pydantic models that guard the API.

The schema is generated, never hand-written, so the published contract and the
validation the API actually performs at startup cannot drift apart.

    python api/data/build_playbook_schema.py           # regenerate
    python api/data/build_playbook_schema.py --check   # verify, write nothing

``--check`` validates the shipped ``playbooks.json`` against the shipped schema and
is safe to run in CI. It uses ``jsonschema`` when available and falls back to the
Pydantic models otherwise.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running the file directly from the repository root.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from api.models.playbook import PlaybookLibrary  # noqa: E402
from api.models.session import RESPONSE_ACTIONS  # noqa: E402

SCHEMA = Path(__file__).with_name("playbooks.schema.json")
DATA = Path(__file__).with_name("playbooks.json")


def build() -> dict:
    schema = PlaybookLibrary.model_json_schema()
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = "https://pwndora.net/schemas/baslab/playbooks.schema.json"
    schema["title"] = "PWNDORA BASLab Playbook Library"
    schema["description"] = (
        "Schema for api/data/playbooks.json. Generated from the Pydantic v2 models in "
        "api/models/playbook.py — the same models the API validates against at startup, "
        "so the schema and the runtime contract cannot drift. Regenerate with "
        "python api/data/build_playbook_schema.py"
    )

    # Rules the loader enforces that JSON Schema cannot express are documented inline,
    # so an author reading the schema sees the complete contract.
    defs = schema.get("$defs", {})
    if "Technique" in defs:
        technique = defs["Technique"]
        technique["properties"]["correct_response_action"]["enum"] = list(RESPONSE_ACTIONS)
        technique["description"] = (
            "One kill-chain step. Additional rules enforced by PlaybookCatalog.load(): "
            "(1) technique_id must exist in enterprise-attack-techniques.json so the "
            "learner can select it; (2) reference_indicators and red_herring_indicators "
            "must be disjoint; (3) sigma_rule_yaml must parse as YAML and carry both an "
            "'id' and a 'detection' block; (4) no log_evidence field value may contain "
            "the technique's own id or an ATT&CK rule tag, which would reveal the answer."
        )
    if "LogEntry" in defs:
        defs["LogEntry"]["description"] = (
            "One simulated log record. IIS W3SVC access-log rows use event_id 0 because "
            "access logs are not EVTX records."
        )
    return schema


def validate() -> int:
    if not SCHEMA.exists():
        print(f"FAIL: {SCHEMA.name} is missing; run without --check to generate it")
        return 1

    data = json.loads(DATA.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))

    if schema != build():
        print(f"FAIL: {SCHEMA.name} is stale; regenerate it from the models")
        return 1

    try:
        import jsonschema

        jsonschema.validate(data, schema)
        print(f"OK: {DATA.name} validates against {SCHEMA.name} (jsonschema)")
    except ImportError:
        PlaybookLibrary.model_validate(data)
        print(f"OK: {DATA.name} validates against the models (jsonschema not installed)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="validate without rewriting the schema"
    )
    args = parser.parse_args()

    if args.check:
        return validate()

    SCHEMA.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {SCHEMA.name} ({SCHEMA.stat().st_size} bytes)")
    return validate()


if __name__ == "__main__":
    sys.exit(main())
