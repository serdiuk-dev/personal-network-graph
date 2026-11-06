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


## Updated candidate evidence — 2026-11-06

This section supersedes the obsolete status/checkpoint at the top and the
pending logout/foreground-expiry items in gate 3.

Candidate: f371a1974ba2555c929a8c1e0b2ea020a9db0394.
Status: device acceptance updated; final release review and approval pending.

Completed:
- WEB icon deployment returned DEPLOY_OK: API_WEB_HEALTHY_DB_UNCHANGED;
  the owner subsequently confirmed WEB operation.
- The existing Node 24.22.1 API image was retained.
- iPhone restoration, eight-icon visibility and foreground 16-minute
  note-save/WEB verification were confirmed by the owner.
- Explicit logout, inactive old connection, re-enrollment and Face ID
  were already accepted.
- Completed tests and deployments are not to be repeated merely for onboarding.

Deployment/rollback record:
- API: sha256:1fb584fdd52ae9b2aca0df6282f04e71f0a596a409c6fe9ffd585ec81ae49588
- WEB: sha256:0a0183e4db64c138d05a6ad2f36ba7114821c464b5872772f1c67e76b4a80aae
- VDS rollback image references: /root/pnet-icons-rollback.SK6zvJiM
- Compose host PNET_AUTH_KEY_FILE must be /opt/pnet-secrets/auth-key;
  the API-internal value is /run/secrets/pnet_auth_key.
  Do not reuse the earlier rollout wrapper that copied the internal path
  into the host Compose environment.
- No migration was performed for this icon deployment.

Remaining review:
- Map historical test evidence to candidate changes; no full-system test
  pass is claimed for this exact candidate.
- scripts/auth/test-isolated.sh has historical branch/HEAD guards:
  do not run it unchanged or bypass those guards.
- Refresh-response loss, biometric-set changes, native redirect/TLS failures
  and interrupted writes remain unverified native scenarios.
- Proposed scope is a private Personal Team development installation.
  Public/App Store distribution is not accepted.
- Device/accessibility coverage, HEIC/size boundaries, notification delivery
  and interruption evidence retain their documented limitations.
- Confirm retained native backups and signing guidance, review final diff,
  explicitly decide remaining blockers/exclusions, then obtain release approval.
- Preserve backups and rollback. No additional deployment is required solely
  for documentation. Optimization/cleanup comes last; social adapters deferred.
