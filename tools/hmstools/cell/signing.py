"""Offline image signing with cosign (BUILD-PROMPT.md §4.3 "Signing in development and CI"; OQ-130, OQ-135).

- The key pair comes from `cosign generate-key-pair` in the pinned cosign container and lives in HMS_CELL_HOME,
  outside every repository; the private key is mode 600.
- The passphrase comes from HMS_COSIGN_PASSWORD and reaches cosign as COSIGN_PASSWORD, by name only. Without it,
  signing fails closed. `cell keys init --generate-passphrase` writes a random one to HMS_CELL_HOME (mode 600)
  and says so; it is never generated silently.
- cosign 3 signs with a signing configuration that names no Fulcio, Rekor, OIDC or timestamp service, so nothing
  is uploaded to a transparency log, and with a local key, so nothing is keyless. Verification uses the public
  key and `--insecure-ignore-tlog=true`, the matching offline option.
- Both run on a Docker network marked --internal that holds only the registry, so they are offline by
  construction: no flag can reach a public service from there.

The argument builders below are the only place cosign command lines are made; the tests check that no keyless,
Fulcio, Rekor, OIDC or transparency-log-upload option can appear in them.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
from pathlib import Path
from typing import Any

SIGNING_CONFIG_MEDIA_TYPE = "application/vnd.dev.sigstore.signingconfig.v0.2+json"
PASSPHRASE_ENV = "HMS_COSIGN_PASSWORD"
COSIGN_ENV = "COSIGN_PASSWORD"
IN_CONTAINER_KEYS = "/keys"
IN_CONTAINER_CONFIG = "/cfg"

# Options that would sign keyless, reach Fulcio, Rekor or an OIDC provider, upload to a transparency log, or
# replace the local signing configuration with the public-good one fetched over TUF. None may ever appear.
FORBIDDEN = re.compile(
    r"^--?(tlog-upload|fulcio-url|fulcio-auth-flow|rekor-url|identity-token|oidc-[a-z-]+|use-signing-config"
    r"|certificate-identity[a-z-]*|certificate-oidc-issuer[a-z-]*|timestamp-server-url|sk|insecure-skip-verify)(=|$)"
)


class SigningError(RuntimeError):
    pass


def signing_config() -> dict[str, Any]:
    """A Sigstore signing configuration with no services at all: key-based signing, nothing uploaded."""
    return {
        "mediaType": SIGNING_CONFIG_MEDIA_TYPE,
        "caUrls": [],
        "oidcUrls": [],
        "rekorTlogUrls": [],
        "rekorTlogConfig": {"selector": "ANY"},
        "tsaUrls": [],
        "tsaConfig": {"selector": "ANY"},
    }


def signing_config_text() -> str:
    return json.dumps(signing_config(), indent=2, sort_keys=True) + "\n"


def signing_config_problems(data: Any) -> list[str]:
    """Why a signing configuration on disk could reach a service (empty if it names none)."""
    if not isinstance(data, dict):
        return ["not a JSON object"]
    problems = []
    if data.get("mediaType") != SIGNING_CONFIG_MEDIA_TYPE:
        problems.append(f"mediaType is {data.get('mediaType')!r}, not {SIGNING_CONFIG_MEDIA_TYPE}")
    for key in ("caUrls", "oidcUrls", "rekorTlogUrls", "tsaUrls"):
        if data.get(key):
            problems.append(f"{key} names a service: {data[key]!r}")
    unknown = set(data) - set(signing_config())
    if unknown:
        problems.append(f"unknown keys {sorted(unknown)}")
    return problems


def check_argv(args: list[str]) -> list[str]:
    """Raise SigningError if a cosign argument list holds a forbidden option; return it unchanged otherwise."""
    bad = [a for a in args if FORBIDDEN.match(a)]
    if bad:
        raise SigningError(f"refusing a cosign command with {bad}: keyless signing, public services and "
                           "transparency-log upload are not allowed (§4.3)")
    return args


def generate_key_pair_args() -> list[str]:
    return check_argv(["generate-key-pair", "--output-key-prefix", f"{IN_CONTAINER_KEYS}/cosign"])


def sign_args(ref: str) -> list[str]:
    """cosign 3 `sign` of one image by digest with the cell key and the service-free signing configuration."""
    if "@sha256:" not in ref:
        raise SigningError(f"refusing to sign {ref!r}: sign by digest only")
    return check_argv([
        "sign",
        "--key", f"{IN_CONTAINER_KEYS}/cosign.key",
        "--signing-config", f"{IN_CONTAINER_CONFIG}/signing-config.json",
        "--allow-http-registry=true",  # the local registry speaks HTTP on the bridge (KA-020)
        "--yes",
        ref,
    ])


def verify_args(ref: str) -> list[str]:
    """cosign 3 `verify` of one image by digest against the cell's public key, offline."""
    if "@sha256:" not in ref:
        raise SigningError(f"refusing to verify {ref!r}: verify by digest only")
    return check_argv([
        "verify",
        "--key", f"{IN_CONTAINER_KEYS}/cosign.pub",
        "--insecure-ignore-tlog=true",  # nothing was uploaded to a log (§4.3: "the matching offline option")
        "--allow-http-registry=true",
        "--output", "json",
        ref,
    ])


def parse_verify_output(stdout: str, digest: str) -> tuple[bool, str]:
    """cosign verify prints a JSON array of verified payloads. True only if every payload names this digest."""
    text = stdout.strip()
    start = text.find("[")
    if start < 0:
        return False, "no verified payload in cosign's output"
    try:
        payloads = json.loads(text[start:])
    except json.JSONDecodeError as exc:
        return False, f"cosign's output is not JSON: {exc}"
    if not isinstance(payloads, list) or not payloads:
        return False, "cosign verified no signature"
    named = set()
    for payload in payloads:
        try:
            named.add(payload["critical"]["image"]["docker-manifest-digest"])
        except (KeyError, TypeError):
            return False, "a verified payload names no image digest"
    if named != {digest}:
        return False, f"verified payloads name {sorted(named)}, not {digest}"
    return True, f"{len(payloads)} signature(s) verified against the cell key for {digest}"


def public_key_fingerprint(pem: str) -> str:
    """SHA-256 of the DER SubjectPublicKeyInfo inside a PEM public key: 'SHA256:<hex>'."""
    m = re.search(r"-----BEGIN PUBLIC KEY-----(.+?)-----END PUBLIC KEY-----", pem, re.S)
    if not m:
        raise SigningError("not a PEM public key")
    der = base64.b64decode("".join(m.group(1).split()))
    return "SHA256:" + hashlib.sha256(der).hexdigest()


def new_passphrase() -> str:
    return secrets.token_urlsafe(32)


def passphrase(env: dict[str, str]) -> str:
    """The signing passphrase from HMS_COSIGN_PASSWORD; fails closed without it (OQ-130)."""
    value = env.get(PASSPHRASE_ENV, "")
    if not value:
        raise SigningError(f"{PASSPHRASE_ENV} is not set; signing fails closed (OQ-130). If 'cell keys init "
                           "--generate-passphrase' made the key, export it from the passphrase file it named")
    return value


def key_paths(home: Path, key_dir: str) -> tuple[Path, Path]:
    directory = home / key_dir
    return directory / "cosign.key", directory / "cosign.pub"
