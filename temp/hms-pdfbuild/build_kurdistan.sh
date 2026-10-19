#!/usr/bin/env bash
# Rebuild BLUEPRINT-KURDISTAN.pdf from BLUEPRINT-KURDISTAN.md.
set -euo pipefail
REPO="C:/Users/Surface/.t3/projects/hospitalmanagementsystem"
TMP="C:/Users/Surface/AppData/Local/Temp"
cd "$TMP/hms-pdfbuild"
python -I build_pdf.py "$REPO/BLUEPRINT-KURDISTAN.md" "$REPO/BLUEPRINT-KURDISTAN.pdf" \
  --marked "$TMP/hms-vendor-marked/marked.umd.js" \
  --mermaid "$TMP/hms-vendor-mermaid/mermaid.min.js" \
  --html-out "$TMP/hms-pdfbuild/kurdistan.html" \
  --kicker "Hospital Management System · Planning blueprint" \
  --title "Kurdistan Edition" \
  --subtitle "A Top-Tier Hospital Management System for the Kurdistan Region of Iraq" \
  --meta "Version|1.1 · 17 October 2026 (two independent reviews applied)" \
  --meta "Derived from|BLUEPRINT.md v1.2.1 and the 16-report research pack (R01–R16)" \
  --meta "Status|Research and planning only · no code has been written" \
  --note "Kurdistan-specific facts marked <b>[L]</b> are local assumptions to verify before anyone relies on them (Appendix B). Start with <b>Part 0</b>, the three-minute read-aloud summary, then <b>§1</b>." \
  --footer "HMS Blueprint · Kurdistan Edition v1.1 · 17 October 2026"
