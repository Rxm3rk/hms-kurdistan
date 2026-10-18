# OpenTofu

Infrastructure as code with OpenTofu (MPL-2.0; BUILD-PROMPT §4.1) for the central and DR site, with immutable images, CIS baselines and drift detection (PL-4, §13.1). The build never creates cloud resources or accounts without the human's instruction (§3.4 item 6), so code here is written and validated locally and applied only when a human decides. WP-1.13 fills this directory.
