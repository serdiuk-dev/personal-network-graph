# Owner-only access requirements

Date: 2026-09-28
Baseline: v0.40.0 / cd2bc1404cc3e7e607ea3a5cdefb301e8b32f7fe
Status: implemented and production-validated in v0.41.0 on 2026-09-29.

## Product requirements
- This installation is private and accessible only to its owner.
- No guest access or public account registration.
- Each self-hosted installation creates its own owner securely.
- No shared/default credentials, hardcoded owner identity or public setup race.
- Document a server-controlled first-owner bootstrap and disable it afterward.
- Provide login/password authentication with an additional factor.
- Evaluate TOTP and passkeys; choose the implementation after the audit.
- Use modern password hashing; never store plaintext passwords.
- Protect all personal-data API routes, not just the WEB interface.
- Explicitly inventory any public exceptions such as login and minimal health.
- Use HTTPS and secure session cookies, session expiry, logout and revocation.
- Protect against CSRF, login brute force and account enumeration.
- Define safe recovery, factor replacement and lost-device procedures.
- Never log passwords, tokens, session cookies or recovery codes.
- Provide reproducible setup, configuration examples and operator documentation
  in the GitHub repository, with no installation secrets committed.
- Test unauthenticated access, registration closure, session lifecycle,
  authorization failures and recovery before release.

## Existing deployment
External HTTPS currently uses Traefik Basic Auth.
Keep that protection during development and migration.
Any eventual change requires a tested replacement and rollback procedure.
A 401 at the root alone does not prove all API routes are protected.

## OpenGym reference
OpenGym demonstrates closed access, disabled guests and closed registration.
Its ALLOW_GUEST / INVITE_ONLY flags are application-specific.
Do not copy those flags as a substitute for implementing authorization.
Do not change or restart OpenGym, shared Traefik or n8n for this audit.

## Scope and safety
Begin with read-only source/configuration inspection and a small number of
unauthenticated GET requests. Do not brute-force, fuzz or mutate production data.
Do not print .env contents, credential hashes, tokens or raw Docker configuration.
Prisma remains 6.19.3; Docker Node 24 remains authoritative.
Reminder features are complete. Social adapters and final cleanup stay deferred.
