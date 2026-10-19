# Events of `platform-docs`

The print-job events of `docs/specs/modules/platform-docs.md` §8.2 (BUILD-PROMPT §12.8: "`PrintJobCompleted / Failed` (with template version)"; §6.3). The AsyncAPI document and the CloudEvents envelopes come with the journal outbox (WP-0.3); until then the events go to an in-memory port only (KA-078). Kotlin types: `backend/modules/platform-docs/src/main/kotlin/hms/platform/docs/domain/job/PrintJob.kt`.

**No PHI (SI-20, CTRL-0047-2).** Payloads carry identifiers of the job, tenant, facility, printer, template and correlation, and the template's version and content hash. They never carry a patient reference, a name, label or document text, a barcode payload or the output's SHA-256 (a hash of a label is PHI-derived: an MRN can be found by trying candidates). The audit record (§8.3) is where the patient reference lives.

## Common header (`PrintJobHeader`)

| Field | Type | Meaning |
|---|---|---|
| `jobId` | string (UUIDv7 once WP-0.3's library exists) | The print job |
| `tenantId`, `facilityId` | string | Where it printed |
| `templateId` | string | The template |
| `templateVersion` | integer, or null when refused before the template loaded | Its version |
| `templateHash` | hex SHA-256, or null as above | Its content hash (spec §4.2) |
| `mode` | `ZPL_TEXT`, `ZPL_RASTER`, `ESCPOS_RASTER`, `PDF` | The output |
| `printerId` | string | The destination printer |
| `copies` | integer | 1 for a wristband, 1 to 10 otherwise |
| `reprintOf` | string or null | The earlier job on an explicit reprint |
| `reprintReason` | `LOST`, `DAMAGED`, `ILLEGIBLE`, `DETAILS_CHANGED`, `PRINTER_FAULT`, or null | Why |
| `correlationId` | string | The command's correlation id |
| `occurredAt` | instant | From the injected clock |

## Events

| Event | When | Extra fields |
|---|---|---|
| `PrintJobRequested` | The print service accepted a command | — |
| `PrintJobRefused` | A check failed before any output (policy, content rules, template, media, fit, renderer, audit) | `reason` (a `RefusalReason`; never the text that failed) |
| `PrintJobCompleted` | The HAL reported `completed` | — |
| `PrintJobFailed` | A render error, or a HAL error with a known outcome | `detail` (technical, no PHI) |
| `PrintJobOutcomeUnknown` | A HAL timeout or device error on a print call, or the job was cancelled by a later reprint's `~JA` | `detail` |
