# Scratch helper: (re)writes the 21 SI test specs from the register: tests/invariants/src/propertyTest/.../SInnPropertyTest.kt.
import json
import os
import sys

root = sys.argv[1]
register = json.load(open(root + "/tests/invariants/si-register.json", encoding="utf-8"))
directory = root + "/tests/invariants/src/propertyTest/kotlin/hms/tests/invariants"
LAYERS = {
    "medication-administration": "MedicationAdministrationSpecLayer",
    "order": "OrderSpecLayer",
    "result": "ResultSpecLayer",
    "encounter": "EncounterSpecLayer",
    "bed": "BedSpecLayer",
    "specimen": "SpecimenSpecLayer",
    "appointment": "AppointmentSpecLayer",
}
os.makedirs(directory, exist_ok=True)
for entry in register["entries"]:
    si = entry["si"]
    n = si[3:]
    spec = entry["spec_layer"]
    head = f"""package hms.tests.invariants

import io.kotest.core.spec.style.FunSpec

/**
 * {si} (BUILD-PROMPT §2.1; {", ".join(entry["hazards"])}; planned as
 * `{entry["planned_test"]}`). Enforced in (§2.1): {entry["enforced_in"]}.
 *
"""
    if spec:
        lines = [" * Specification layer (what the WP-0.5 machines encode; the register's `covers` says exactly what):"]
        for item in spec:
            lines.append(f" * - `{item['property']}`")
            lines.append(f" *   on {item['machine']} (clauses {', '.join(item['clauses'])}).")
        body = "\n".join(lines) + "\n"
        calls = "\n".join(
            "            on(\n"
            f"                {LAYERS[i['machine']]}.layer,\n"
            f"                \"{i['property']}\",\n"
            "            )"
            for i in spec
        )
        test = f"""        siInvariantTests("{si}") {{
{calls}
        }}"""
    else:
        body = f" * Specification layer: none. No WP-0.5 machine encodes {si}, so the register lists no specification-layer property.\n"
        test = f'        siInvariantTests("{si}")'
    tail = f""" * Domain layer: NOT-BUILT, waiting on {entry["waits_on"]} ({entry["ka"]}); the test fails when its domain package appears
 * (docs/specs/modules/state-machines-and-invariants.md §4).
 */
class SI{n}PropertyTest :
    FunSpec({{
{test}
    }})
"""
    open(f"{directory}/SI{n}PropertyTest.kt", "w", encoding="utf-8", newline="\n").write(head + body + tail)
print("wrote 21 specs")
