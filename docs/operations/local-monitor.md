# Local backup and container monitoring

Local monitor production-validated on 2026-10-02.
v0.43.0 remains in progress; release pending.

## Confirmed monitoring checkpoint

- Eleven isolated monitor tests passed on the VDS.
- systemd unit verification passed.
- Installed monitor completed at 2026-10-02T19:42:27 UTC:
  status=ok, alerts=[], containerChecks=completed.
- Observed backup age: 45986 seconds, below the 26-hour threshold.
- Five-minute monitor timer enabled; next execution was scheduled.
- No application rebuild, container recreation or new backup was needed.
- Failure paths were tested with synthetic data; no production outage induced.
- No repeated restore or checksum rehash was performed.
- Private operational reports remain on the owner's VDS, outside Git.
- First daily scheduled backup execution has not yet been confirmed.


## Scope and schedule

`pnet-monitor.timer` invokes `pnet-monitor.service` every five minutes,
with a 30-second scheduling tolerance and first boot check after three minutes.
The oneshot runs as root with umask 0077 and a 120-second timeout.
It does not restart services, run backups, recover deployments, delete sets,
query contacts or photos, read env/key files, or send external notifications.
No Compose change, rebuild or container recreation is required.

The latest report is atomically replaced at:
`/opt/pnet-backups/.automation/monitor-status.json` (root, 0600).
Only timestamps, age, status and fixed diagnostic codes are written.
Raw command output, labels and healthcheck logs are never published.
Read `checkedAt` as well as `status`: an old report is not proof of current health.
If monitoring itself fails, the service exits nonzero and the prior report may
remain. The journal records `PNET_MONITOR_ERROR` without raw exception text.

## Checks

- Last successful backup and its manifest must identify a completed, recovered
  pnet-db-media-v1 set. The directory and two nonempty artifacts must have the
  expected private ownership, types and permissions.
- The older of manifest/pointer completion timestamps must be at most 26 hours
  old. This allows a 25-hour local day plus an operational margin. A future
  timestamp more than one minute ahead is an error.
- The backup timer must be loaded, enabled and active. The backup service must
  be loaded; its failure result is checked outside maintenance.
- Without active maintenance: last-run must be successful, recovery markers
  must be absent, DB must be running normally, and API/WEB must be healthy.
- DB process state is not DB readiness. Existing API/WEB healthchecks provide
  liveness; they do not validate every application function or external HTTPS.
- No restore, checksum rehash or media scan is repeated by this monitor.
  Artifact presence and metadata do not prove full backup integrity.

## Maintenance handling

The monitor observes the existing backup/deploy flock through Linux
[`/proc/locks`](https://www.man7.org/linux/man-pages/man5/proc_locks.5.html),
matching device and inode. It never acquires the backup lock, so its periodic
checks cannot cause a scheduled backup to fail with BACKUP_BUSY.
Run on the VDS host in its normal PID namespace, not inside a container.

When the shared lock is busy, container/recovery/last-run checks are deferred.
Backup age and timer checks continue. Busy status is explicit, not health success.
Continuous observed busy time over 30 minutes is an alert; timing starts at the
first monitor observation, not necessarily at the operation's actual start.
A lock-state transition during collection causes maintenance deferral.
This is periodic observation, not an atomic snapshot of all system state;
short transitions may only be resolved by the next check.

## Operator commands

```sh
systemctl list-timers pnet-monitor.timer --no-pager
systemctl show pnet-monitor.service -p ActiveState -p Result
cat /opt/pnet-backups/.automation/monitor-status.json
journalctl -u pnet-monitor.service -n 12 --no-pager
```

`PNET_MONITOR_OK`: checked conditions passed. `PNET_MONITOR_BUSY`: maintenance
deferral, with no other detected alert. Both exit 0.
`PNET_MONITOR_ALERT` or `PNET_MONITOR_ERROR`: exit 1; inspect fixed diagnostic
codes and the existing backup/deploy runbooks. Subsequent timer executions
retry automatically. Do not remove recovery markers to silence an alert.

For BACKUP_STALE, LAST_BACKUP_RUN_FAILED or BACKUP_SERVICE_FAILED, inspect the
backup service journal and its private state before retrying a backup.
For recovery alerts, follow the documented explicit recovery procedure.
For API/WEB_NOT_READY, inspect the affected service locally; do not paste raw
application logs containing private data into Git or public issues.

This monitor relies on the VDS, Docker and systemd. It cannot notify the owner
when the entire host is down and does not provide an off-server alert channel.
It does not monitor itself externally. Old/incomplete backups are retained.
Monitoring journald storage globally remains outside this PNet-only change.
