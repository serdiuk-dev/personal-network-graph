# Private backup retention

## Current policy

Keep all existing backup sets. Automatic deletion is disabled.
Backup contents and operational reports remain on the owner's VDS,
outside Git. No off-server destination is currently authorized.

## Preview implementation (production-validated on 2026-10-03)

- Produce a private retention proposal without deleting or moving files.
- Consider only this automation's scheduled-db-media-* directories.
- Require the expected manifest format, successful completion and
  confirmed API recovery before a set can enter retention selection.
- Preserve the newest successful set and the set referenced by
  last-success.json regardless of age.
- Preserve manual/release backups, incomplete sets, unknown entries,
  symlinks and malformed sets; report exclusions without following links.
- Within .automation, write only retention-preview.json; never modify
  recovery markers, backup status records or deployment checkpoints.
- Coordinate inspection with backup/deploy to avoid partial-set decisions.
- Preview policy: retain all successful sets from the last 30 elapsed
  days and at least the latest 14 successful sets (union of both rules).
- Implementation and limitations: see retention-preview.md.
- Recheck state and integrity before any future deletion implementation.
- Enabling deletion requires a separate reviewed change; this document
  does not enable it.

## Capacity and limitations

A local backup protects against some application and operator failures,
but not loss of the VDS or its disk.
Keeping every set indefinitely grows disk usage.
Capacity reporting must distinguish apparent size from allocated disk
space and must not expose contact data, photos or secret contents.

The initial inventory reads filesystem metadata only. It does not prove
backup integrity and does not repeat restore or checksum verification.
