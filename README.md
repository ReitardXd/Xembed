# Discord Auto-Embedder

A Firefox extension that automatically rewrites pasted Twitter/X links on Discord Web so they embed properly.

- Intercepts paste events and replaces `twitter.com` / `x.com` URLs with an alternative embed domain of your choice.
- **GIF-safe mode** — checks each link against Twitter's syndication API; animated GIF tweets are routed through a GIF-capable domain for autoplay in Discord.
- Supports `vxtwitter`, `fxtwitter`, `fixupx`, `girlcockx`, `hitlerx`.

## Build

```bash
npm install
npx tsc
```

The extension loads `dist/content.js` and `dist/popup.js` at runtime (compiled from `src/`).

## Usage

> **Note:** The Firefox add-on is currently under AMO review. The instructions below are for loading from source.

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`
3. The popup lets you toggle the extension, pick your embed domain, and enable GIF-safe mode

### Brave / Chrome / Chromium
1. Run `npm install && npx tsc` to make sure `dist/` is built
2. Open `brave://extensions` (or `chrome://extensions` on Chrome)
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the project root folder (`~/Projects/mp/Xembed`) — it will read `manifest.json` directly
6. The popup lets you toggle the extension, pick your embed domain, and enable GIF-safe mode

## License

Licensed under the [GNU General Public License v3.0](LICENSE).


