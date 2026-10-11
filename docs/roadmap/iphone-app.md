# iPhone application — planning checkpoint

Status: offline technical prototype accepted on simulators and physical iPhone; production server integration is not implemented.
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
