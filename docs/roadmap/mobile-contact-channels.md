# iPhone contact channels — 2026-10-15

Base: fb1c81da7dc3b123047508e50d3d3019edd19711, feature/iphone-app.
Events/reminders are owner-accepted. This patch enables existing channel forms.

## Scope

Create/edit/delete contact channels including address, handle, preferred status,
priority, active flag, automation permission and notes through the existing UI.
Exact POST people/UUID/contact-channels and PATCH/DELETE contact-channels/UUID
routes are added independently in JavaScript and Swift. Existing JSON validation,
Origin, CSRF, session handling and no automatic write replay remain unchanged.
No API, WEB source, schema or server deployment changes. Message sending remains
blocked on mobile. Server routing settings may affect future server sends.
Contact deletion, photo upload and graph/style writes remain unfinished.

## Validation

13 transport tests passed; mobile Vite build passed. Local Node 24.19.0;
Mac must use pinned 24.21.0. Swift and physical iPhone acceptance remain pending.

## Physical acceptance

Use a test contact and two EMAIL channels test1@example.invalid and
test2@example.invalid, with automationAllowed false. Create both, edit one address
and note, and switch preferred status from one to the other. Verify changes in
WEB and that only one is preferred. Check delete cancellation, then remove both
test channels and verify in WEB. Do not send messages during this CRUD test.
This acceptance does not verify notification or message delivery.

## Physical iPhone acceptance — 2026-10-15

Owner confirmed the requested iPhone checks: creation and editing of test
contact channels, switching the preferred channel, WEB verification,
deletion cancellation and removal of the test channels.

Mac Node 24.21.0: all 13 transport tests passed; mobile build, iOS sync
and native installation guards passed. Owner confirmed operation on iPhone.
This supersedes the pending physical acceptance above.

No production deployment or database migration was required.
Message sending was not enabled or verified by this acceptance.
Next mobile scope: contact photo upload, replacement and removal.
