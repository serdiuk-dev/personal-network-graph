# v0.41.0: owner authentication operations

Status: production-validated on 2026-09-29. The isolated Docker tests,
verified backup/restore, migration, owner bootstrap and browser acceptance passed.

## Scope and audit result

The v0.40.0 external WEB and sampled API URLs returned a Basic Auth challenge.
The same data routes through the local API and WEB proxy returned HTTP 200
without application authentication. Basic Auth is an existing perimeter layer;
this release adds authorization inside the application. Keep the existing
Traefik configuration and Basic Auth during rollout.

One owner per installation, no guest, registration, invitations or public setup.
The only public API handlers are GET /api/v1/health and POST /api/v1/auth/login.
All other controllers inherit the global authentication guard, including graph,
analytics, people, taxonomy, reminders and message sending. Future controllers
are protected unless explicitly reviewed and marked public.

Login requires a password and a TOTP code, or the password and one unused recovery
code. TOTP is not phishing-resistant; passkeys remain a separate enhancement.
No shared owner credentials or installation encryption key are shipped.

## Security properties and limits

- Passwords: Argon2id, 64 MiB, 3 iterations, parallelism 1, independent salts.
  Operator CLI enforces 16–128 characters. Use a unique password-manager-generated
  password. No password command arguments or environment variables.
- TOTP: SHA-1, 6 digits, 30 seconds, one-step drift. Secret encrypted with AES-256-GCM
  under a unique 32-byte installation key. A database row lock prevents concurrent
  replay. Server time must be synchronized. A consumed code cannot be reused.
- Recovery: ten random 128-bit codes; only SHA-256 hashes are stored. Consuming a
  recovery code is atomic and revokes previous sessions. It does not replace the
  password or rotate a lost authenticator: perform an operator reset afterward.
- Sessions: random 256-bit opaque token, only its hash in PostgreSQL; at most five
  active sessions. Absolute lifetime 12 hours, inactivity limit 30 minutes since
  the last authenticated API request (background refresh also counts).
- Cookie: __Host-pnet_session, Secure, HttpOnly, SameSite=Strict, Path=/, no Domain.
  CSRF token stays in WEB memory. Mutations require the exact configured HTTPS
  Origin and session-bound X-Pnet-CSRF header. Login also validates Origin.
  Forwarded headers do not decide cookie security or bypass authentication.
- Global single-owner limiter: at most 10 login attempts per 60-second window and
  30 per 15-minute window, persisted in PostgreSQL across API restart. Two Argon2
  verifications per process at a time. Spoofed X-Forwarded-For does not evade the
  limit. An attacker can temporarily exhaust the login budget; this is a
  deliberate single-owner tradeoff, with the existing Basic Auth as an outer layer.
- API JSON body bound remains 100 KiB; login fields have much smaller DTO limits.
  API responses and WEB resources use no-store. Sensitive internal errors are
  suppressed; no credentials, bodies, cookies or query strings are logged by auth.
- WEB unmounts private views and aborts pending requests on 401 or confirmed logout;
  logout is broadcast to other open tabs. Failed network logout does not claim
  server-side revocation. Session is rechecked on browser focus/pageshow.
- HTTPS, private deployment files, SSH access and database/network isolation remain
  required. Authentication is not protection against a compromised host or XSS.
  Existing reminder workers continue operating without a browser session.

## Candidate validation — no production migration

Apply the reviewed patch on feature/security-auth-baseline at v0.40.0.
Run `bash scripts/auth/prepare-lock.sh`: Node 24 Docker updates only the API lock
file, rejecting changes to any existing locked version, integrity or source.
Prisma and @prisma/client stay at 6.19.3.

Run `bash scripts/auth/test-isolated.sh`. It uses only compose.auth-test.yaml,
`--env-file /dev/null`, a unique project name, no published ports, an internal
network and PostgreSQL 17 on tmpfs. No production database, credentials or
volumes are mounted. It applies the migration chain, runs crypto and PostgreSQL
integration tests, and checks every actual controller route without a session.
It verifies the production container IDs, images, start times and restart counts
are unchanged. Test containers are stopped afterward; no volume/prune command is
used. Test images cannot replace the pnet-api production image tag.

Build WEB separately with Docker Node 24 before deployment. Review package-lock
changes, the additive migration, the complete diff and test output before release.
The local development environment cannot run Docker; the VPS isolated test is an
explicit gate, not an assumed result.

## Production gates (operator-assisted rollout)

Do not run these gates until candidate tests pass:

1. Verify branch, status and HEAD; review diff. Record running image IDs and tag
   both current API and WEB images for rollback before building production tags.
2. Create a PostgreSQL backup outside the Git repository and verify a restore in
   an isolated database. Retain the existing production volume. Record backup and
   rollback paths without printing database credentials.
3. Create a unique installation key in a root-owned private directory outside the
   repository. The API container runs as UID 1000: make the key file readable only
   by that UID (0400), with the host directory protected from other host users.
   Generate the key into the file directly, never into terminal output or history.
