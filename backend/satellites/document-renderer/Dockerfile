# syntax=docker/dockerfile:1
#
# HMS Kurdistan document renderer satellite (docs/specs/modules/platform-docs.md §1, §7.5; ADR-038, ADR-003).
#
# WRITTEN, NOT BUILT (WP-0.8): the image is built when the cell exists (WP-0.2) and is shipped to a site only after
# the licence decision DN-066 (see LICENCES.md). Nothing in WP-0.8 runs a container.
#
# Build context is the repository root, so the one copy of the print fonts (the platform-docs module's) goes in:
#   docker build -f backend/satellites/document-renderer/Dockerfile \
#     --build-arg PYTHON_IMAGE_DIGEST=sha256:<digest of python:3.12-slim-trixie, pinned when first built> \
#     -t <local registry>/hms/document-renderer:<version> .
# The digest has no default on purpose: a build without a pinned base image fails.
#
# Debian stable (trixie) slim with CPython 3.12 from the official Python image: the wheels in requirements.txt are
# pinned for cp312 (manylinux x86_64), and Debian trixie's own python3 is 3.13. Pango, HarfBuzz, fontconfig and
# FreeType come from Debian's packages (unmodified operating-system packages, the licence policy's os-packages rule).
#
# Run (the cell's deployment, WP-0.2): non-root, read-only root filesystem, a writable tmpfs at /tmp, the request on
# standard input, the PDF to a mounted work directory; NO NETWORK: the pod's NetworkPolicy denies all egress and all
# ingress (§3.7, HAZ-0047, §6.8 item 11). The renderer opens no listener and no connection; its fetcher serves only
# the print fonts and inline-image data: URLs, and a socket guard fails any render whose Python code tries the
# network. The guard covers Python only (a native library could open a socket itself): --network none and the
# NetworkPolicy are the real control.
#   docker run --rm -i --network none --read-only --tmpfs /tmp -v "$PWD/out:/work" <image> render --out /work/out.pdf < request.json

ARG PYTHON_IMAGE_DIGEST
FROM docker.io/library/python:3.12-slim-trixie@${PYTHON_IMAGE_DIGEST}

# The native text stack from Debian. fontconfig-config pulls a default font package as a dependency; the renderer's
# own fontconfig file has no font directory, so no system font is ever visible to a render (§7.5 hermetic fonts).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libharfbuzz-subset0 libfontconfig1 libfreetype6 \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 docrender \
 && useradd --system --uid 10001 --gid docrender --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin docrender

# Only what the renderer needs: the package, its contract, its pins and the bootstrap. Tests and fixtures stay out.
COPY backend/satellites/document-renderer/bootstrap.py backend/satellites/document-renderer/requirements.txt /opt/hms/document-renderer/
COPY backend/satellites/document-renderer/contract/ /opt/hms/document-renderer/contract/
COPY backend/satellites/document-renderer/runtime/ /opt/hms/document-renderer/runtime/
COPY backend/satellites/document-renderer/hms_docrender/ /opt/hms/document-renderer/hms_docrender/
# The print fonts and fonts.json, from the module's one copy; every file is checked against fonts.json at each render.
COPY backend/modules/platform-docs/src/main/resources/hms/platform/docs/fonts/ /opt/hms/fonts/

ENV HMS_DOCRENDER_FONT_DIR=/opt/hms/fonts \
    HMS_DOCRENDER_TMP=/tmp/docrender \
    PYTHONDONTWRITEBYTECODE=1

# The runtime: a virtual environment with the hash-pinned wheels (pip --require-hashes --no-deps --only-binary,
# then every installed file checked against its RECORD hash), the hermetic fontconfig file and runtime.json with the
# native library versions read back from the loaded libraries. Downloads happen here, at build time, from PyPI only.
RUN python -I /opt/hms/document-renderer/bootstrap.py --target /opt/hms/docrender-runtime \
 && rm -rf /opt/hms/document-renderer/hms_docrender/golden/selftest-fixtures \
 && mkdir -p /opt/hms/docrender-runtime/fontconfig/cache \
 && chown docrender:docrender /opt/hms/docrender-runtime/fontconfig/cache \
 && /opt/hms/docrender-runtime/bin/python -I -m hms_docrender identity

USER 10001:10001
WORKDIR /work
ENTRYPOINT ["/opt/hms/docrender-runtime/bin/python", "-I", "-m", "hms_docrender"]
CMD ["doctor"]
