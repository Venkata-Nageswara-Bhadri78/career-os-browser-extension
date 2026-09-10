# Copilot Job Capture

Chrome **Manifest V3** extension. It is a transport client for Copilot job extraction — not a website, not a login product, and not a job database.

**Unpacked extension ID (stable):** `lghllhgdcekacmdoolnekkkoffcmcaeo`

Set the Spring Boot property to that value (lowercase, no `chrome-extension://` prefix) and restart the API:

```properties
app.extension.id=lghllhgdcekacmdoolnekkkoffcmcaeo
```

CORS for `chrome-extension://lghllhgdcekacmdoolnekkkoffcmcaeo` is not authorization. The backend still requires a JWT whose signed `cid` claim is `browser-extension`.

## Install and load unpacked

Requires **Chrome 116+**. Firefox is not supported.

```bash
npm install
cp .env.example .env   # optional; defaults match local Copilot
npm run dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked**
4. Select `.output/chrome-mv3-dev` (WXT dev) or `.output/chrome-mv3` after `npm run build`

`npm run dev` is the WXT extension watch build. It is not a web app server and is not the product.

```bash
npm run build    # production unpacked output
npm test         # Vitest, mocked fetch, no live AI
```

Pin the toolbar icon so it is easy to open.

## How to use it

| Action | What happens |
| --- | --- |
| Toolbar **click** | Opens the 760×560 **popup** (Manual Extraction, Automated Extraction, Result). |
| Keyboard | `Alt+Shift+C` opens the same popup. |
| **Connect** | Closes the popup and opens the Copilot website main page with `connectExtension=1`. |

This extension **never** asks for a password and **never** calls login, refresh, `/me`, or `POST /api/v1/auth/extension-token`. The website must mint the extension JWT and `chrome.runtime.sendMessage` it (see [`website-integration.md`](./website-integration.md)).

**Connect will not complete until the website implements** [`website-integration.md`](./website-integration.md). That file is copy-paste for the web app: mint with the **web** JWT, then `chrome.runtime.sendMessage`.

## Environment

Copy `.env.example` to `.env`. Rebuild after changes (`host_permissions` and `externally_connectable` are baked into the manifest).

| Variable | Default | Role |
| --- | --- | --- |
| `WXT_API_BASE_URL` | `http://localhost:8080` | Origin the worker `fetch`es. Local HTTP is allowed. |
| `WXT_WEBSITE_ORIGIN` | `http://localhost:5173` | Connect / Open Copilot |
| `WXT_WEBSITE_ORIGINS` | localhost `5173`/`5174`/`3000` and `127.0.0.1` | Extra `externally_connectable` origins |
| `WXT_WEBSITE_ORIGIN_PROD` | empty | Production website origin when known. Never `*` |
| `WXT_WEBSITE_LOGIN_PATH` | `/login` | Unused by Connect; kept for website docs |
| `WXT_WEBSITE_AFTER_EXTRACT_PATH` | `/` | Connect and **Open Copilot** (website main page) |

Job `sourceUrl` values must still be `http:` or `https:` (never `javascript:`, `data:`, `file:`, `chrome:`).

## Permitted APIs (the only backend calls)

All parse `fetch` runs in the **service worker**. JWT is `Authorization: Bearer <extension accessToken>` only.

| Path | Body |
| --- | --- |
| `POST {API}/api/v1/automated-job-extraction/parse` | `{ "sourceUrl": "https://…" }` |
| `POST {API}/api/v1/job-extraction/parse` | `{ "sourceUrl": "https://…", "rawJobText": "…" }` |

Toolbar Send uses Automated Extraction. Manual Send (and Confirm fallback) uses the second. `rawJobText` is required, max 50000 characters.

Parse does **not** save jobs. Review and save on the website.

## Token

The website mints `POST /api/v1/auth/extension-token` with a **web** access JWT (no body). The extension stores only `{ accessToken, expiresAt }`. **No refresh.** Default lifetime 900 seconds (~15 minutes). Treat as expired 15 seconds early.

Storage: `browser.storage.session` for UI state and the JWT. `{ accessToken, expiresAt }` is also mirrored to `browser.storage.local` so a service-worker restart during the 15-minute window does not drop the session. Disconnect and HTTP **401** clear both. Network errors, 429, 400, 409, 502, 503, and 500 do **not** clear the token.

## Permissions

- `storage`, `activeTab`, `scripting`, `notifications`
- `host_permissions`: **only** `{WXT_API_BASE_URL}/*` (never `<all_urls>`)
- `externally_connectable.matches`: official website origins only (never `*`)

## Manual checklist

- [ ] Load unpacked; ID is `lghllhgdcekacmdoolnekkkoffcmcaeo`
- [ ] `app.extension.id` on the API matches; API restarted
- [ ] Website implements mint + `sendMessage` ([website-integration.md](./website-integration.md))
- [ ] Toolbar click opens the 760×560 **popup** (not a separate OS window)
- [ ] Connect closes the popup and opens `http://localhost:5173/?connectExtension=1`
- [ ] After the website mints and `sendMessage`s the token, the chip shows **Connected**
- [ ] Automated Send on a public Greenhouse/Lever URL → badge `...` then `OK`
- [ ] Automated field accepts a pasted in-page job URL
- [ ] Manual Send with URL + pasted text
- [ ] 401 after clearing the token → Connect; network failure does not clear the token
- [ ] 409 already saved is informational
- [ ] 429 disables Send until `Retry-After`
- [ ] Confirm fallback **only** after automated `INVALID JOB URL` or 502 `Unable to access the job posting. Please try again later.`
- [ ] Disconnect; reconnect after ~15 minutes (no refresh in the extension)
