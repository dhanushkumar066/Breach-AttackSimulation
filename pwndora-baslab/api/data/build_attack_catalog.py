"""Build ``enterprise-attack-techniques.json`` from the official MITRE ATT&CK dataset.

This is a **build-time** tool, not a runtime dependency. It downloads the published
ATT&CK Enterprise STIX 2.1 bundle, projects it down to the four fields the learner
dropdown needs, and writes the result next to this file. The API then serves that
bundled JSON, so the running module still makes zero external calls.

    python api/data/build_attack_catalog.py                  # fetch and rebuild
    python api/data/build_attack_catalog.py --source b.json  # use a local bundle
    python api/data/build_attack_catalog.py --check          # verify, write nothing

Re-run it to pick up a new ATT&CK release. The playbook technique ids are asserted to
survive the rebuild, so an upstream revocation fails the build instead of silently
leaving a technique the learner can never select.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

# Official MITRE-maintained distribution of the ATT&CK knowledge base.
#
# Pinned to v17.1 deliberately. ATT&CK v18 split "Defense Evasion" into the new
# "Stealth" and "Defense Impairment" tactics; the BASLab playbooks and the problem
# statement both use the Defense Evasion vocabulary, so pinning keeps the tactic a
# learner sees in the dropdown identical to the one revealed after submission.
# Pass --latest to track the current release instead.
ATTACK_VERSION = "17.1"
ATTACK_BASE = (
    "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack"
)
ATTACK_STIX_URL = f"{ATTACK_BASE}/enterprise-attack-{ATTACK_VERSION}.json"
ATTACK_LATEST_URL = f"{ATTACK_BASE}/enterprise-attack.json"

OUTPUT = Path(__file__).with_name("enterprise-attack-techniques.json")
PLAYBOOKS = Path(__file__).with_name("playbooks.json")

#: STIX encodes tactics as kill-chain phase slugs; ATT&CK displays them title-cased
#: with 'and' spelled out. Mapping explicitly avoids guessing at the formatting.
TACTIC_NAMES = {
    "reconnaissance": "Reconnaissance",
    "resource-development": "Resource Development",
    "initial-access": "Initial Access",
    "execution": "Execution",
    "persistence": "Persistence",
    "privilege-escalation": "Privilege Escalation",
    "defense-evasion": "Defense Evasion",
    "credential-access": "Credential Access",
    "discovery": "Discovery",
    "lateral-movement": "Lateral Movement",
    "collection": "Collection",
    "command-and-control": "Command and Control",
    "exfiltration": "Exfiltration",
    "impact": "Impact",
    # ATT&CK v18 replaced defense-evasion with these two. Mapped so that a --latest
    # rebuild degrades to a tactic rename rather than silently dropping every
    # technique that moved.
    "stealth": "Stealth",
    "defense-impairment": "Defense Impairment",
}

CITATION = re.compile(r"\(Citation:[^)]*\)")
MARKDOWN_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
CODE_TICKS = re.compile(r"<code>(.*?)</code>", re.DOTALL)
WHITESPACE = re.compile(r"\s+")

MAX_DESCRIPTION = 240


def summarise(description: str) -> str:
    """Reduce a MITRE description to one clean sentence for the dropdown."""
    text = CITATION.sub("", description)
    text = MARKDOWN_LINK.sub(r"\1", text)
    text = CODE_TICKS.sub(r"\1", text)
    text = WHITESPACE.sub(" ", text).strip()

    # First sentence, avoiding the abbreviations that pepper ATT&CK prose.
    sentences = re.split(r"(?<![A-Z])(?<!e\.g)(?<!i\.e)(?<!etc)\.\s+", text)
    summary = sentences[0].strip() if sentences else text
    if len(summary) > MAX_DESCRIPTION:
        summary = summary[: MAX_DESCRIPTION - 1].rsplit(" ", 1)[0] + "…"
    if summary and not summary.endswith((".", "…")):
        summary += "."
    return summary


def load_bundle(source: str | None, url: str = ATTACK_STIX_URL) -> dict:
    if source:
        print(f"reading local bundle: {source}")
        return json.loads(Path(source).read_text(encoding="utf-8"))

    print(f"downloading {url}")
    request = urllib.request.Request(
        url, headers={"User-Agent": "pwndora-baslab-build/1.0"}
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8"))


def extract(bundle: dict) -> list[dict[str, str]]:
    """Project attack-pattern objects onto {id, name, tactic, description}."""
    techniques: list[dict[str, str]] = []

    for obj in bundle.get("objects", []):
        if obj.get("type") != "attack-pattern":
            continue
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue

        attack_id = ""
        for ref in obj.get("external_references", []):
            if ref.get("source_name") == "mitre-attack":
                attack_id = ref.get("external_id", "")
                break
        if not re.fullmatch(r"T\d{4}(\.\d{3})?", attack_id):
            continue

        phases = [
            phase["phase_name"]
            for phase in obj.get("kill_chain_phases", [])
            if phase.get("kill_chain_name") == "mitre-attack"
        ]
        if not phases:
            continue

        # A technique can serve several tactics (T1055 is both Defense Evasion and
        # Privilege Escalation). The first phase is ATT&CK's primary placement and is
        # what keeps the /api/mitre/tactics filter a clean one-to-many.
        tactic = TACTIC_NAMES.get(phases[0])
        if tactic is None:
            continue

        techniques.append(
            {
                "id": attack_id,
                "name": obj.get("name", "").strip(),
                "tactic": tactic,
                "description": summarise(obj.get("description", "")),
            }
        )

    techniques.sort(key=lambda t: [int(p) for p in t["id"][1:].split(".")])
    return techniques


def playbook_technique_ids() -> list[str]:
    if not PLAYBOOKS.exists():
        return []
    data = json.loads(PLAYBOOKS.read_text(encoding="utf-8"))
    return sorted(
        {
            technique["technique_id"]
            for playbook in data["playbooks"]
            for technique in playbook["techniques"]
        }
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="path to a local enterprise-attack.json bundle")
    parser.add_argument(
        "--latest",
        action="store_true",
        help=f"track the current ATT&CK release instead of the pinned v{ATTACK_VERSION}",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate the existing catalog without rewriting it",
    )
    args = parser.parse_args()

    required = playbook_technique_ids()

    if args.check:
        if not OUTPUT.exists():
            print(f"FAIL: {OUTPUT.name} is missing")
            return 1
        catalog = json.loads(OUTPUT.read_text(encoding="utf-8"))
        known = {t["id"] for t in catalog}
        missing = [t for t in required if t not in known]
        tactics = {t["tactic"] for t in catalog}
        print(f"catalog: {len(catalog)} techniques across {len(tactics)} tactics")
        if missing:
            print(f"FAIL: playbook techniques absent from catalog: {missing}")
            return 1
        print("OK: every playbook technique is selectable")
        return 0

    try:
        bundle = load_bundle(args.source, ATTACK_LATEST_URL if args.latest else ATTACK_STIX_URL)
    except Exception as exc:
        print(f"FAIL: could not read the ATT&CK bundle: {exc}")
        print("The previously generated catalog was left untouched.")
        return 1

    version = ""
    for obj in bundle.get("objects", []):
        if obj.get("type") == "x-mitre-collection":
            version = obj.get("x_mitre_version", "")
            break

    techniques = extract(bundle)
    if not techniques:
        print("FAIL: no techniques extracted; refusing to overwrite the catalog")
        return 1

    known = {t["id"] for t in techniques}
    missing = [t for t in required if t not in known]
    if missing:
        print(f"FAIL: playbook techniques missing from this ATT&CK release: {missing}")
        print("The previously generated catalog was left untouched.")
        return 1

    OUTPUT.write_text(
        json.dumps(techniques, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    tactics = sorted({t["tactic"] for t in techniques})
    subs = sum(1 for t in techniques if "." in t["id"])
    print(f"ATT&CK Enterprise version: {version or 'unknown'}")
    print(f"wrote {OUTPUT.name}: {len(techniques)} techniques "
          f"({len(techniques) - subs} base, {subs} sub-techniques) "
          f"across {len(tactics)} tactics")
    print(f"all {len(required)} playbook techniques present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
