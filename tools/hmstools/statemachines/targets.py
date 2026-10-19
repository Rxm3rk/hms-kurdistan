"""Where each machine's generated Kotlin goes, and the machines that are validated but not generated.

Sources: docs/specs/modules/state-machines-and-invariants.md §2.3 and §3.1 (owner, Gradle project,
package), §2.1 rule 9 and BUILD-PROMPT §8.4 (approvers; OQ-083: the fuller §8.4 list), and the WP-0.5
contracts §1 (prefix = PascalCase of the kebab name). A spec whose machine is in neither table fails.
"""

from __future__ import annotations

from dataclasses import dataclass


def prefix_of(machine: str) -> str:
    """``medication-administration`` -> ``MedicationAdministration``."""
    return "".join(part[:1].upper() + part[1:] for part in machine.split("-"))


@dataclass(frozen=True)
class Target:
    """A generated machine: its owner module (§5.2), Gradle project directory and Kotlin package."""

    machine: str
    owner: str
    project: str  # repository path of the owning Gradle project
    package: str

    @property
    def prefix(self) -> str:
        return prefix_of(self.machine)

    @property
    def package_path(self) -> str:
        return self.package.replace(".", "/")

    @property
    def main_file(self) -> str:
        return f"{self.project}/src/main/kotlin/{self.package_path}/{self.prefix}Machine.kt"

    @property
    def property_test_file(self) -> str:
        return f"{self.project}/src/propertyTest/kotlin/{self.package_path}/{self.prefix}GeneratedPropertyTest.kt"


def _target(machine: str, owner: str, project: str) -> Target:
    return Target(machine, owner, project, f"hms.{owner}.domain.{machine.replace('-', '')}")


# §3.1: the eight §8.4 machines this package generates.
TARGETS: dict[str, Target] = {
    t.machine: t
    for t in (
        _target("encounter", "adt", "backend/modules/adt"),
        _target("bed", "adt", "backend/modules/adt"),
        _target("order", "orders", "backend/modules/orders"),
        _target("medication-administration", "medications", "backend/modules/medications"),
        _target("specimen", "lis", "backend/modules/lis"),
        _target("result", "results", "backend/modules/results"),
        _target("appointment", "scheduling", "backend/modules/scheduling"),
        _target("credit-claim", "rcm", "backend/satellites/rcm"),
    )
}

# §2.1 (after rule 13) and §3.2: client-side machines, validated by rules 1-10 and 13 but not generated
# (a TypeScript model is open question OQ-200). Value: where the machine is implemented.
CLIENT_SIDE: dict[str, str] = {
    "patient-context": "frontend/packages/ui-core",
}

# §2.1 rule 9: the approvers §8.4 names for its eight machines, exactly. A machine §8.4 does not list
# (patient-context) may name any roles.
APPROVERS: dict[str, frozenset[str]] = {
    "encounter": frozenset({"nurse-panel", "him", "cso"}),
    "order": frozenset({"pharmacist-panel", "nurse-panel", "cso"}),
    "medication-administration": frozenset({"pharmacist-panel", "nurse-panel", "cso"}),
    "specimen": frozenset({"lab-cso"}),
    "result": frozenset({"lab-cso", "physician-panel"}),
    "bed": frozenset({"nurse-panel", "bed-manager"}),
    "appointment": frozenset({"opd-panel"}),
    "credit-claim": frozenset({"rcm-lead", "kurdistan-pack-pm"}),
}
