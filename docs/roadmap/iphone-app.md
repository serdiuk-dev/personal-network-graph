# iPhone roadmap — current status

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

## Historical planning and checkpoints

# iPhone application — planning checkpoint

Status: connected iPhone contact read/create/edit accepted; mobile phase remains in progress.
Base: published WEB v0.44.0, commit 0c9555ead886a9af7aec86e9a70e4a24ef7e683b.

## Scope

- Owner-only application for iPhone 13 Pro through iPhone 18 Pro.
- Minimum target: iOS 26; later versions require compatibility verification.
- Preserve the accepted WEB design, themes and information architecture.
- Reuse React and Sigma where practical.
- React + Capacitor is the prototype candidate, not a validated final architecture.
- No App Store publication is currently requested.

## Development isolation

- Work on feature/iphone-app on the owner's Mac.
- Node 24.21.0 is selected explicitly through nvm.
- Preserve the default Node and the separate 19games project.
- No global npm installs, shared node_modules or changes to shell startup files.
- Mobile dependencies and generated native project belong in apps/mobile.
- Pin dependency versions and commit the mobile lockfile.
- Production WEB/API images and deployment remain unchanged.

## Authentication findings

- WEB uses relative /api/v1 URLs and same-origin credentials.
- apiFetch rejects URLs outside the current WEB origin.
- API requires the configured HTTPS Origin for login and mutations.
- Mutations also require the session-bound CSRF token.
- API bootstrap does not currently enable CORS.
- External access additionally uses Traefik BasicAuth.
- A bundled mobile WEB cannot connect correctly by changing the API URL alone.
- Design and validate mobile transport, BasicAuth, session cookies, CSRF,
  media access and logout before enabling production access.
- Preserve existing WEB protections; no wildcard origins or embedded credentials.

## Ordered implementation

1. Create an isolated Capacitor prototype using synthetic data only.
2. Verify the existing Sigma graph on iPhone: tap, pan, pinch and selection.
3. Adapt safe areas, keyboard interaction, touch targets and accessibility.
4. Select the final transport/authentication architecture from prototype evidence.
5. Implement login, session expiry, logout and private media handling.
6. Integrate contacts, connections, categories, events and reminders.
7. Verify the new mobile behaviour and obtain owner acceptance.

## Privacy and distribution

- Production contacts, photos, server secrets and backups remain on the VDS.
- No persistent offline contact/photo cache or cloud synchronization.
- No production credentials or private data in code, fixtures, logs or builds.
- Define device credential/session storage separately before implementation.
- Signing credentials and provisioning files remain outside Git.
- Start with local Xcode development; explain signing expiry and renewal
  before choosing the everyday personal installation method.

## Deferred work

Full System Test / Release Candidate, final documentation and targeted
optimization/cleanup follow the mobile phase. Additional social adapters remain
deferred. Preserve backups and rollback images.

## Updated device scope — 2026-10-08

This scope supersedes the earlier single-device target.
- One adaptive application for iPhone 13 Pro through iPhone 18 Pro.
- Minimum iOS version remains 26.0.
- Preserve the approved visual design.
- Adapt to viewport dimensions and safe areas, not model names.
- Check portrait/landscape, keyboard, panel scrolling and touch gestures.
- Screenshots confirm prototype rendering on iPhone 18 Pro / iOS 27 simulator
  in light/dark themes, including the contact overview panel.
- iPhone 13 Pro / iOS 27 simulator: rendering, scrolling, keyboard input,
  panel close/reopen and graph pan accepted.
- Physical iPhone 13 Pro / iOS 26.6 (23G71): prototype installed and opened
  successfully; graph, Contacts, editing and live preview accepted.
- Save remains intentionally disabled in the offline prototype; no server write occurs.
- Two-finger pinch, landscape, accessibility/large text/VoiceOver and the full
  device range remain unverified.
- Next: secure mobile transport/auth/session, then server-backed read/write.

## Connected transport implementation — 2026-10-11

Offline checkpoint published on feature/iphone-app:
`1fb5aa272509f050f8442809c0bc0445c64af01f`.

A native HTTPS/Keychain transport implementation is prepared using the existing
BasicAuth + owner password/TOTP + cookie/CSRF flow. WEB/API sources and production
are unchanged. Reads and contact create/edit are implemented but not device-
accepted. Other mutations are deliberately gated until targeted acceptance.
Next: Mac native compilation, then physical login/session/read/contact-save checks.
See apps/mobile/README.md and VALIDATION.md for boundaries and remaining work.


## Connected checkpoint acceptance — 2026-10-12

Owner accepted standalone iPhone operation and bidirectional contact
create/edit synchronization with WEB. See apps/mobile/VALIDATION.md.
Earlier offline-only and pending contact acceptance statements are historical.

Next: implement trusted-device mobile authentication:
- Initial enrollment through existing full authentication.
- Face ID-protected mobile credential in device-only Keychain.
- Short-lived access sessions and rotating renewal credentials.
- Server-side revocation, expiry and replay handling.
- Device access revocation from WEB.
- Keep existing WEB password/TOTP, CSRF and origin protections.
- Do not store the owner password or simply extend the WEB session lifetime.
- Face ID and credential renewal are NOT implemented in this checkpoint.

After mobile completion: Full System Test / Release Candidate,
documentation and targeted cleanup. Social adapters remain deferred.


## Face ID implementation candidate — 2026-10-12

Trusted-device enrollment, rotation/revocation, WEB device management and
Face ID Keychain access are prepared, not deployed or device-accepted.
See docs/roadmap/mobile-faceid.md for the staged verification and rollout.
Existing connected-v1 acceptance remains the last working checkpoint.
