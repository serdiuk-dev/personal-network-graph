# iPhone contact photos — 2026-10-15

Base: c2095a06e5831d2659972afecd239c0b4ae2f15a, feature/iphone-app.
Contact channels are owner-accepted. This patch enables the existing photo/icon UI.

## Scope

POST/DELETE people/UUID/photo through the native authenticated transport.
JavaScript accepts exactly one FormData file part: JPG/PNG/WebP, nonempty,
up to 5 MiB. Only bytes and MIME are passed to Swift, never the original filename.
Swift independently checks route, method, base64 size, decoded size and raster
signature against MIME, then constructs a single multipart file with a generated
boundary and fixed filename. The existing server fully decodes/re-encodes images,
limits pixels to 25 million and privately stores them. This does not add HEIC
support, camera permissions, new dependencies or persistent offline caching.
Built-in icons reuse the existing PNG generator. Previews remain local until Save.

Session/Origin/CSRF protections, background lock, redirect rejection and no
automatic write replay remain unchanged. Abort/logout during asynchronous file
encoding prevents dispatch. An already dispatched write can have reached the
server before cancellation; inspect the current photo before manually retrying.
No API/WEB source/schema changes or VDS deployment is required.

## Validation

17 JavaScript transport tests passed; mobile Vite build passed. Tests include
byte preservation, missing/extra parts, size/MIME limits, arbitrary multipart
routes, abort/logout during encoding and expired upload non-replay.
Local Node: 24.19.0; Mac must use pinned 24.21.0.
Swift compilation, multipart upload against the server, system photo picker
lifecycle and physical device acceptance are pending; JS mocks do not verify them.

## Physical acceptance

Use a test contact. Upload a small non-sensitive JPG or PNG via the system picker;
verify preview, Save and WEB display. Replace with another image or built-in icon
and verify in WEB. Check Cancel selection and cancel photo removal, then confirm
removal and verify in WEB. HEIC is unsupported; export to JPG first. Verify return
from the picker retains a usable screen; report any reset/Face ID loop.
Do not declare all mobile functionality complete based on photo acceptance.

## Physical iPhone acceptance — 2026-10-15

Owner confirmed the requested iPhone flow: image selection and preview,
upload with WEB verification, replacement with a built-in icon,
removal cancellation and confirmed removal. No picker reset was reported.

Mac Node 24.21.0: all 17 transport tests passed; mobile build, iOS sync,
native installation guards and Debug iOS Simulator Swift build passed.
Owner confirmed operation on the physical iPhone.
This supersedes the pending compilation and physical acceptance above.

No production deployment or database migration was required.
HEIC remains unsupported. This acceptance does not cover every file format,
size boundary or interrupted-upload scenario on a physical device.
Remaining mobile limitations must be reviewed before release acceptance.
