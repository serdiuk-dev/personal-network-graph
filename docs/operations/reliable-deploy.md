# API/WEB healthchecks and explicit local-image deployment

Healthchecks and same-image deployment production-validated on 2026-10-02.
v0.43.0 remains in progress; release pending.

## Confirmed deployment checkpoint

- Eight isolated deploy/recovery tests passed on the VDS.
- Deployment env permissions validated; installed backup script updated.
- Production apply-current rollout returned:
  DEPLOY_OK: API_WEB_HEALTHY_DB_UNCHANGED.
- API and WEB are running with Docker health status healthy.
- Exact running API/WEB images preserved; no application rebuild or pull.
- Database fingerprint and API/WEB private mounts remained unchanged.
- All four required Compose layers retained.
- Backup/deploy share one lock; pending deploy recovery blocks new backups.
- Failure/rollback paths validated with fake Docker; no forced production
  rollback, process-crash test or host reboot was performed.
- Existing health endpoint is application liveness, not DB readiness.
- Docker unhealthy status alone does not trigger automatic restart.
- Contacts, photos, backups, env files and auth key remain outside Git
  on the owner's VDS.

Backup automation is already accepted; see private-backup.md.

## Healthcheck scope

API: Node 24 fetches /api/v1/health locally with a three-second request timeout,
requires HTTP 200 and the JSON status=ok/service=pnet-api. Existing endpoint and
owner authentication are unchanged. This is application liveness, not a database
readiness guarantee: the existing controller does not query PostgreSQL.

WEB: installed BusyBox wget checks the root page and the nginx /api/v1/health
proxy, requiring the expected API service marker. It detects a broken proxy as
well as a stopped WEB server. Both probes use loopback inside their containers;
Traefik Basic Auth remains active externally.

Probes live in the existing compose.yaml. All deployments retain compose.yaml,
compose.override.yaml, compose.auth.yaml and compose.media.yaml in that order.
The existing declared DB healthcheck is unchanged; this rollout never recreates DB.
API uses 20s interval, 6s timeout, 30s start period and 3 retries. WEB uses 20s
interval, 10s timeout, 20s start period and 3 retries.

restart: unless-stopped remains unchanged. It recovers exited container processes,
but Docker does not restart a still-running process solely because its healthcheck
is unhealthy. Unhealthy status is diagnostic; no autoheal daemon or VPS reboot is
introduced. During the scheduled backup, the API is deliberately stopped and the
WEB proxy can temporarily become unhealthy. This does not trigger automatic deploy.

## Deployment contract

Run scripts/reliability/deploy.py as root on the VDS with an explicit expected Git
HEAD. Deployment environment files .env and /root/pnet-auth.env must be regular,
root-owned 0600 files. Their contents, rendered Compose configuration, command
stderr and container environment are never printed. Resolved configuration is
checked internally for origin, DB URL, auth key, private media, volume names,
restart policy and enabled healthchecks. Missing layers/config fail before mutation.

--apply-current pins the exact running local API/WEB image IDs and applies the
new container configuration without building or downloading application images.
Future deployments may explicitly pass both --api-image sha256:... and
--web-image sha256:... after independently validating those local candidates.
No implicit latest tags, build, pull, migrations, schema edits or release occur.
The script does not establish that a future candidate is compatible with the DB;
validate any migration and rollback boundary separately before using it.

The deploy acquires the same /opt/pnet-backups/.automation/backup.lock as backup.
The installed backup script must be updated with this patch before deployment.
A private durable deploy-recovery.json marker blocks future backups/deployments
until a pending rollout is recovered. No-op backup recovery returns without taking
the lock when there is no backup recovery marker, so ExecStopPost cannot interfere
with a simultaneous deployment after a completed backup.

Before mutation the script records original image IDs, healthcheck definitions,
mount configuration, DB fingerprint and hashes of all four Compose layers and
private env files. These records and temporary image-selection overlays are
root-private under /opt/pnet-backups/.automation/deploy-*. No private file contents
are copied into these records. The extra local overlay only pins images; rollback
also restores the previous API/WEB healthcheck definitions. The four required
application layers are always retained.

API is recreated first and must become healthy; WEB is recreated next to refresh
nginx's resolved API address and must become healthy. Expect brief unavailability,
including healthcheck waiting time (normally tens of seconds; up to 150s per probe
wait plus container start time). DB, Traefik, n8n and Open_gym are not recreated.
Exact private mount configuration is compared afterward and DB fingerprint must
remain unchanged. This is an application rollout, never a data restore.

## Failure and interruption

A failed rollout or handled signal attempts a rollback of both API and WEB to
the previous local image IDs and healthcheck configuration. API then WEB order
is retained. Even a failure during the API phase recreates WEB, so it resolves
the restored API address. Successful rollback removes the marker and leaves the
failed deployment visible as a nonzero exit. Nothing removes or restores volumes.

SIGKILL/host power failure cannot run Python cleanup. The durable marker stays;
backup refuses to proceed until explicit operator recovery. There is no automatic
host reboot or deployment recovery timer. After Docker is available, preserve the
recorded Compose/env contents and run the script with --recover and the current
explicit expected HEAD. If input hashes differ, recovery fails closed; do not delete
the marker to bypass this guard. Examine the root-private checkpoint and restore
its reviewed configuration before retrying. A backup marker must be recovered with
the installed backup.py --recover before any new deployment.

Recovery needs both original local images and Docker/storage to remain usable.
The script does not prune images or retain rollback tags; image cleanup remains
a separate controlled stage. No guarantee is made that application bugs or host
storage failures can always be recovered automatically.

## Commands and acceptance

Apply current images:

```sh
python3 -B scripts/reliability/deploy.py --expected-head <approved-commit> --apply-current
```

Explicit pending deployment recovery:

```sh
python3 -B scripts/reliability/deploy.py --expected-head <current-commit> --recover
```

Unit tests use fake Docker and temporary fixtures; no DB/photos/messages are used.
Production acceptance must record API/WEB healthy status, selected image IDs,
preserved mounts and unchanged DB fingerprint. Test only these new checks. Do not
repeat the v0.42.0 restore, stable image builds or general baseline tests. A real
production rollback is not forced merely to duplicate the mocked failure tests.

Remaining v0.43.0 scope includes log rotation and minimal failure/health visibility,
retention policy (no deletion yet), the first scheduled-backup observation and release
record. All contacts, photos, environment files, auth keys and backup data remain on
the owner's VDS outside Git. Future off-server data transfer requires a separate
explicit decision. No social adapters or final cache cleanup are added here.
