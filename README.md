<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/banner-dark.svg">
  <img src="docs/banner-light.svg" alt="JailPortal: manage your Meta Portal from the browser" width="100%">
</picture>

Install apps on a Meta Portal, mirror its screen and poke around its shell, straight from a browser tab. It talks ADB over WebUSB, so there is nothing to install on your computer and no server in the middle.

JailPortal is a fork of [OpenPortal](https://github.com/andronedev/openportal) by andronedev that adds a **home screen with hands-free Alexa** for Portals running Android 10.

**→ [zaka0002.github.io/jailportal](https://zaka0002.github.io/jailportal/)**

## What you can do

- Install apps from a community catalog, or drop any `.apk` on the page
- Launch, stop, clear or uninstall what's already on the device
- Mirror and control the screen (scrcpy)
- Browse files, open a shell, read logcat, edit feature flags *(Advanced mode)*
- **Quick setup on connect**: tick what you want (a home screen that answers "Alexa", Meta's Alexa, a clean-up) and JailPortal does the rest

## Hands-free Alexa

Meta removed Alexa from the Portal. Its original client (falcon) can be reinstalled, but on Android 10 its own "Hey Alexa" detector is deaf: the system only lets the app in front use the microphone.

[Portal Accueil](https://github.com/zaka0002/portal-accueil) gets around it by being the home screen itself, since that is what's on screen almost all the time:

- Clock, weather and your apps, which you can reorder by dragging, rename, re-icon or hide.
- Listens for "Alexa" offline with [Vosk](https://alphacephei.com/vosk/) and a small French model. Nothing leaves the device.
- Only fires on a finished "Alexa" with high confidence, said at the end of what you say, so TV and conversation don't set it off.
- Beeps, brings the Portal's Alexa to the front and tells it to listen (the same handoff [Portal HA Bridge](https://github.com/RoadRunner-1024/portal-ha-bridge) uses), then comes back to the home screen.

The first time a Portal connects, JailPortal opens a **Quick setup** checklist. **Portal Accueil home screen** installs it, grants the microphone, exempts it from battery optimisation and makes it the home screen. **Meta's Alexa** installs the falcon APK from [starbrightlab/hey-dist](https://github.com/starbrightlab/hey-dist), checked against its SHA-256 on the device, with the permissions it needs to connect; sign in with the code it shows at amazon.com/code. **Clean up** clears app caches and removes unused Meta apps (restorable). The checklist can be reopened from the dashboard.

## Getting started

1. On the Portal: **Settings → Debug → ADB Enabled**.
2. Plug it into your computer with a USB‑C **data** cable. The port is on the back, sometimes under a cover.
3. Open [zaka0002.github.io/jailportal](https://zaka0002.github.io/jailportal/) in Chrome, Edge or any Chromium browser, then click **Connect**.

Every Portal model works. Firefox and Safari don't support WebUSB.

> [!WARNING]
> Don't change **Display size** in the Portal's own Settings. It can put the device in a boot loop ([OpenPortal #10](https://github.com/andronedev/openportal/issues/10)). If ADB is still enabled, `adb shell wm density reset` brings it back. Otherwise only a factory reset will.

## Add your app

The catalog is plain JSON in [`catalog/`](catalog/): one folder per app, added by pull request with no code change. See [catalog/README.md](catalog/README.md).

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173, add ?demo to run without a device
pnpm lint && pnpm build
```

React, Vite, TypeScript, Tailwind and [ya-webadb](https://github.com/yume-chan/ya-webadb). The build is a static site. More in [CONTRIBUTING.md](CONTRIBUTING.md).

## Notes

Meta [officially opened ADB](https://developers.meta.com/horizon/blog/build-apps-for-portal-with-ai/) on Portal. JailPortal only uses public ADB commands: no exploit, no root, no bootloader unlock. Screen mirroring ships the [scrcpy](https://github.com/Genymobile/scrcpy) server (v2.3, Apache‑2.0), pushed on demand and never modifying the device. The brand uses Meta's blue palette; JailPortal is not affiliated with Meta or Amazon.

MIT licensed, like OpenPortal. Original work © andronedev and the OpenPortal contributors.
