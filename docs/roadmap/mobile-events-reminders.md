# iPhone events and reminders — 2026-10-15

Base: 1d0542488c9a5cedd51f7a4d75128570a0902dc5, feature/iphone-app.
Taxonomy is owner-accepted. This patch enables the existing events/reminders UI.

## Scope

Create a contact event with its reminder; edit and delete events and reminders.
Upcoming/history reads were already enabled. Existing forms, confirmation dialogs,
and server validation are reused. Exact UUID routes are enforced independently
in JavaScript and Swift. POST/PATCH require JSON in native code; DELETE is bodyless.
Origin, CSRF, session expiry and no automatic write replay remain unchanged.
API, WEB source, schema and server deployment are unchanged.
Contact deletion, photo upload, contact-channel and messaging writes remain gated.

The existing server scheduler checks due reminders every minute and uses configured
Telegram/Email notification destinations. This patch does not implement iOS push
or local notifications and does not verify provider delivery.

## Validation

11 transport tests passed; mobile Vite build passed. Local Node: 24.19.0;
Mac verification uses pinned 24.21.0. Swift/device acceptance remains pending.

## Physical acceptance

Use a test contact and reminder due one week in the future. Create an event and
verify it and its reminder in WEB and Upcoming. Edit the event title/note and
reminder due time on iPhone; verify in WEB. Check deletion cancellation. Delete
the test reminder, then its test event, and verify both removals in WEB before
the due date. Do not use past/near-term dates for this CRUD test.
Provider delivery, device notification permissions and background delivery are
not part of this acceptance. Other mobile features remain unfinished.

## Physical iPhone acceptance — 2026-10-15

Owner confirmed the requested iPhone checks: event creation with a future
reminder, event title/note and reminder time editing, WEB/Upcoming verification,
deletion cancellation and removal of the test reminder and event.

Mac Node 24.21.0: all 11 transport tests passed; mobile build, iOS sync
and native installation guards passed. Owner confirmed operation on iPhone.
This supersedes the pending physical acceptance above.

No production deployment or database migration was required.
Telegram/Email delivery and iOS push notifications were not verified by this
acceptance. Other mobile features remain unfinished.
