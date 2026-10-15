# iPhone categories and interests — 2026-10-15

Base: 8ad360a61cc7fc340ae433effd1a4efbdb881ead, feature/iphone-app.
Relationships are owner-accepted. This patch enables the existing taxonomy UI.

## Scope

Create, rename and delete categories/interests using the existing confirmation.
Assign and remove categories/interests from contacts. Exact UUID assignment
routes accept bodyless POST/DELETE; other POST/PATCH still require JSON objects
in native code. Both JavaScript and Swift enforce mutation route boundaries.
Native session credentials, Origin and CSRF protections remain in effect.
No automatic replay of writes. No API/WEB/schema changes or VDS deployment.
Contact deletion, media upload, event and messaging writes remain disabled.
Deleting a taxonomy item removes it from the shared dictionary, not just one
contact; use unassignment to remove only the contact association.

## Validation

9 transport tests passed, including category/interest operations, bodyless
assignment, forbidden routes, malformed IDs, bulk deletion and session expiry.
Mobile build passed. Local Node: 24.19.0; Mac uses pinned Node 24.21.0.
Swift compilation and physical iPhone acceptance remain pending.

## Physical acceptance

Create a temporary category and interest, assign both to a test contact and
verify in WEB. Rename both and verify the new names in WEB. Unassign both and
verify the contact associations disappear. Cancel a dictionary deletion once,
then delete the temporary items and verify in WEB. Do not delete real items.
After acceptance, commit the mobile sources, tests and this document on Mac.
Next mobile scope: events and reminders.

## Physical iPhone acceptance — 2026-10-15

Owner confirmed the requested iPhone checks: category and interest creation,
renaming, assignment to a test contact, unassignment, deletion cancellation
and deletion, with WEB verification.

Mac Node 24.21.0: all 9 transport tests passed; mobile build, iOS sync
and native installation guards passed. Owner confirmed operation on iPhone.
This supersedes the pending physical acceptance above.

No production deployment or database migration was required.
Next mobile scope: events and reminders.