4. Create a root-owned 0600 operator environment file, e.g. /root/pnet-auth.env,
   containing PNET_PUBLIC_ORIGIN (exact HTTPS origin, no trailing slash) and
   PNET_AUTH_KEY_FILE (absolute host path). It contains no default owner credentials.
5. Production Compose invocation must include **both** original files and the auth
   overlay, and preserve the original .env through two --env-file arguments:

   ```sh
   docker compose --profile '*' --env-file .env --env-file /root/pnet-auth.env \
     -f compose.yaml -f compose.override.yaml -f compose.auth.yaml ...
   ```

   Never print rendered Compose config. Never drop the auth overlay for a later
   recreate/build/deploy. Missing key/origin causes the new API to fail closed.
6. Build an API migration runner from the Node 24 build stage. Apply only
   `prisma migrate deploy` with Prisma 6.19.3 against the backed-up database;
   never use db push, migrate reset or migrate dev in production. This migration
   only adds Owner, OwnerSession and AuthAttempt tables; no existing rows change.
7. Run owner bootstrap through the API image CLI, with a private provisioning
   directory mounted at /owner-setup, owned by UID 1000 and mode 0700. The CLI
   connects directly through Prisma; it does not start the application or scheduler.
8. Deploy only api and web using --no-deps --no-build. Do not recreate db,
   Traefik, n8n or OpenGym. Verify private API reads and mutations now return 401,
   health is 200 locally, existing outer Basic Auth remains, then test WEB login.

Exact backup, migration and deployment commands are deliberately issued only after
reviewing the isolated test result and live deployment checkpoint.

## Owner CLI usage

Commands below require completed configuration/migration gates and the reviewed
API image. They do not run migrations implicitly. The provisioning directory
must be a fresh private directory containing no existing provisioning.txt.

```sh
docker compose --profile '*' --env-file .env --env-file /root/pnet-auth.env \
  -f compose.yaml -f compose.override.yaml -f compose.auth.yaml \
  run --rm --no-deps -v /root/pnet-owner-setup:/owner-setup \
  api node dist/auth/owner-cli.js bootstrap
```

The CLI prompts for login, password and confirmation. Password input is hidden.
It writes the authenticator setup key/URI and recovery codes to
/root/pnet-owner-setup/provisioning.txt on the host, mode 0600. No codes are printed.
In a second terminal, securely download that file to a private local directory,
open it locally and save it in a password manager. Never upload it into chat or
GitHub. Configure the authenticator, then type its current code into the CLI.
Only successful verification activates the owner. Bootstrap then refuses any
additional owner, including concurrent invocations. Wait for the next TOTP code
before signing in. The singleton database constraint also prevents extra owners.

A failed/cancelled setup may leave an inactive provisioning file. Preserve it
privately until the outcome is understood. Use a fresh directory for a retry;
never overwrite provisioning material automatically.

## Recovery and revocation

- If a device is lost but password and recovery codes are available, sign in with
  one unused recovery code. This immediately invalidates prior sessions.
- To rotate the password, authenticator and recovery codes, repeat the operator
  flow with a fresh private provisioning directory and CLI command `reset` instead
  of `bootstrap`. After factor confirmation, replacement and session revocation
  are atomic. Old password, factor and recovery codes no longer work.
- To revoke all sessions immediately, run the same Compose invocation without the
  provisioning mount and use `api node dist/auth/owner-cli.js revoke`.
- If password and factors are lost, recovery requires SSH/operator access and
  `reset`. There is no public recovery endpoint or email-based bypass.
- Back up the installation encryption key separately and securely from database
  backups. A restored database needs the matching key. If the key is lost or
  compromised, create a replacement key and perform an operator reset; restart
  the API with the new key. Never silently regenerate it at every startup.
- After restoring an old database backup, revoke all sessions and reset factors:
  restoring can otherwise resurrect consumed recovery codes and old sessions.
- Once provisioning is safely stored and validated, remove its temporary copies
  explicitly under operator control. Keep no screenshots or terminal transcripts
  containing the private provisioning contents.

## Rollback boundary

Keep the new additive tables if code rollback is required; do not reverse the
migration by dropping tables. Restoring the old API removes application-level
protection, so it is only a temporary recovery option while the already-verified
outer Basic Auth and loopback bindings remain enforced. Prefer fixing forward.
Never remove a production volume. A database restore is a separate reviewed
operation, not an automatic consequence of an application failure.

## Release acceptance

Required evidence: isolated Docker test success; API/WEB Node 24 builds; reviewed
lockfile and additive migration; verified backup/restore; successful CLI bootstrap;
unauthenticated API denial; login/logout, expiry and CSRF; closed registration;
reset/recovery rehearsal on the isolated DB; browser 360/768/1440 and keyboard
checks; existing people/graph/reminders regression. Do not mark stable until all
production and release checks are complete.
