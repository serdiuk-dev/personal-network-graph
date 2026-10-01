# Contact Photo / Icon

## Initials fallback accepted — 2026-10-01

Current checkpoint; supersedes earlier statements that initials are missing.

- Contacts without a loaded photo display initials derived from their names.
- Saved photos take priority; initials are omitted on very small nodes.
- Existing node colors, depth ordering and selection fading are retained.
- Docker WEB build, TypeScript and all 16 graph tests passed.
- Production availability checks passed with zero container restarts.
- User accepted the result on desktop and mobile.
- API, database, private media storage and authorization are unchanged.

Current production images:
API: sha256:f5d91562689bf2d22685326d2c36021797c3fe84f7c49703010a1ccf4e3835ec
WEB: sha256:ed79c21d44169facc60721216008009213671dc47d0bdfa8884380c6d30f0d6a

Remaining interface scope: built-in icon catalogue.
v0.42.0 remains open and untagged.

## Graph photo editor accepted — 2026-10-01

Current checkpoint; supersedes earlier statements that graph editor entry is missing.

- Contact overview now includes Photo / Icon on desktop and mobile.
- The button opens the existing private media editor in a modal dialog.
- Saving and closing the editor refreshes the graph image.
- Close returns keyboard focus to the graph.
- Docker WEB build, TypeScript and post-deployment availability checks passed.
- User confirmed the complete workflow works on both devices.
- API, database schema, private storage and owner authorization are unchanged.

Current production images:
API: sha256:f5d91562689bf2d22685326d2c36021797c3fe84f7c49703010a1ccf4e3835ec
WEB: sha256:ff080cf720d6b0a517352b7cfb4585ee28cd0935033d1a953b42ca6c74f72c61

Remaining interface scope: built-in icon catalogue and initials fallback.
v0.42.0 remains open and untagged.

## Accepted mobile correction — 2026-10-01

Current checkpoint; supersedes earlier pending checks where stated below.

- Mobile contact overview opens as a bottom panel at widths up to 900px.
- Details scroll independently; the English Close button remains visible.
- Desktop retains the right-hand contact overview.
- Docker WEB build and TypeScript validation passed.
- User accepted the mobile correction after deployment.
- Paired database/media backup checksums and isolated restore passed.
- Restored photo hashes, permissions and contact linkage passed (one photo).
- API container recreation retained the same image, media mounts, photo hashes
  and permissions; WEB/DB container fingerprints were unchanged.
- User confirmed the photo remained available after recreation.
- Backup/restore evidence: /opt/pnet-backups/v042-db-media-20261001T044149692401Z.
- This verifies a local backup and restore; scheduled/off-server backup is not
  claimed to be configured.

Current production images:
API: sha256:f5d91562689bf2d22685326d2c36021797c3fe84f7c49703010a1ccf4e3835ec
WEB: sha256:9a7894a6e3620f2e05ca643e29a836818c4a0ec1f8170d33484d909479d725fe

Release remains untagged. Built-in icons, initials fallback and direct photo-editor
entry from graph details remain unresolved scope items, not completed features.

## Current checkpoint — 2026-09-30

Status: deployed and user-accepted in People and on the graph; v0.42.0 remains open.

The delivered workflow supports local JPG/PNG/WebP selection, preview, save,
replacement and removal. Graph nodes now show the saved photo or uploaded icon,
with circular clipping and the existing color ring. Without an image, the ordinary
node remains. There is no built-in icon catalogue.

The file-selection button and empty-selection text are application-controlled
English. Native OS picker dialogs follow the user's system language.
All future application labels must follow ../ui-language.md.

Production storage:
- Docker volume pnet_contact_media, API mount /app/private-media.
- Non-root API; directory mode 0700, files mode 0600.
- Existing owner guard, Origin/CSRF protections and auth overlay retained.
- No public static media route, schema migration or database change.

Validation recorded:
- Docker API and WEB builds completed; API runtime imports and WebP encoding passed.
- Seven media HTTP tests passed; isolated database/auth tests were reported passed.
- Four graph-photo tests plus ten geometry/return tests passed in Docker.
- Private storage access/permissions and anonymous photo 401 were checked.
- User accepted uploaded imagery on the graph and the English interface.

