# iPhone validation evidence

## Current acceptance — 2026-10-18

This section supersedes historical pending/offline-only statements below.
Published source checkpoint: b5bdba35e129fc77e3ff304cecd41eec8a223f93.
Core feature acceptance is recorded in mobile-faceid, mobile-relationships,
mobile-taxonomy, mobile-events-reminders, mobile-contact-channels, mobile-photos
and mobile-contact-delete-graph-styles documents under docs/roadmap.

Owner additionally confirmed on the physical iPhone:
- Individual relationship color/width saved, reopened and checked in WEB.
- Two-finger zoom on empty graph space and starting over a contact.
- Landscape/safe-area scenario, keyboard access to lower Notes/Save controls.
- Network overview and search/filter scenario.
- Increased-text scenario and basic VoiceOver navigation/labels.
- Offline test-contact save reported failure; no automatic send after reconnect.
- Face ID cancellation kept protected content hidden; retry worked.
- Following signing/trust recovery, app launch worked again on 2026-10-18.
- On 2026-10-18 owner confirmed the 16-minute closed-app return scenario and
  the photo-upload/background scenario as working. These are UI-level reports:
  no token-rotation trace or proof of interruption during an in-flight upload.

Confirmed device context: iPhone 13 Pro / iOS 26.6 (23G71). These checks do not
establish full accessibility compliance or coverage of all targeted devices.
Personal Team confirmed; Xcode showed a profile created 2026-10-18 with
"Expires in 6 days". Exact installed-profile expiry was not extracted.
An observed untrusted-developer launch error was resolved; the original
"No Longer Available" error was not independently attributed to profile expiry.

Release is NOT yet accepted. See docs/roadmap/mobile-release-candidate.md
(from repository root) for remaining gates and explicit limitations.

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


## Face ID candidate — 2026-10-12 (not yet accepted)

See docs/roadmap/mobile-faceid.md for the implementation, verification evidence,
remaining PostgreSQL/Swift/device checks and staged rollout order. The earlier
connected-v1 acceptance does not imply Face ID acceptance.
