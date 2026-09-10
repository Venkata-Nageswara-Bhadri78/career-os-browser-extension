# Website integration — mint an extension JWT and hand it to Copilot Job Capture

The Copilot **website** (not this extension) authenticates the user and mints a restricted token. This repo has no web frontend. Paste the following into the official React app when you wire login.

**Unpacked extension ID:** `lghllhgdcekacmdoolnekkkoffcmcaeo`

Set that as website build-time `EXTENSION_ID` (and packed/CWS ID later if it changes). Backend `app.extension.id` must match.

The extension **never** calls `POST /api/v1/auth/extension-token`, login, refresh, or `/me`. Only a **web** access JWT (`cid` absent) may mint. An extension JWT on this route receives `403`.

## When to mint

When the user lands on login/register **or** any page with `connectExtension=1` **and** a live **web** access JWT exists:

The extension **Connect** button closes the popup and opens `{WXT_WEBSITE_ORIGIN}/?connectExtension=1` (the website main page). If the user is already logged in, mint immediately on that page.

1. `POST {API_BASE_URL}/api/v1/auth/extension-token` with `Authorization: Bearer <webAccessJwt>` and **no body**.
2. On `200`, read `response.data` (`accessToken`, `tokenType`, `client`, `expiresIn`).
3. `chrome.runtime.sendMessage(EXTENSION_ID, { type: "COPILOT_EXTENSION_TOKEN", accessToken, tokenType, client, expiresIn })`.
4. Handle `{ ok: true }` vs `{ ok: false, error }`.
5. If `chrome.runtime` is undefined: show “Install / enable the Copilot Job Capture extension.”

Never put tokens in the query string, logs, or job-site `postMessage` to `*`. Do not send the web JWT to the extension. Do not spread unknown fields onto the message.

Optional backup on the official website origin only:

```js
window.postMessage(
  { type: "COPILOT_EXTENSION_TOKEN", accessToken, tokenType, client, expiresIn },
  window.location.origin,
);
```

## Copy-paste (website)

```js
const EXTENSION_ID = "lghllhgdcekacmdoolnekkkoffcmcaeo"; // build-time config
const API_BASE_URL = "http://localhost:8080"; // same origin the extension uses

export async function mintAndPushExtensionToken(webAccessJwt) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      ok: false,
      error: "Install / enable the Copilot Job Capture extension.",
    };
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/extension-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${webAccessJwt}`,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success || !body.data) {
    return {
      ok: false,
      httpStatus: response.status,
      message: body?.message || "Could not issue an extension token.",
    };
  }

  const { accessToken, tokenType, client, expiresIn } = body.data;

  const reply = await chrome.runtime.sendMessage(EXTENSION_ID, {
    type: "COPILOT_EXTENSION_TOKEN",
    accessToken,
    tokenType,
    client,
    expiresIn,
  });

  return reply || { ok: false, error: "No reply from the extension." };
}

export function shouldConnectExtension() {
  return new URLSearchParams(window.location.search).get("connectExtension") === "1";
}

// After a successful website login, or on any page when connectExtension=1
// and a web JWT already exists:
//
//   const result = await mintAndPushExtensionToken(webAccessJwt);
//   if (!result.ok) showError(result.message || result.error);
```

Trigger this after login when `shouldConnectExtension()` is true, and also when the user is already logged in and opens the main page with `connectExtension=1`.

The extension Connect button closes the popup and opens:

`{WXT_WEBSITE_ORIGIN}{WXT_WEBSITE_AFTER_EXTRACT_PATH}?connectExtension=1`

Defaults: `http://localhost:5173/?connectExtension=1`.

## Success envelope (backend)

`200` message: `Browser extension access token issued.`

```json
{
  "success": true,
  "message": "Browser extension access token issued.",
  "data": {
    "accessToken": "eyJ…",
    "tokenType": "Bearer",
    "client": "browser-extension",
    "expiresIn": 900
  }
}
```

`expiresIn` is seconds (default 900). There is **no** `refreshToken`. `client` must be `browser-extension`.

## Mint errors (website only)

| HTTP | Message | Website UX |
| --- | --- | --- |
| 401 | `Unauthorized.` | User must log in again (web session missing/invalid). |
| 403 | `This client is not authorized to access this resource.` | Do not mint with an extension JWT. Use a web JWT. |
| 403 | `Browser extension access is disabled.` | `app.extension.enabled=false`. Tell the user extension access is off. |
| 429 | `Too many requests. Please try again later.` | Honor `Retry-After`. Mint limit default 10/min (IP and user). |

## What the extension stores

`{ accessToken, expiresAt }` only, in extension storage (never `localStorage` on a job site, never a content script). `expiresAt = Date.now() + expiresIn * 1000`. No refresh. After ~15 minutes, or on parse `401`, the user Connects again so the website mints a new extension JWT.

Website `POST /logout` (single session) does **not** bump `tokenVersion`; the extension JWT remains valid until `exp`. `logout-all` and password reset bump `tv`; the next parse is `401` and the extension clears its session.

## Manifest allow-list

The unpacked extension accepts external messages only from configured website origins (dev defaults include `http://localhost:5173`, `5174`, `3000` and the same ports on `127.0.0.1`). Production: set `WXT_WEBSITE_ORIGIN_PROD` (example placeholder `https://app.example.com`) and rebuild. Never `*`.
