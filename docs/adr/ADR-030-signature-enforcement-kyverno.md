# ADR-030: Signature enforcement in the cell: Kyverno admission control verifies locally signed images offline
Status: proposed
Date: 2026-10-19   Source: BUILD-PROMPT §4.1 (On-site substrate, Kubernetes packaging), §4.3 (signing in development and CI, licence policy, dependency scorecard), §5.1, §21 (WP-0.2); ADR-022

## Context

**What the build prompt fixes.** §4.3 signs images in development and CI with a local key pair from `cosign generate-key-pair` (passphrase from the environment), keeps them in the dev cell's local registry, disables transparency-log upload and verifies with "the matching offline option"; it forbids keyless signing, Fulcio, the public Rekor log and a public registry, and leaves production keys and any transparency log to an ADR and a [HUMAN] decision. WP-0.2's first exit criterion is "the cell boots from locally signed images with one command" (§21). The Phase 0 exit adds "the dev cell installs from signed artefacts".

**What it leaves open.** Neither §4.1 nor §4.3 says what refuses an unsigned image. A signature that nothing checks at the moment a pod is created shows only that someone signed, not that the cell runs signed images. Kubernetes has no built-in admission check of image signatures, so a policy engine or an admission webhook has to do it. The choice is [P].

**Options considered (on paper; none was prototyped in WP-0.2 before this ADR).**

| Option | For | Against |
|---|---|---|
| Kyverno (Apache-2.0, CNCF project) | One admission controller checks cosign signatures against a static public key with no transparency log, rewrites tags to digests, and also enforces a "local registry only" rule; upstream Helm chart and images | A large controller (several components); its offline support for the signature format of cosign 3 is unconfirmed |
| Sigstore policy-controller (Apache-2.0) | Built by the cosign project for exactly this check; an image that matches no `ClusterImagePolicy` is refused by default (`no-match-policy`), so a policy that matches only the local registry also gives the registry-only rule | Checks only namespaces labelled `policy.sigstore.dev/include: "true"`, so covering kube-system and the operators' namespaces needs every one of them labelled, and a namespace created without the label is unchecked (Sigstore documentation, `docs.sigstore.dev/policy-controller/overview`, read 2026-10-19) |
| Verification outside admission only (`cosign verify` before deploy, plus a scan of running pods) | No webhook in the pod-creation path | Nothing stops a pod created by an operator, a controller or a chart hook with an unsigned image |

## Decision

- **Kyverno's admission controller enforces image signatures in every cell profile** (lite, dev and, unless a later ADR changes it, on site). Lite cell: 1 replica, with the background, cleanup and reports controllers off; dev and on-site cells: 3 replicas.
- **One `verifyImages` policy** holds the cell's cosign public key. It ignores the transparency log and certificate timestamps (`ignoreTlog`, `ignoreSCT`; no Rekor and no Fulcio, §4.3), rewrites tags to digests and verifies the digest (`mutateDigest`, `verifyDigest`), requires a signature (`required`), and the webhook fails closed (`failurePolicy: Fail`).
- **Only the `kyverno` namespace is excluded** (its `resourceFilters` are overridden), so kube-system and the operators' namespaces are checked. Kyverno's own images are verified with the cosign CLI before Kyverno is installed.
- **A validate rule admits only images from the cell's local registry**, so a pull from a public registry is refused before any network fetch.
- **`cell verify-running`** checks that the digest of every running container is in the signed image lock and verifies offline; this covers pods that started before the policy existed.
- **The pinned cosign version** follows what the pinned Kyverno verifies offline: cosign 3 (a signing configuration without a Rekor service) if Kyverno reads its signatures, otherwise cosign 2 with `--tlog-upload=false`, both allowed by §4.3. A one-hour spike in WP-0.2 decides it and records the result here when this ADR is accepted.
- **Production keys and any transparency log** remain outside this ADR (§4.3, [HUMAN]).
- **Update (19 October 2026, slice S1; to be folded into the decision when this ADR is accepted):** the spike pinned cosign 3.1.3 with a signing configuration that names no service (OQ-135). Kyverno 1.19.1 verifies that signature offline only through an `ImageValidatingPolicy` (`policies.kyverno.io/v1`); its deprecated `ClusterPolicy` `verifyImages` finds no signature in it. So the "one `verifyImages` policy" above becomes one `ImageValidatingPolicy`, and S3 maps `ignoreTlog`, `ignoreSCT`, `mutateDigest`, `verifyDigest` and `required` to its fields, recording any that has no counterpart (OQ-123, OQ-135). Kyverno is installed from its release manifest (`install.yaml`, pinned in `deploy/site-cell/cell.yaml`), not from its chart, which packages a Bitnami chart (OQ-137).

## Consequences (including safety and licence impact)

- **Licence:** Kyverno is Apache-2.0, on the §4.3 allowlist; it ships to sites as unmodified upstream containers and gets a dependency-scorecard row.
- **Safety and security:** an image that is unsigned, signed with another key, or not from the local registry cannot start in the cell, which keeps the release tier's signed artefacts (§19.1, WP-0.9) meaningful on site. Supports H6 and H7 indirectly: a tampered database or operator image cannot be admitted.
- **Availability (H7):** while Kyverno is down, pod creation in checked namespaces is refused (KA-021). Kyverno gets the same short `NoExecute` tolerations as the PostgreSQL operator, and the node-kill tests measure the effect of losing the node that holds it.
- **Lite cell:** the registry serves plain HTTP on the cell's Docker bridge, so the policy sets `allowInsecureRegistry` (KA-020); content and signatures are still checked by digest and by key.
- **Footprint:** about 384 MiB budgeted for the admission controller on the lite cell (WP-0.2 plan), to be confirmed by the footprint test.
- **Charts:** every chart's images are overridden to the local registry; chart hook jobs that would render other images (Bitnami images included) are disabled or repointed.

## Fitness test that guards it

The signature-enforcement tests SIG-01 to SIG-07 (`sh tools/hms cell signatures --evidence`, records in `docs/program/evidence/cell/`): an unsigned image, an image signed with a throwaway key, `docker.io/library/busybox`, and a tag moved to unsigned content are refused; the same image signed with the cell key is admitted and rewritten to its digest; `cell verify-running` passes for every running image; and `cosign verify` succeeds on an internal Docker network that holds only the registry, which shows that verification needs no internet. `cell verify-running` also runs in the nightly and release `cell-check` step (§19.1). State on 2026-10-19: nothing is built; this ADR is proposed and is to be accepted at WP-0.2's close-out once SIG-01 to SIG-07 pass on the lite cell.

## Reopen if

- the pinned Kyverno cannot verify the pinned cosign's signatures offline, or needs network access to verify;
- Kyverno's licence or steward changes (the ADR-022 trigger);
- the lite or on-site footprint test shows it does not fit the budget;
- the [HUMAN] decision on production keys or a transparency log (§4.3) changes what must be verified;
- Kubernetes gains built-in verification of image signatures at admission.
