# Offline prototype acceptance — historical checkpoint

- Bundled mobile frontend build passed.
- Mac validation used Node 24.21.0 / npm 11.19.0; Capacitor 8.5.3.
- Synthetic API check passed: six contacts; missing photo returns 404; writes
  and external URLs are rejected without calling fetch.
- Capacitor generated its Swift Package Manager project and the deployment
  target script passed for iOS 26.0.
- Production authentication/client code is excluded from the prototype.
- Native HTTP is disabled and CSP has `connect-src none`.
- No accepted WEB/API source or production deployment was changed.
- iPhone 18 Pro / iOS 27 simulator rendered the accepted UI in light and dark modes.
- iPhone 13 Pro / iOS 27 simulator passed scrolling, keyboard input, panel
  close/reopen, contact selection and graph pan checks.
- Physical iPhone 13 Pro / iOS 26.6 (23G71) successfully installed and opened
  the prototype through Xcode development signing.
- On the physical iPhone, graph, Contacts, editing and live preview were accepted.
- Save intentionally reports `Saving is disabled in this offline prototype.`
  No production server write occurs.
- Developer Mode and trust for the owner's development certificate were configured
  successfully; they do not need to be repeated for this checkpoint.
- Two-finger pinch, landscape/safe areas, accessibility/large text/VoiceOver,
  full keyboard coverage on the physical phone and the complete device range
  remain unverified.
- Build reports the known >500 kB bundle warning. Optimization remains deferred.

## Connected transport implementation — 2026-10-11 (not yet device-accepted)

- Native transport, Keychain session, login/logout and contact create/edit prepared.
- Five JS transport test groups passed locally with Node 24.19.0 using a mocked
  native bridge: JSON/binary reads; URL/header/method/body restrictions; session
  coalescing/expiry; request cancellation; logout/stale-response handling.
- Native installer tested on synthetic copies for preflight, installation,
  idempotence, update, byte-exact original rollback and refusal on local drift.
- No server calls, real credentials, real contacts or photo fixtures used locally.
- Xcode Swift compilation, Mac mobile build and physical server login/read/write
  have NOT yet been verified. Native Keychain/TLS/redirect behavior requires Mac
  and device verification; JS mocks do not establish those native guarantees.
- Remaining device/accessibility/gesture acceptance from the offline checkpoint
  is still open; no old WEB deployment or old mobile acceptance was repeated.


## Connected checkpoint acceptance — 2026-10-12

This section supersedes earlier pending compilation and contact acceptance.
- Mac: five transport tests passed; mobile frontend build passed.
- Native transport installation and unsigned iOS Simulator Swift build passed.
- Installer supports direct SceneDelegate controller creation with backup/restore.
- iOS target script accepts Capacitor's .v26 platform representation.
- Login form remains mounted when switching to Authenticator.
- Owner confirmed physical iPhone login and server data loading.
- Owner confirmed standalone operation after disconnecting the Mac.
- Owner confirmed contact creation/editing and both synchronization directions:
  iPhone changes visible in WEB; WEB changes visible after mobile reopening.
- No claim of real-time push synchronization or full mobile acceptance.
- Logout, expiry, native security edge cases, accessibility and remaining
  gestures/device coverage still require targeted verification.
- Other mobile mutations remain gated. WEB/API deployment was not changed.
- Known bundle-size warning remains deferred.
