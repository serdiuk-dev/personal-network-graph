# Personal Network Graph — iPhone

Current status (2026-10-18): core connected features and scoped physical-device
scenarios accepted by owner. Release Candidate and merge/release are not complete.
Published implementation: feature/iphone-app at
b5bdba35e129fc77e3ff304cecd41eec8a223f93.

## Supported functions

Contacts (create/edit/delete), connections, categories/interests and assignments,
events/reminders, contact channels, private photos/icons, global graph settings,
individual relationship styles, network overview and search/filters.
JPG/PNG/WebP up to 5 MiB; HEIC is unsupported. No iOS push/local notifications.
Message sending routes remain blocked. Social adapters remain deferred.
Graph appearance preferences use ephemeral WebView storage and may reset on
restart; server-backed global graph styles and relationship styles persist.

## Authentication and privacy

Initial enrollment: gateway BasicAuth, owner password and TOTP/recovery code,
then Face ID. Subsequent unlock uses device-only Keychain with
WhenPasscodeSetThisDeviceOnly and biometryCurrentSet. Owner password/TOTP are
not persisted. Access sessions last 15 minutes; device trust lasts 30 days,
with a 7-day inactivity limit and rotating refresh credentials.
WEB can revoke a device. See ../../docs/roadmap/mobile-faceid.md.

PNETNative.swift owns the fixed HTTPS origin, exact route/method allowlist,
credentials and Origin/CSRF headers. Redirects are rejected; default Apple TLS
validation is retained. JS does not receive stored authentication tokens.
URLSession and WKWebView storage are ephemeral. There is no offline contact/photo
database or mutation retry queue. Backgrounding locks access and cancels requests;
unsaved forms may be discarded. Cancellation cannot undo an already committed
server write. Reconnect and inspect server state before retrying an uncertain write.
A lost successful refresh response may require full re-enrollment; no grace window.

## Development and installation

Use nvm use from the repository root (.nvmrc: 24.21.0). Do not change global Node
or adjacent projects. Mobile dependency installation is scoped to apps/mobile.
For code changes: targeted checks, npm run build, npm run ios:sync, installer
--check, then compile/install via Xcode on the intended device.

Generated ios/ stays outside Git. The native installer manages its overlay,
SceneDelegate/controller setup and Face ID usage description with drift guards
and backups under ios/pnet-native-backups/. Do not edit generated native files
manually. --restore restores the original native setup, not the previous mobile
feature checkpoint; keep backups and use known-good source for feature rollback.

Personal Team signing and trust recovery:
[PNET iPhone signing guide](../../docs/roadmap/mobile-signing-guide.md).
No App Store distribution has been requested.

## Validation and deployment

[VALIDATION.md](VALIDATION.md) records dated evidence; historical sections are not
current feature restrictions. [Release preparation](../../docs/roadmap/mobile-release-candidate.md)
tracks open gates and limitations. Do not repeat completed acceptance by default.
Face ID API deployment/migration already occurred; later mobile-only changes do
not require deployment. Preserve backups, rollback images and the historical
Prisma migration checksum repair. Cleanup is last.
