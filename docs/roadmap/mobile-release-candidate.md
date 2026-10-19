# Mobile release preparation — 2026-10-18

Status: preparing RC; no release tag, merge or new server deployment performed.
Implementation checkpoint: b5bdba35e129fc77e3ff304cecd41eec8a223f93.

## Evidence already available — do not repeat as onboarding

Core device acceptance plus the dated scoped UX, accessibility and session/network
scenarios are summarized in apps/mobile/VALIDATION.md. JS bridge mocks are not
native security tests. API integration/migration and earlier deployments are
historical completed evidence. The latest contact-delete/global-style patch passed
six focused transport tests, Mac build/sync/installer checks and physical use.

## Remaining gates

1. Publish consolidated documentation and verify the exact candidate source.
2. Inspect existing repository release/test scripts and choose the Full System
   Test commands for the candidate. Use only isolated test databases, never
   production fixtures, secrets or migrations. Record actual execution results.
3. Review unresolved native edge cases: explicit mobile sign-out/re-enrollment,
   refresh response loss, foreground access expiry, biometric-set changes,
   native redirect/TLS failures and interrupted writes. Do not reset production
   biometrics merely to test; use an isolated environment or retain an explicit
   unverified limitation. Do not silently equate UI success with those checks.
4. Retain limits on device-range and accessibility coverage, HEIC/size boundaries,
   notification delivery and UI-only upload interruption evidence. Decide which
   are release blockers versus documented scope exclusions before acceptance.
5. Verify signing/renewal instructions and retained native rollback backups.
   Personal Team requires periodic renewed builds; this is a development install,
   not App Store distribution or a permanent installation.
6. Review candidate diff and release evidence; then obtain release/merge approval.
   Align VDS Git using established safeguards; deploy only if server code differs
   from the running accepted images. Preserve backup/rollback images.

## Route inventory result

Reviewed shared UI routes for contacts, relationships, taxonomy/assignments,
channels, events/reminders, photos, global graph styles, relationship styles,
network overview and graph reads. They are supported by the current native
allowlist. JS permits broader read syntax, but Swift is the final exact read gate.
No blanket permission expansion is needed. Messages remain blocked; social
adapters and iOS notifications are outside current implemented scope.

## Final stage

Optimization/cleanup follows core completion and release review. Inventory first;
keep backups, usable rollback images and native installer backups. Do not touch
Traefik, n8n, OpenGym, adjacent projects or global Node. Social adapters stay backlog.
