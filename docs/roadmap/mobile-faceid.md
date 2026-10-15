# Mobile Face ID / trusted device implementation

Base: d0fe48dad8b8b8cd61a64f57854ec9a74ffa6c4b, feature/iphone-app.
Status: implementation prepared; NOT deployed or accepted on a physical device.

## User flow

1. First connection: website BasicAuth + owner password + TOTP/recovery code,
   and Face ID. Existing saved v1 sessions require this one-time reconnection.
2. Later cold starts and returns from the background: Face ID unlocks the vault;
   server access is verified and an expired short access session can be renewed.
3. Sign out disconnects the device on the server and clears the local vault.
4. WEB: Devices -> Connected phones -> Revoke access immediately removes both
   access sessions and renewal credentials for that phone.
5. Reconnect device on the error screen clears local access and opens full sign-in.
   It cannot revoke an inaccessible server credential; remove the old entry in WEB.

## Security boundaries

- Face ID is required; no silent passcode fallback. A cancelled/failed prompt
  leaves the app locked. Changes to enrolled biometrics invalidate vault access.
- Keychain v2 uses biometryCurrentSet and WhenPasscodeSetThisDeviceOnly;
  no iCloud synchronization. LAContext is invalidated and in-memory credentials
  are released when the application enters the background.
- Owner password and TOTP are never persisted. Gateway BasicAuth credentials,
  access token and refresh token reside in the protected native vault and are
  never returned to JavaScript. The enrollment flag in UserDefaults is not secret.
- Face ID is a local Keychain control, not server-side device attestation.
- The server stores SHA256 hashes of random 256-bit bearer credentials.
- Access lifetime: 15 minutes, capped at device expiry. Device trust: 30 days
  absolute, 7 days without renewal, maximum five enrolled phones.
- Refresh rotates the credential and invalidates the previous access token.
  Used refresh hashes are retained for the device lifetime; reuse revokes the
  entire device. Owner-row locking serializes enrollment, rotation, revocation,
  operator resets and lost-factor recovery.
- Strict rotation is deliberately fail-closed: loss of a successful refresh
  response followed by reuse can revoke the device and require full sign-in.
  There is no replay grace window. Concurrent refreshes must be coalesced.
- A mutation rejected after access expiry is NOT automatically replayed. The app
  revalidates; reload and inspect data before retrying a change.
- Disconnect accepts proof of possession of a current or previously used device
  refresh credential; it does not require a still-live access session.
- Recovery-code login and operator reset revoke all devices and sessions.
- WEB cookie shape, login contract, 30-minute idle / 12-hour absolute limits,
  CSRF and Origin validation remain. The WEB UI gains only device management.
- Native networking remains pinned to the existing HTTPS origin, rejects
  redirects, and retains the existing read/contact-write route allowlist.
- Traefik BasicAuth remains required, including on renewal endpoints.
- New entry points bypass the cookie guard only for refresh/disconnect, where
  a high-entropy credential is required. JSON, Origin and persistent limiting
  are enforced. No new CORS allowance or public enrollment is added.

## Migration and rollout

The additive migration creates MobileDevice/MobileRefresh and adds a nullable
OwnerSession.deviceId with cascading deletion. Existing WEB session rows remain
valid. Native install upgrades the existing three-file manifest to include
Info.plist and sets NSFaceIDUsageDescription. Signing/project configuration is
not edited. Backup directories are retained, including the pre-upgrade files.

Order:
1. Apply the patch to the exact clean base commit on the Mac.
2. Run the isolated Docker PostgreSQL integration suite below.
3. Build/sync mobile and compile Swift for a simulator WITHOUT installing it.
4. Inspect the current production compose/deployment conventions; take the
   established database backup, build candidate API/WEB images, apply the additive
   migration and deploy using the project's normal controlled release process.
   Do NOT run the test compose against production or migrate from an arbitrary host.
5. Only after the new server endpoints are available, install mobile via Xcode.
6. Test enrollment, cold start, background/foreground, biometric cancel/retry,
   Authenticator switching, 15-minute renewal, WEB revocation and mobile sign out.
   Confirm existing WEB login and contacts still work. Use synthetic test contacts.
