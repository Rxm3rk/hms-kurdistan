---
name: slow-github-downloads
description: "On the user's network GitHub release assets and services.gradle.org download at ~20-30 KB/s while Maven Central, npm, PyPI and corretto.aws are fast; use checksum-verified mirrors"
metadata:
  node_type: memory
  type: reference
  originSessionId: 6d6b022e-1898-4cd8-a306-06a4b2630a1e
  modified: 2026-10-18T12:57:40.707Z
---

Measured 18 Oct 2026 from the user's Windows host (Kurdistan):
- Slow (~20–30 KB/s): GitHub release assets (`release-assets.githubusercontent.com`, so Temurin, gitleaks and any GitHub-hosted binary) and `services.gradle.org` / `downloads.gradle.org` (they redirect to GitHub).
- Fast (5–20 MB/s): Maven Central, the Gradle Plugin Portal, the npm registry, PyPI, `corretto.aws` (Amazon Corretto JDKs), the Microsoft OpenJDK CDN, and `mirrors.aliyun.com/gradle/distributions/v<ver>/` (Gradle distributions).

- Speeds vary by time of day: on the evening of 18 Oct 2026 GitHub release assets came at ~2.9 MB/s (Temurin Linux JDK) while the Aliyun Gradle mirror dropped to ~300 KB/s with a read timeout (tools/bootstrap resumed it). Measure before choosing; bootstrap retries and resumes partial downloads.
- Container registries from WSL are fine: ghcr.io ≈10 MB/s, quay.io ≈18 MB/s, Docker Hub ≈3 MB/s. GitHub release speed also varies; k3d (24 MB) once came down in seconds.
- Inside WSL Ubuntu: archive.ubuntu.com, nodejs.org, get.helm.sh, static.rust-lang.org are fast; releases.ubuntu.com and packages.adoptium.net are slow (use mirrors.edge.kernel.org/ubuntu-releases and Ubuntu's openjdk-25 package).

How it was handled: the Gradle 9.8.1 zip came from the Aliyun mirror, verified against the official `.sha256` from services.gradle.org (tiny file, fine to fetch). It was pre-seeded into `.tools/gradle-home/wrapper/dists/gradle-9.8.1-bin/<base36(md5(distributionUrl))>/` so the wrapper never downloads it. Temurin JDK 25.0.4.1 did finish from GitHub after ~15 minutes. Corretto is the fast fallback.

Related: [[project-phase]].
