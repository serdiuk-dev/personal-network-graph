# iPhone graph prototype — synthetic data only

Separate Capacitor package reusing the accepted v0.44.0 WEB source without
changing it. Existing WEB navigation and styles are deliberately retained for
this first device experiment; this is not a finished native interface.

Six fictional contacts are bundled. No account, server URL, production contacts,
photos or credentials are included. The mobile build substitutes the WEB API
client and account panel. Unsupported reads return 404; every mutation throws an
explicit error. Forms can preview drafts but cannot save them. Appearance remains
local to this app. CSP blocks network connections; native HTTP is disabled.

Use the repository's Node 24.21.0 in a subshell. Run npm ci and npm run build
inside apps/mobile. Then npm run ios:add (Swift Package Manager), npm run ios:open.
The generated ios directory is ignored during the prototype; do not commit
signing settings. The add/sync scripts set the deployment target to iOS 26.0.
Production API authentication/transport and everyday personal installation are
separate checkpoints, not implemented here.

First run in an iPhone simulator, then on the owner's iPhone 13 Pro. Check graph
visibility, node taps, one-finger pan, two-finger pinch, portrait/landscape safe
areas, panel scrolling and dismissal, light/dark themes, and keyboard overlap.
Use only fictional inputs. Verify saving shows the explicit disabled message.
Record results before deciding whether this technology meets the mobile scope.

No production deployment, WEB rebuild, backup operation, global npm install or
change to the default nvm alias is required. Dependencies and lockfile belong
only to this package. iOS compilation/signing must be verified on the Mac.
