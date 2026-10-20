# Privacy Spotlight

Blurs the whole page and keeps only a soft spotlight circle around the cursor sharp, fading gradually into the blur, so shoulder-surfers cannot read your screen. Freemium: Free + Pro subscription via ExtensionPay.

## Install (Load unpacked)

1. Download or clone this folder.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and choose this folder.
5. Pin the extension from the puzzle-piece menu.

Use the extension on any http(s) page via the popup.

## Free vs Pro

| Feature | Free | Pro |
|---|---|---|
| Blur + cursor spotlight (fixed defaults: radius 80px, blur 20px, fade 140px) | Yes | Yes |
| On/off switch in popup, current tab only | Yes | Yes |
| Spotlight size slider (40-400px) | Locked | Yes |
| Blur strength slider (2-40px) | Locked | Yes |
| Fade softness slider (0-300px) | Locked | Yes |
| Dim outside area (0-80%) | Locked | Yes |
| Keyboard shortcut Alt+Shift+B | Locked (opens upgrade page) | Yes |
| Blur all tabs (always-on, new tabs open blurred) | Locked | Yes |

## Set up payments (ExtensionPay)

1. Create a free account at extensionpay.com.
2. Register an extension ID there (e.g. `privacy-spotlight`) and change `EXTPAY_ID` in `config.js` to that exact ID. It is a placeholder in this repo and lives only in `config.js`.
3. Connect a Stripe account in the ExtensionPay dashboard. Note: Stripe onboarding in India is currently restricted. If refused, the planned fallback is a license-key provider such as Gumroad, which would change only the license check in `background.js`.
4. Create Monthly and Yearly plans.
5. Use ExtensionPay's test mode with the Stripe test card `4242 4242 4242 4242` to try the Pro path.

ExtensionPay charges no monthly fee, only a percentage of each sale plus Stripe fees.

## Keyboard shortcut

Alt+Shift+B toggles blur (Pro). Free users: the shortcut opens the upgrade page. It can be rebound at `chrome://extensions/shortcuts`.

## Manual test checklist

1. Load unpacked; no errors appear.
2. Free path: switch on from the popup. The current tab blurs with a fixed fading spotlight that follows the cursor. Other tabs are unaffected. Sliders are locked. Alt+Shift+B opens the upgrade page.
3. Click links and type through the blur; interactions still work.
4. Pro path: subscribe in ExtensionPay test mode. The popup flips to Pro. Sliders apply live. Dim works. "All tabs" blurs every tab, including new ones. The shortcut toggles blur.
5. Cancel the test subscription, then wait for license refresh (up to 12 hours) or reload the extension. Pro locks again.
6. Move the cursor over an iframe (e.g. a YouTube embed): the spotlight follows. Move the cursor out of the window: the whole page blurs.

## Limitations

- No blur on `chrome://` pages, `chrome-extension://` pages, the Chrome Web Store, `file://` pages, the built-in PDF viewer, or native fullscreen video.
- A brief unblurred flash can appear while a page loads, before the extension knows the blur is on.
- Pro gating is client-side (standard for extensions); a determined user could patch it.
- Tabs opened before install get the script injected at install.
- Sandboxed iframes without scripting cannot relay the cursor.
- Alt+Shift+B may clash with shortcuts on some systems.

## Files

- `manifest.json`, `config.js`, `background.js`, `content.js`, `popup.html`, `popup.css`, `popup.js`
- `ExtPay.js` (unmodified, from the extpay npm package v3.1.2; LGPL-3.0, see `ExtPay.LICENSE`)
- `icons/`, `make_icons.py` (regenerates icons with Pillow)
