"""tools/bootstrap: fetch the project-local toolchain into .tools/ (BUILD-PROMPT.md WP-0.1, §3.4 item 9).

Stdlib only, so it runs with the system Python before the project venv exists. Every download is
verified by SHA-256; nothing is written outside the repository; ``corepack enable`` is never run.
"""
