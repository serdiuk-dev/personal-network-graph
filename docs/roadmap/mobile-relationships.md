# Mobile relationships — 2026-10-15

Base: feature/iphone-app at 7a93b2dba65a07ed09ef68560577d699594fed3c.
Production Git alignment and API/WEB/DB health were confirmed by the owner.
The accepted Face ID flow remains the preceding checkpoint.

## Scope

Enable the existing Relationships UI on iPhone for create, update and delete.
Deletion uses the existing confirmation dialog. Graph refresh uses the existing
onChanged callback. API, WEB sources, database and deployment are unchanged.
Only exact relationship collection POST and UUID item PATCH/DELETE are added.
Contact create/edit remains enabled; contact deletion, photo upload, taxonomy,
event and messaging mutations remain blocked. Native code enforces the route
policy independently of JavaScript. DELETE has no request body; native Origin,
CSRF and session credentials still apply. Writes are never automatically replayed.

## Validation

Local transport tests: 7 passed, including relationship requests, empty deletion
responses, denied mutations and expired-write non-replay. Mobile Vite build passed.
Local Node was 24.19.0; project Mac verification must use pinned 24.21.0.
Native Swift compilation and physical iPhone acceptance remain pending.
No server deployment or database migration is required for this checkpoint.

## Owner acceptance

Use two test contacts. Create a relationship on iPhone, verify it in WEB and graph.
Edit strength and notes on iPhone and verify in WEB. Cancel deletion once and
confirm the relationship remains; then delete the test relationship and verify
its removal in WEB. Leave real contacts and relationships unchanged.
This acceptance does not complete the other mobile functions.

## Physical iPhone acceptance — 2026-10-15

Owner confirmed completion of the requested physical iPhone checks:
relationship creation and editing, WEB synchronization, deletion cancellation,
and confirmed deletion with verification in WEB.

Mac Node 24.21.0: all 7 transport tests passed; mobile build, iOS sync
and native installation guards passed. Owner confirmed operation after Xcode
installation. This supersedes the pending physical acceptance above.

No production deployment or database migration was required.
Categories, interests, events and reminders remain subsequent mobile work.
