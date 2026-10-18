# Helm charts

Helm charts for the HMS services and the platform components, with the upstream operators and charts they depend on: CloudNativePG, Strimzi, the Keycloak Operator, the Temporal and OpenFGA charts, and official Valkey images; no Bitnami images or charts (BUILD-PROMPT §4.1). The dev cell uses the production charts (§5.1), and chart versions are pinned under the §4.1 rule and recorded in ADR-002 and the SBOM. WP-0.2 writes the first charts for the dev cell; later work packages add charts for their services, and the release tier (WP-0.9) signs them.
