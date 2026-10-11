# Prototype validation

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
