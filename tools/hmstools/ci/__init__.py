"""tools/ci/run: the local CI runner (BUILD-PROMPT.md §19.1, WP-0.1).

Until a human provides a remote and a CI service, CI is ``tools/ci/run <fast|merge|nightly|release>``.
Every run writes one evidence record to docs/program/evidence/ci/ and full step logs to build/ci-logs/.
"""