7. Commit/publish acceptance evidence. Do not mark this feature accepted earlier.

The dedicated apps/api/test/mobile-auth.compose.yml has an internal network,
no published ports, a disposable tmpfs database named pnet_auth_test and literal
test-only credentials. It does not load production env files or mount data.
Run with a unique Compose project and --env-file /dev/null; remove only that
project afterward. Tests assert the database name/host before mutations.

Rollback: keep the d0fe48d source and known-good production images. After
restoring the old application code, the additive tables/nullable column can
remain; do not drop data as part of an emergency application rollback. Revoke
candidate mobile access before reverting if this feature was used. The native
installer's --restore removes the whole native overlay, not just Face ID;
use retained pre-upgrade backups/source for a connected-v1 rollback.

## Verification evidence in the preparation environment

- API TypeScript build and Prisma client generation passed (Node 24.19.0).
- Five existing crypto tests and five JS transport test groups passed.
- WEB and mobile Vite builds passed; targeted WEB auth TypeScript check passed.
- Native installer: fresh install, v1 upgrade, read-only preflight, idempotence,
  refusal on native file drift and byte-exact original restore passed on fixtures.
- PostgreSQL integration tests are supplied but NOT executed in this environment:
  Docker/PostgreSQL are unavailable. Run them on the Mac with the test compose.
- Swift compilation, actual Keychain/Face ID behavior, UI layout and physical
  acceptance remain pending on the Mac/iPhone. JS tests do not prove these.
- Known bundle-size warning remains; broad optimization is deferred.

## Pre-deployment verification — 2026-10-12

Confirmed from the owner's Mac terminal output:
- Isolated PostgreSQL suite: 27 passed, 0 failed.
- All migrations applied successfully to the isolated test database.
- Mobile transport tests: 5 passed, 0 failed.
- Mobile production web build completed.
- Capacitor iOS sync and native installer guards passed.
- Debug iOS Simulator Swift build completed: FACEID_SWIFT_BUILD_OK.
- Repeated native sync was idempotent.

Production API/WEB deployment and production migration remain pending.
Physical-device Face ID enrollment, unlock and revocation remain pending.
This checkpoint is a deployment candidate, not final feature acceptance.

## Historical migration formatting repair — 2026-10-12

Production preflight stopped before executing the Face ID migration.
The stored checksum for 20260925160000_add_contact_event_reminders
differs from Git solely because the applied file has one additional
trailing newline. Restoring that newline reproduces the exact production
SHA256: ddf03b13da556450d26376c0c95f711b18296b2dcfd0274c4222178a172670e4.

SQL statements are unchanged. No production migration-history records
were modified. Rebuild the migration image before retrying preflight.
Production Face ID migration and application rollout remain pending.

## Production and physical iPhone acceptance — 2026-10-15

Owner-confirmed acceptance:
- WEB opens and contacts remain accessible.
- Initial iPhone enrollment with full credentials and Authenticator succeeds.
- Face ID unlock works after backgrounding and standalone launch without cable.
- WEB device revocation prevents continued access with Face ID alone.
- Full authentication after revocation re-enrolls the iPhone.
- Subsequent Face ID unlock works again.

Previously confirmed deployment evidence:
- PostgreSQL authentication tests: 27 passed.
- Mobile transport tests: 5 passed.
- iOS Simulator Swift build succeeded.
- Production migration completed with matching historical checksums.
- API and WEB rollout succeeded; API, WEB and DB reported healthy.
- Deployment preserved the DB container and private mounts.

Application images were built from db057933bbb4b87002666a6027b491b2fb2c4d26.
Migration image was built from 53a1f8d03222e110989bc7045ea3c193aa1a2225.
The latter changes only historical migration formatting and documentation.

The tested Face ID flow is accepted. This does not declare the entire
mobile application complete or verify every documented failure scenario.
Production Git checkout alignment remains pending.
