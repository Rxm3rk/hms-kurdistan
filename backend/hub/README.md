# Integration Hub

The native Integration Hub satellite that owns every interface: the HL7 v2 engine, the FHIR R4 façade, DICOM, analyser bridges, the Kurdistan pack adapters and channel operations (ADR-014; BUILD-PROMPT §5.2, §12). It uses the core only through public APIs and events, and every external party it talks to has a local simulator (§3.7). It is built during Phase 1 and completed in WP-1.12 (§12, §21); its channel tests and zero-silent-drop chaos test guard ADR-014.
