# iPhone connected preview — first transport checkpoint

The accepted WEB v0.44.0 React UI is reused without changing WEB/API sources.
The offline acceptance is preserved at commit 1fb5aa272509f050f8442809c0bc0445c64af01f.
This implementation has NOT yet passed Xcode compilation or physical-device
server acceptance. Do not call it a completed mobile release.

## Enabled scope

- Gateway BasicAuth plus existing owner password and TOTP/recovery-code login.
- Existing cookie session, 30-minute idle / 12-hour maximum server lifetime.
- Session recovery, read-only graph/contact/photo/related data, owner logout.
- Create and edit contacts. Other mutations fail locally with an explicit error.
- Contact deletion, photo upload/deletion, relationships/taxonomy/reminder changes
  and outbound messages remain pending later checkpoints.

## Security boundary

`native/PNETNative.swift` owns a fixed HTTPS destination, an endpoint/method
allowlist, gateway Authorization, cookie and exact Origin/CSRF headers. It never
accepts caller-controlled URLs or auth headers and rejects every redirect.
Default Apple TLS validation remains in force; no ATS exceptions or trust bypass.
The current server auth guard, BasicAuth, CSRF, origin rules and TLS are unchanged.
No CORS exception or alternate unauthenticated server route is introduced.

Gateway credentials and the opaque session cookie are stored in one exact
Keychain item using WhenUnlockedThisDeviceOnly with synchronization disabled.
Owner password and TOTP/recovery code are never persisted by the app. JavaScript
receives neither cookie nor gateway credentials on session restoration. Login
fields travel once over the local bridge; bridge logging and WebView inspection
are disabled. Do not enable logging or inspector with real credentials/data.

URLSession uses ephemeral configuration with no cookie store, credential store
or URL cache. WKWebView uses a nonpersistent data store. Contacts/photos live in
memory; there is no offline database, retry queue or disk export. Appearance
preferences may reset when the app restarts because WebView storage is ephemeral.
The native privacy cover hides the app-switcher snapshot. On visibility return,
the UI verifies the session before remounting protected content. Backgrounding
can discard unsaved form drafts. App reads do update the server idle-session time.

Logout success revokes the server session and removes the Keychain item. A gateway
401 during logout is reported as failure because backend revocation is unknown.
A network error during a write is ambiguous: reload/check the server before
retrying; the client does not automatically retry mutations.

## Native installation

`ios/` remains ignored. Do not run `ios:add` again or regenerate signing.
`python3 scripts/install-native.py --check` validates the existing Xcode layout.
The installer appends a managed block to the existing compiled AppDelegate.swift
and selects PNETViewController in Main.storyboard. It leaves SceneDelegate,
project.pbxproj, provisioning and signing settings untouched. Original native
files are backed up under ignored `ios/pnet-native-backups/`; hash-guarded restore:
`python3 scripts/install-native.py --restore`. Keep all those local backups.

`npm run ios:sync` now reapplies the native installer after Capacitor sync and the
existing deployment-target script. New native source must stay in `native/`, not
only in generated `ios/`. Source edits must be installed again before Xcode build.

## Verification sequence

1. Use the existing isolated Node 24.21.0 environment in apps/mobile.
2. Run `npm run test:transport`, `npm run build`, native installer `--check`.
3. Run `npm run ios:sync` and compile the iOS simulator target without signing.
4. Then run on the existing physical device. Enter gateway and owner credentials
   only in the app, never in shell commands/chat/files. Use a fresh TOTP code;
   recovery codes invalidate existing sessions and are for actual recovery.
5. Validate reads, create one clearly synthetic contact, edit it, and verify in
   WEB that changes persisted. Remove the test contact through WEB afterward.
6. Verify restart/session restore, sign out, invalid credentials without repeated
   attempts, idle expiry, connection-loss messaging and background privacy.

No production deploy or rebuild is needed for this implementation. Main, tags,
WEB/API code, backups, rollback images and ~/19games are untouched.


## Face ID candidate (requires new API and database migration)

The earlier no-server-deployment instructions apply only to connected-v1.
This candidate adds Face ID-gated trusted-device enrollment/renewal. Do not
install this candidate on the phone until the API migration and deployment
have completed. See docs/roadmap/mobile-faceid.md for prerequisites, tests,
limits, revocation, recovery and rollout.
