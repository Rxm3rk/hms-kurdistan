# Site edge agent

The site edge agent (BUILD-PROMPT §5.1, ADR-011; `PLT-EDGE-01`): a hardened appliance outside the facility's Windows domain, with a continuity replica, queue state, print spool and device bridge, for outpatient-tier sites on the pooled tier and for a group's outpatient site attached to the group's hospital cell over metro links. WP-1.13 fills this directory, covering both the polyclinic attached to a hospital cell (including metro-link loss with continuity and downtime blocks) and the stand-alone polyclinic on the pooled tier.
