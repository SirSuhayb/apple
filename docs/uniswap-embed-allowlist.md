# Uniswap embed origin allowlisting

The Trade/Buy modal can embed Uniswap via iframe at `https://app.uniswap.org/embed`. Framing is gated by Uniswap’s `frame-ancestors` CSP. Until your origin is on their allowlist, the iframe is blank (browser blocks it). You cannot self-register or configure this via env.

Docs: https://developers.uniswap.org/docs/trading/embed-app  
Help request: https://support.uniswap.org/hc/en-us/requests/new

## What this repo does today

- **Day 1 default:** Trade/Buy CTAs deep-link to pons (`NEXT_PUBLIC_PONS_TOKEN_URL` or launchpad). Uniswap is not in the primary UX.
- **Opt-in Uniswap modal:** set `NEXT_PUBLIC_SWAP_PROVIDER=uniswap` to restore the SwapModal.
- **Optional iframe:** with the uniswap provider, set `NEXT_PUBLIC_SWAP_EMBED_ENABLED=true` only after Uniswap has allowlisted your origins. Until then, leave it off (or omit it).

## Origins to request

Send each as a full scheme + host, **no path, no trailing slash**. Origins are matched exactly (`http://` ≠ `https://`; apex ≠ subdomain).

| Environment | Origin to allowlist |
|---|---|
| Local Next.js | `http://localhost:3000` |
| Local (alt port) | `http://localhost:3001` (only if you use it) |
| Production | `https://bite.party` (and `https://www.bite.party` if used) |
| Vercel production alias | Your project domain, e.g. `https://apple.vercel.app` |
| Vercel preview deploys | Prefer a wildcard if Uniswap accepts it: `https://*.vercel.app` — otherwise list each preview host you need |

If you use a custom preview domain, list that host too. Wildcard `https://*.example.com` does **not** cover the apex `https://example.com`; list both when needed.

## Exact steps for the user

1. Open https://support.uniswap.org/hc/en-us/requests/new
2. Choose the closest topic (developers / embedding / partnership — whatever the form offers) and describe:
   - Product: **$BITE / bite.party** — in-site Trade/Buy modal embeds Uniswap swap-only UI.
   - Embed URL pattern: `https://app.uniswap.org/embed?view=swap&chain=ethereum&inputCurrency=ETH&outputCurrency=…`
   - Paste the exact origin list from the table above.
3. Wait for Uniswap review. Approved origins take effect on their next web release (allow time after confirmation).
4. In Vercel / `.env.local`, set:
   ```bash
   NEXT_PUBLIC_SWAP_EMBED_ENABLED=true
   ```
   Redeploy / restart `npm run dev`. The modal will show the iframe; “Open Uniswap” remains as fallback (wallet / passkey flows often frame-bust anyway).

## Notes

- There is no Partner Portal env knob for this; allowlisting is manual Uniswap team review.
- `@uniswap/widgets` is a separate legacy React widget and is not what `app.uniswap.org/embed` uses.
- Money-moving / passkey actions may still navigate the top window to `app.uniswap.org` even after allowlisting (clickjacking protection).
