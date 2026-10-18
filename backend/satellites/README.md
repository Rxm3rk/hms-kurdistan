# Satellites

Separately deployed services beside the modular monolith (ADR-003; BUILD-PROMPT §5.2, §6.1): `rcm` (accounts, ledger, tariffs, cashiering, dual currency, claims; with `finance-export`), the document renderer (PDF/A with Sorani and Arabic shaping, WP-0.8), analytics, and the AI gateway (P2, ADR-018). Satellites consume clinical events and never change clinical aggregates; no kernel, ADT or order command calls them synchronously, so an outage never blocks clinical work (SI-12). Each arrives with its work package: the renderer in WP-0.8, RCM in WP-1.9 (§21).
