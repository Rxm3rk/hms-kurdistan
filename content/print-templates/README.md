# Print templates

Versioned print templates for `platform-docs` (BUILD-PROMPT §6.6 extension tier 1, §7 item 11, §19.4; `docs/specs/modules/platform-docs.md` §4). One YAML file per template, `<id>.yaml`. The template linter (`TemplateLint`, spec §4.3) checks every file here in the fast tier.

Every template here is `provenance: synthetic` and NOT FOR CLINICAL USE: it exists to test the engine. The hospital's wristband, label, receipt and document layouts are content requests (OQ-238); promotion of a bundle that holds a synthetic template to TRAIN or PROD fails (§19.4).

`worst-case-identity-corpus.yaml` is not a template: it is the governed worst-case identity corpus every patient template must fit (`TemplateFitCheck:worst-case-identity-corpus`, spec §4.3, OQ-244), synthetic and unreviewed until the hospital's registration field limits replace it.
