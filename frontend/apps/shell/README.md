# apps/shell (placeholder)

The Tauri 2 desktop shell lands here in WP-0.7 (BUILD-PROMPT.md §4.1, §5.4, ADR-019). It hosts the web
workspaces on hospital workstations and carries the hardware abstraction layer (HAL) for label and wristband
printers, scanners, badge readers, ID-card and MRZ readers and card terminals, with simulated devices for
development. Building it needs Rust stable and the Tauri 2 system prerequisites, which the build host must
provide [HUMAN]; packaging for Windows needs a Windows build step.
