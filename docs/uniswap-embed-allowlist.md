# Uniswap embed origin allowlisting

The Trade/Buy modal can embed Uniswap via iframe at `https://app.uniswap.org/embed`. Framing is gated by Uniswap’s `frame-ancestors` CSP. Until your origin is on their allowlist, the iframe is blank (browser blocks it). You cannot self-register or configure this via env.

Docs: https://developers.uniswap.org/docs/trading/embed-app  
Help request: https://support.uniswap.org/hc/en-us/requests/new

## Robinhood Chain status (2026-09)

| Piece | Status |
|---|---|
| Uniswap web app on RH (4663) | Supported — use interface slug `chain=robinhood` (not `4663`) |
| Prefill pair for $BITE | `inputCurrency=<AAPL>` + `outputCurrency=<BITE CA>` |
| Deep-link `/swap?...` | Works — opens Uniswap in a new tab |
| In-page `/embed` iframe | **Blocked** — Uniswap `frame-ancestors` currently allows only `'self'`, Safe, Dexscreener, Datadog. **bite.party / www.bite.party / `*.vercel.app` are not allowlisted.** Our site CSP is not the blocker; Uniswap’s is. |

Verified live CSP on `app.uniswap.org/embed`:

```
frame-ancestors 'self' https://app.safe.global https://dexscreener.com https://*.dexscreener.com https://browser-intake-datadoghq.com
```

Until Uniswap adds our origins, **do not set `NEXT_PUBLIC_SWAP_EMBED_ENABLED=true`** — the iframe will render blank.

Primary Trade/Buy CTAs stay on **pons launchpad** (`/launchpad/:ca`). Uniswap is opt-in via `NEXT_PUBLIC_SWAP_PROVIDER=uniswap` (deep-link modal; embed still off).

Default Uniswap URLs (also overridable via env):

```
https://app.uniswap.org/embed?view=swap&chain=robinhood&inputCurrency=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9&outputCurrency=0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9
https://app.uniswap.org/swap?chain=robinhood&inputCurrency=0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9&outputCurrency=0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9
```

## What this repo does today

- **Default:** Trade/Buy CTAs deep-link to pons (`NEXT_PUBLIC_PONS_TOKEN_URL` or `/launchpad/${BITE_TOKEN}`). Note: `/token/:ca` 404s on pons — always use `/launchpad/:ca`.
- **Opt-in Uniswap modal:** set `NEXT_PUBLIC_SWAP_PROVIDER=uniswap` to restore the SwapModal (deep-link to RH AAPL→$BITE).
- **Optional iframe:** with the uniswap provider, set `NEXT_PUBLIC_SWAP_EMBED_ENABLED=true` only after Uniswap has allowlisted your origins. Until then, leave it off (or omit it).

## Origins to request

Send each as a full scheme + host, **no path, no trailing slash**. Origins are matched exactly (`http://` ≠ `https://`; apex ≠ subdomain).

| Environment | Origin to allowlist |
|---|---|
| Local Next.js | `http://localhost:3000` |
| Local (alt port) | `http://localhost:3001` (only if you use it) |
| Production | `https://bite.party` and `https://www.bite.party` |
| Vercel production alias | e.g. `https://apple-jet-theta.vercel.app` |
| Vercel preview deploys | Prefer a wildcard if Uniswap accepts it: `https://*.vercel.app` — otherwise list each preview host you need |

If you use a custom preview domain, list that host too. Wildcard `https://*.example.com` does **not** cover the apex `https://example.com`; list both when needed.

## Exact steps for the user

1. Open https://support.uniswap.org/hc/en-us/requests/new
2. Choose the closest topic (developers / embedding / partnership — whatever the form offers) and describe:
   - Product: **$BITE / bite.party** — in-site Trade/Buy modal embeds Uniswap swap-only UI.
   - Embed URL pattern: `https://app.uniswap.org/embed?view=swap&chain=robinhood&inputCurrency=…&outputCurrency=…`
   - Paste the exact origin list from the table above.
3. Wait for Uniswap review. Approved origins take effect on their next web release (allow time after confirmation).
4. In Vercel / `.env.local`, set:
   ```bash
   NEXT_PUBLIC_SWAP_EMBED_ENABLED=true
   NEXT_PUBLIC_SWAP_PROVIDER=uniswap
   ```
   Redeploy / restart `npm run dev`. The modal will show the iframe; “Open Uniswap” remains as fallback (wallet / passkey flows often frame-bust anyway).

## Notes

- There is no Partner Portal env knob for this; allowlisting is manual Uniswap team review.
- `@uniswap/widgets` is a separate legacy React widget and is not what `app.uniswap.org/embed` uses; it is not wired in this repo.
- Money-moving / passkey actions may still navigate the top window to `app.uniswap.org` even after allowlisting (clickjacking protection).
- Our `next.config.ts` does not set a CSP that blocks Uniswap; no site-side `frame-src` fix can override Uniswap’s `frame-ancestors`.
