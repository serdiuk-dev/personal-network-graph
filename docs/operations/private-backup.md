# Production Reliability: private paired backups

Backup automation production-validated on 2026-10-02.
v0.43.0 Production Reliability remains in progress; release pending.

## Confirmed automation checkpoint

- Initial nine isolated automation tests passed on the VDS.
- Three targeted ownership-fix tests passed on the VDS.
- First production attempt rejected root-owned Docker staging metadata;
  API recovery succeeded and the timer remained disabled.
- The correction validates source media ownership inside API and records
  numeric 1000:1000 in tar headers without changing production media.
- Successful paired backup:
  /opt/pnet-backups/scheduled-db-media-20261002T065527868055Z.
- New-set checksums, private host permissions and archive ownership passed.
- API recovery confirmed; systemd service finished successfully.
- Daily timer enabled for 04:15 Europe/Kyiv. First scheduled execution
  is expected on 2026-10-03 and has not yet been observed.
- Boot recovery unit enabled; no production reboot rehearsal performed.
- No repeat restore, stable rebuild, migration or old-backup deletion.
- Contacts, photos, backup contents and secrets remain on the owner's VDS,
  outside Git. This checkpoint publishes source and documentation only.

The stable v0.42.0 backup/restore evidence is already recorded; do not repeat it.

## Storage and ownership

Git contains source code, non-secret configuration and documentation only.
People records and uploaded photos remain on the owner's VDS in pnet_db_data
and pnet_contact_media. Backups and automation state remain outside Git under
/opt/pnet-backups, root-owned 0700 directories and 0600 files. Never attach a
backup, contact export, photo-hashes file, auth key or deployment environment to
chat or a source archive. No off-server transfer is implemented or authorized
by this phase. Keep the matching installation encryption key separately and
privately, as described in ../security/owner-auth-operations.md.

## Mechanism

scripts/reliability/backup.py runs as root using Python's standard library and
Docker CLI. No application build, migration, volume removal or Compose mutation.
Container identity, project/service labels, private volume mounts, running state,
exclusive running volume users and available disk space are checked immediately
before changing the API state. The free-space estimate uses twice the database
and media sizes plus 1 GiB reserve; it cannot guarantee capacity against other
services consuming disk concurrently. Only this automation shares its flock;
operators must not deploy, run another backup, execute mutating SQL/owner CLI or
write media manually while it runs. API is the sole application writer.

A durable recovery marker is fsynced before stopping the original API container.
PostgreSQL stays running. pg_dump --format=custom and docker cp -a of the stopped
API's /app/private-media produce the consistent pair. pg_restore --list checks
the dump catalogue, without restoring or changing any DB. Then the original API
ID is started, and its internal health must return 200. This preserves all four
Compose overlays, networks, secrets and mounts; WEB/DB are not stopped or recreated.
Compression, media hash verification and publication happen after API recovery.

Before stopping, the API validates source media entries: only regular files and
directories, owner 1000:1000, modes 0600/0700. Docker may create a host staging
copy owned by root even with cp -a. Both root-owned and preserved node-owned
staging entries are accepted inside the root-only backup directory; permissions
and entry types remain checked. Tar headers explicitly record numeric 1000:1000
with empty user/group names, and archive metadata/hashes are verified. No chown
is performed on production media or the staging copy. Regression tests cover
this ownership mapping and refusal of invalid source metadata before stopping.

The set contains database.dump, media.tar.gz (relative root '.', numeric ownership
1000:1000, directory mode 0700 and regular file mode 0600), photo-hashes.json,
images.json, dump-catalogue.txt, sha256.json and manifest.json. No secrets are
printed. Media inventory retains private filenames/hashes only on the VDS.
SHA256 detects accidental corruption, not tampering by a host administrator.
The format is standard PostgreSQL custom dump plus tar.gz; this automation's
checks are not a new restoration proof (manifest.restoreTested stays false).

The .incomplete-scheduled-* directory becomes scheduled-db-media-* by atomic
rename only after successful checks and recovery. Files/directories are fsynced
before publication. Never restore an incomplete set. Failed sets stay private
for diagnosis; no retention, deletion of old backups or media cleanup is enabled.
Only the current run's redundant media staging directory is removed after its
archive hashes and permissions pass. Disk consumption must be watched until
explicit retention work is completed.

## Scheduling and recovery

Installed script: /usr/local/lib/pnet-backup/backup.py, independent of subsequent
Git worktree edits. Reinstall the reviewed script when changing the automation.

pnet-backup.timer schedules daily at **04:15 Europe/Kyiv**, with one-minute timer
accuracy. API is briefly unavailable while dumping DB and copying media; duration
depends on their size. Persistent=false avoids unexpected daytime catch-up after
downtime. This means a missed run is skipped and the last-success age must be watched.

pnet-backup.service executes the backup with a 20-minute limit. Python finally
attempts API recovery on errors/signals; ExecStopPost retries recovery even after
a killed process. A separate enabled pnet-backup-recovery.service handles a
remaining recovery marker after host boot. No reboot is required for installation.
Recovery validates the saved original container ID/image and Compose labels;
it cannot guarantee availability if Docker/storage/API itself is broken or the
original container was removed. A failed recovery keeps the marker and fails
visibly in systemd. Do not delete the marker to hide a failure.

Local unit tests use fake Docker and temporary fixtures only. The first actual
service run verifies the new production backup path and real stopped-container
copy, without a database restore or repeat of the stable release tests.

## Operator commands

Run one backup: `systemctl start pnet-backup.service`.
Inspect failure: `systemctl status pnet-backup.service --no-pager` and
`journalctl -u pnet-backup.service -n 20 --no-pager` (only sanitized status messages).
Check next run: `systemctl list-timers pnet-backup.timer --no-pager`.
Private result files: /opt/pnet-backups/.automation/last-run.json and
last-success.json. last-success does not replace last-run: failures preserve the
previous success. If recovery.json remains, run the installed script with
`--recover` once Docker is available; confirm success before retrying backup.

Disable future backups: `systemctl disable --now pnet-backup.timer`.
Disabling the timer does not stop an in-progress backup. The boot recovery unit
should remain enabled while a recovery marker can exist.

Restore is a separate operator action: select a successful matching DB/media set,
verify all manifest checksums, quiesce writers and restore both with preserved
numeric ownership/permissions and the matching separately stored auth key.
Revoke sessions and reset authentication factors after restoring an old DB,
as required by the owner-auth runbook. Never restore production automatically
because a backup or health probe failed.

## Remaining Production Reliability scope

Production acceptance of this automation, deliberate retention policy (initially
no deletion), healthchecks/recovery/deploy improvements, log rotation and failure
visibility. Off-server encrypted storage requires a future explicit change of
the current VDS-only data policy and a selected destination. Separate mobile app,
full-system release-candidate tests and final documentation/cleanup come later.
Social adapters remain deferred. This patch alone does not close v0.43.0.
