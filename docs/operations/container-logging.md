# PNet container logging

On 2026-10-02, Docker inspection confirmed these effective settings
for pnet-db-1, pnet-api-1 and pnet-web-1:

- Driver: json-file.
- Maximum file size: 10m.
- Maximum retained files: 5 per container.

The same policy is now declared explicitly in compose.yaml for db,
api and web, making subsequent deployments independent of daemon defaults.
Merged configuration across all four production Compose layers was validated against the running containers; all three policies match.

Existing containers already use these settings; no recreation is needed.
This change does not modify the Docker daemon, other projects or journald.
Log contents are private operational data and must not be committed to Git.
Do not manually truncate or remove Docker-managed log files.

This policy bounds Docker container logs only. Backup sets, recovery
checkpoints and system journal storage require separate policies.
