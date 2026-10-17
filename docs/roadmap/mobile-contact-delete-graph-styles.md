# Mobile contact deletion and global graph settings

Base: `2cc5527e1ebcf33ea67a6d86e90ed1db5f7cc302`.
Status: scoped physical iPhone acceptance confirmed by owner on 2026-10-17.

## Scope and source review

Enable only DELETE `/api/v1/people/:uuid` and PATCH `/api/v1/graph-styles`
in both JS and Swift transport allowlists. No API, schema or migration changes.
Bulk contact deletion, graph-settings POST/PUT/DELETE and message sending remain blocked.
Credentials and CSRF stay native; failed writes are not automatically replayed.

PeopleManager already asks for confirmation, sends a bodyless DELETE, checks
response.ok and reloads contacts/graph. Cancellation sends no request.
PeopleService.remove delegates to PersonMediaService.removePerson. A transaction
locks the person row and deletes the person. The schema cascades incoming/outgoing
relationships, category/interest assignments, channels, events, reminders and
reminder delivery records. Category/interest definitions and other people remain.
Photo unlink happens only after successful DB deletion. A storage failure logs a
warning and may leave an inaccessible file for later cleanup; this is not an atomic
DB/filesystem transaction. Previously sent external notifications cannot be recalled.

GraphStyleManager PATCHes sanitized settings and checks response.ok. The API
validates colors/numeric ranges and upserts singleton GraphStyleSettings id=1.
These settings are shared with WEB, not device-local. Record original values before
acceptance and restore them afterward. Separate relationship styles are outside
this acceptance block.

## Verification

Six focused JS transport tests passed in the preparation environment (Node 24.19.0):
three new contact/settings tests plus three affected existing route-denial tests.
The bridge is mocked: this does not validate Swift, a live API or a physical iPhone.
New coverage: exact methods/paths, bodyless delete, JSON preservation, 204/error
responses, malformed/bulk/nested routes, body restrictions and no replay after
session/network errors. Existing deny cases now use a forbidden nested people path
instead of the newly authorized single-contact deletion.

Mac must use project `.nvmrc` and run focused tests, mobile build, ios:sync and
installer guards, then compile/install via Xcode. No server deployment is needed
for this mobile-only transport change.

## Physical acceptance — planned scenarios

- Create two synthetic contacts. Give the first a photo/icon, a relationship to
  the second, a category/interest assignment, an inactive test channel and an event
  with a far-future reminder (avoid notification delivery).
- Cancel deletion first: contact and dependencies must remain.
- Confirm deletion: contact disappears from People and graph; after WEB refresh,
  the contact, its relationship and upcoming reminder must be absent. The second
  contact and taxonomy definitions must remain. UI checks alone do not prove
  physical file cleanup or every DB cascade.
- Record original global graph settings. Change a color and width, Save; leave and
  reopen settings, reopen the app and refresh WEB. Values must persist. Restore
  original values and Save; verify on both clients.
- If a write loses its response, reconnect and inspect server state before retrying.

Record actual results before marking accepted or committing acceptance wording.
The remaining handoff plan (route inventory, UX/accessibility, session/network
edge cases, signing/updates, consolidated docs, Full System Test/RC) remains open.
Keep backups/rollback. Cleanup stays last; social adapters remain deferred.

## Owner-confirmed acceptance — 2026-10-17

Mac command block completed with DELETE_GRAPH_PATCH_BUILD_SYNC_OK:
focused transport tests, mobile build, ios:sync and installer guards succeeded.
Native installer created a local backup.

Owner explicitly confirmed on the physical iPhone:
- cancellation and confirmation of synthetic contact deletion;
- global graph settings persisted after reopening and were verified in WEB.

This confirms the stated UI scenarios, not every database cascade, physical
photo cleanup, network failure or device combination. Detailed dependency
checks and restoration of original style values were not separately reported.
No API deployment or migration was performed for this checkpoint.

Remaining mobile work and release preparation remain open.
