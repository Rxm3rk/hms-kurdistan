# HL7 v2 conformance profiles

One conformance profile per interface (structure, cardinality, vocabulary) for the HL7 v2 engine in the Integration Hub, which is the only module that emits HL7 v2 (BUILD-PROMPT §5.2, §12.2, §18.2). The engine accepts versions 2.3–2.8 as dialects, tolerates Z-segments, supports original and enhanced acknowledgements and uses MSH-10 for idempotency; v2-to-FHIR mappings follow the HL7 v2-to-FHIR IG only. WP-1.1b (`INT-ENG-01` base) writes the first profiles, WPs 1.2, 1.4, 1.7 and 1.8 add their message types, and WP-1.12 completes the R1 message set.
