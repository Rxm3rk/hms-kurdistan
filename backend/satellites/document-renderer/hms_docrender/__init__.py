"""HMS Kurdistan document renderer satellite: HTML with CSS paged media to PDF/A-2b with WeasyPrint.

docs/specs/modules/platform-docs.md §1, §7.5, §9, §10; ADR-038 (accepted-provisional); BUILD-PROMPT.md §3.7, §4.1.
Offline only: fonts come from the one print-font directory (``hms-font:`` names, each file checked against
``fonts.json``), images only as ``data:`` URLs, and no socket is opened during a render. Importing this package
does not import WeasyPrint: ``contract`` and ``fonts`` work without the native runtime, and ``env`` sets up the
hermetic environment before WeasyPrint is first imported.
"""

__version__ = "0.1.0"
CONTRACT_VERSION = 1
