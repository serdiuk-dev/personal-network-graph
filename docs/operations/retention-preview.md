# Retention preview implementation

Retention preview production-validated on 2026-10-03.
v0.43.0 remains in progress; release pending.

## Confirmed checkpoint

- Eight isolated retention tests passed on the VDS.
- Production preview: keep=2, candidates=0, invalid_scheduled=0.
- One incomplete entry and 15 other entries were excluded and preserved.
- Current report ownership and permissions verified: root, 0600.
- deletionEnabled=false; no backups deleted.
- No restore, payload rehash, application rebuild or restart performed.
- This checkpoint does not establish the trigger of the second backup.


Policy: keep all recognized successful sets completed within the last 30
elapsed days (UTC), plus at least the latest 14 recognized successful sets.
Keep the newest successful set and the last-success pointer target regardless
of age. These rules form a union, not a maximum of 14 sets.

The 2026-10-02 metadata inventory reported 79.31 GiB free on a 95.82 GiB
filesystem. One scheduled set used 0.14 MiB, one incomplete set 0.13 MiB,
and 15 other entries 1.17 MiB. This small sample is not a growth forecast.
The policy is deliberately conservative; deletion is disabled.

## Invocation

From the project directory, run as root:

```sh
python3 -B scripts/reliability/retention_preview.py
```

This is an on-demand calculation, not an enabled retention timer.
It briefly acquires the existing backup/deploy lock, failing immediately if
busy. Run outside the daily backup window. It refuses pending recovery.
It never calls Docker, stops the API, modifies backup payloads, moves sets
or deletes backups. There is no delete/apply mode.

Only scheduled-db-media-* sets with recognized names, valid success/recovery
metadata, ordered timestamps, matching checksum maps and exactly the expected
private regular files can enter selection. Symlinks, hardlinked files,
unexpected contents and malformed sets are excluded and preserved.
Manual/release backups and incomplete sets are preserved without traversal.
If the last-success target cannot be validated, the entire preview fails.

Only manifest and checksum-map JSON is read. Database dumps, media archives,
image metadata and photo hash lists are not read. No hashes are recomputed
and no restore is performed: metadata eligibility does not prove integrity.

## Private report

The only output file is:
`/opt/pnet-backups/.automation/retention-preview.json` (root, 0600).
It is atomically replaced after a successful calculation. No recovery marker,
last-run, last-success or deployment checkpoint is changed.
Console output contains counts only. Unknown/private entry names are omitted.

Report fields include generatedAt, policy, keep, candidatesOnly,
excludedCounts, candidateAllocatedBytes and deletionEnabled=false.
Apparent bytes count regular-file lengths; allocated bytes count filesystem
blocks for each validated set including its directory. These estimates are
not a guarantee of space recoverable on snapshotting/compressed filesystems.

A failed invocation may leave the previous report; inspect generatedAt.
Candidates are only a proposal. Future deletion requires a separately reviewed
implementation that rechecks state and integrity under the shared lock.
The current keep-all policy remains effective, including after preview.