Deployment correction:
The first media API image failed because package.json was unreadable by node.
Both package-manifest COPY commands now use --chmod=0644, and a build-time check
loads package.json, app.module.js and sharp as USER node. The corrected image is
the current production API; the failed image must not be redeployed.

Remaining operational checks:
- Verify persistent imagery across API container recreation.
- Verify a paired DB/media backup and isolated restore.
- Record phone-specific acceptance separately from desktop acceptance.
Existing backup guidance below remains applicable, but does not prove that the
backup schedule or restore procedure has already been implemented and tested.

## Historical planning and validation notes

Retained for traceability; current status is documented above.

Status: prepared for manual server validation. This does not close v0.42.0.
Baseline: stable v0.41.0, commit 32c2b3c7a0da268ec759068a2d21dc185d4f56bd,
branch feature/dynamic-network-graph with eight existing uncommitted changes.

## User workflow

People → Photo / Icon beside the contact → choose a local JPG, PNG or WebP →
preview → Save photo / icon. A new selection replaces the image only after Save.
Cancel selection preserves the saved image. Remove photo / icon asks for confirmation.
No external URL is fetched. Images can be selected from desktop or mobile file pickers.
HEIC must first be exported as JPG. This step adds the contact editor, not graph-node avatars.

## Storage and security

- GET, POST and DELETE /api/v1/people/:id/photo use the existing global owner guard.
- POST and DELETE retain exact Origin and X-Pnet-CSRF validation. No public route.
- Multipart accepts one file, no text fields, max 5 MiB. Nginx request cap: 6 MiB.
- Real JPEG/PNG/WebP signatures and sharp decoding, max 25 million pixels.
- Output: oriented WebP, max 512×512 bounding box, full aspect ratio, alpha preserved.
  EXIF/GPS metadata is not retained. Animated WebP is rejected.
- sharp is pinned to 0.35.5 with lockfile. Node 24, Prisma 6.19.3 and auth code unchanged.
- One file per contact UUID: /app/private-media/<uuid>.webp. Client filename ignored.
- API-only named volume contact_media; no nginx mount or static-file middleware.
  Directory created as node:node / 0700 in runtime image, files 0600.
- Full temporary write + fsync + same-directory rename prevents partial replacements.
- PostgreSQL Person row locks serialize photo changes and contact deletion.
  A failed DB deletion preserves the photo; successful deletion unlinks it.
- Every retrieval verifies the contact exists and returns no-store / nosniff.
  Browser blob URLs are revoked on replacement, panel close and unmount/logout.
- No Prisma model or database migration. Existing contacts remain unchanged.

## Compose and backup

Always use all four layers, in this order:
compose.yaml, compose.override.yaml, compose.auth.yaml, compose.media.yaml.
The media overlay adds only the private volume and PNET_MEDIA_DIR. It does not
replace the auth secret, environment, networks or reverse-proxy configuration.

The media volume must be included in regular backups alongside PostgreSQL.
For a consistent snapshot, stop API writes (or stop only API), back up DB + media,
then resume API. Never use docker compose down -v for deployment or rollback.
Restore paired DB/media backups. Rolling back application images leaves the volume
intact. If the API process is killed mid-upload, a private .tmp file may remain;
if storage unlink fails after contact deletion, an inaccessible orphan may remain.
Do not clean these while uploads run. Include inspection/cleanup in the planned
post-project maintenance stage; no automatic destructive cleanup is introduced.

## Validation

Locally: Node 24.19.0, API TypeScript build, WEB tsc --noEmit, Vite bundle using a
temporary index.html (the supplied archive omitted the production entry HTML),
10 existing graph tests, and person-media.test.cjs passed.
The media HTTP test uses real Nest routes, AuthGuard, multipart, sharp and disk,
but mocked session persistence and Prisma. It is not a production-auth E2E test.

Pending server gates: Alpine Docker builds, real isolated PostgreSQL media test,
existing full application authorization tests, Compose mount/auth verification,
and browser verification (desktop + phone + logout + restart persistence).
Browser automation was not available in the local environment.

Run the DB test only with PNET_AUTH_TEST=isolated and DATABASE_URL pointing to
pnet_auth_test on db or 127.0.0.1. Never use production credentials for tests.
