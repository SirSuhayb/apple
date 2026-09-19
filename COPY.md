# $BITE — Site copy

Source of truth for UI strings. Implementation: `src/lib/copy.ts` (imported by components, layout, race fetchers).
Phase UX: `src/lib/phase.ts` · `public/docs/bite-execution.md`.

---

## Document / SEO

_Source: `copy.meta` · `src/app/layout.tsx`_

**Title**
> $BITE — Eat it to the core.

**Description**
> A deflationary token on Robinhood Chain, priced in AAPL. Every transaction burns supply. Tap to destroy your $BITE and push toward the core. Reach the core before the deadline — or the apple rots.

---

## Nav

_Source: `copy.nav` · `RaceApp`_

**Brand**
> $BITE

**Badge**
> Soon · Preparing · Live · Racing

**Buy** (Act I+)
> Buy

**Soon** (Prologue — not a link)
> Soon

---

## Phases

_Source: `copy.phases` · `PhaseBar` / banners · `src/lib/phase.ts`_

**Labels**
> Prologue · Finding the apple · First bite · To the core

**Banners**
> The orchard is closed. $BITE mints soon — check back when trading opens.
> The orchard is being prepared. Trading is live — burns begin in Act II.
> 🔥 EARLY EATER BONUS — Burns in the first 72 hours count 2× toward your leaderboard rank.
> 🍎 {pct}% eaten. {n} days left. The whole orchard is watching.
> 🔥 Core reached. Payouts processing.
> 🪱 Deadline passed. The farmer collects.

### Prologue (act 0) — pre-mint

Default when `NEXT_PUBLIC_BITE_TOKEN` is unset. Override with `NEXT_PUBLIC_SITE_ACT=0` or `NEXT_PUBLIC_PROLOGUE=true`.

**UX**
- Nav badge: Soon · Primary CTAs: **Mint soon** / **Soon** (disabled — no pons / launchpad)
- Hero: “Before the first bite.” + game stakes · Apple time-lapse kept
- Game explainer stays · Leaderboard empty / teased · Chart link hidden
- No Trade / Buy / Buy on PONS paths that send visitors to buy

**Exit Prologue on mint morning**
1. Set `NEXT_PUBLIC_BITE_TOKEN` (+ curve / pool / pons URL)
2. Clear `NEXT_PUBLIC_SITE_ACT=0` / `NEXT_PUBLIC_PROLOGUE` (or set `NEXT_PUBLIC_SITE_ACT=1`)
3. Keep `NEXT_PUBLIC_DAY_ONE=true` until kitchen live → Act I
4. Redeploy — Buy/Trade unlock; burns still wait for Act II

---

## Hero

_Source: `copy.brand`, `copy.hero`_

**Headline**
> $BITE

**Taglines (by act / resolution)**
> Before the first bite. · Finding the right apple. · Eat it to the core. · They ate it to the core. · The apple has rotted.

**Prologue / Act I support (under tagline)**
> Eat to the core before time runs out — winners split the pot. (Prologue adds: Lose, and the farmer takes it.)

**Primary CTA**
> Mint soon (Prologue, not a link) · Trade on bite.party (Act I+) · Seed the pool (Act I+, next to Trade / Buy)

**Secondary CTA**
> The game ↓ · How eating works ↓

**Apple label**
> Tap the apple.

**Apple sticker** (produce sticker on the hero fruit)
> $BITE
> Tap the apple
> to burn $BITE

---

## The game

_Source: `copy.game` · `RaceApp` `#game` — visible in Prologue + Act I_

**Eyebrow**
> The game

**Headline**
> The game is simple.

**Body**
> Your goal is to eat the apple to its core before the timer runs out.
> Win, and you split the rewards from every trade with the other eaters.
> Lose, and the farmer takes the pot.

---

## The line

_Source: `copy.line`_ — supporting detail after the game explainer

**Prologue**
> Every transaction will take a bite.
> When $BITE launches… Right now the orchard is quiet.

**Act I**
> Every transaction will take a bite.
> When the burn contract goes live in Act II…

**Act II+**
> Every transaction takes a bite.
> Buy. Sell. Transfer. Every time $BITE moves…

---

## How eating works

_Source: `copy.how`_

**Intro**
> A few ways $BITE gets smaller.

**Trade.** · **Tap.** (locked Act I) · **Digest.** (locked Act I)

---

## The wager (Act II+)

_Source: `copy.wager`_

**Eyebrow**
> The wager

**Headline**
> Half the supply.
> One deadline. One farmer.

**Body / clarifier** — see `copy.ts`

---

## Meta wager (Act II+)

_Source: `copy.metaWager`_

**Empty**
> Core or rot? · Opens at 10% burned

**Live**
> Bet CORE · Bet ROT

---

## To the core (Act II+)

_Source: `copy.core` · `Countdown`_

**Eyebrow**
> To the core

**Countdown labels**
> days · hours · min · sec

---

## Why AAPL

_Source: `copy.pairing`_

**Eyebrow**
> Why AAPL

**Headline**
> The most valuable company on earth,
> being eaten alive.

---

## Biggest eaters

_Source: `copy.eaters` · `EatersBoard`_

**Intro**
> Who ate the most.

**Row stats** (home mini-board + `/leaderboard`)
> {n} trades · {amount} burned · {n} burns · {amount} wagered (when a row has MetaWager entry) · {pct} of apple
> 1st place only: Top eater
> % of apple = that wallet’s $BITE burned ÷ kitchen core target (same denominator as the on-site apple progress bar).
> Scoring: buy 0.01 / $BITE, sell 0.015 (1.5× buy), burn 1 pt / $BITE (2× in the early-eater window). Wager 0.001 / $BITE staked on MetaWager entry (gross, including the 10% entry fee) — a side bet, not a bite. Act I accum/hold is 0.01 per $BITE so burners lead. Telegram still only posts burns over $50.
> After a successful burn: share to X / copy / native share — “I just burned $BITE and climbed the leaderboard. the game is simple — burn more, rank higher, earn more when the pot pays out.”
> Connected Your Rank / generic share: “i just took a $bite of the apple to earn a piece of the pie.”
> One line per tweet, never both. Body has a single URL — the `/share?burn=&rank=&you=` link — never also bite.party. OG image is `biteTaken` until per-player images exist.
> `/share` landing (not the tweet): biteTaken image → “I ate {pct} of the apple” (own headline under the image, not in the player-row stats; {pct} = that wallet’s $BITE burned ÷ kitchen core target, same as the board; hide when burned or core is unknown so we never boast 0%) → sharer's leaderboard row (avatar/ENS, rank, points, burned/trades — same language as `/leaderboard`; do not add extra stats to this row) → “the game is simple — burn more, rank higher, earn more when the pot pays out.” → Take their spot + Burn $BITE → Return to bite.party. Load the `you` wallet from the board; if they’re outside the top 500, still show `rank` / `you` from the query and whatever stats you can (including % from `burn=` ÷ core target).

**Your Rank** (connected wallet — home + `/leaderboard`)
> Your Rank · #{n} of {total} · short address · points · trades · burned · burns · % of apple
> If you’re outside the top 10: Burn {X} $BITE to secure a top 10 spot. X = extra $BITE at 1 pt (2 in early-eater) to pass current rank 10. Hidden when you’re already in the top 10.
> Highlight that row on the board (subtle apple blush). Home: if you’re outside the top 10, a sticky Your Rank row still sits under the mini-board.
> Not connected: Connect a wallet to see your rank.
> Connected but missing / zero points: Not on the board yet — still shows the top-10 burn gap from a score of 0.
> Connected ineligible (dev): Not eligible to win.

**Search** (`/leaderboard`)
> Search by address — matches the full 0x, the shortened form, or a fragment.

**Empty**
> No bites yet. Be first.
> The leaderboard waits for the first eaters. (Prologue)
> The leaderboard activates when the race begins in Act II. (Act I)

---

## Tap the apple

_Source: `copy.tap`_

**CTA**
> Burn $BITE

**Locked (Prologue)**
> Burns open after mint. Stay hungry.

**Locked (Act I)**
> Burns open in Act II. Accumulate now.

**Day one**
> Watch the apple. Trading opens when $BITE mints — check back soon. (Prologue)
> Day one — watch the apple eaten to the core. Burns unlock when the kitchen is live.
> Play · Pause · Replay

---

## Specs

_Source: `copy.finePrint`_

> Chain · Standard · Pair · Mechanism · Phase (Prologue | Act n of 3) · Burned

---

## Take a $BITE

_Source: `copy.take`_

> Get ready for $BITE. · Mint soon (Prologue, not a link)
> Take a $BITE. · Copy address → · Buy on PONS · Seed the pool · Twitter · Telegram · Chart (Act I+)

---

## Seed the pool

_Source: `copy.lp` · `LpModal`_

Two pots. Liquidity is full-range via the Uniswap LP API. **Seed targets a 1% BITE/AAPL v4 pool with no hook** — not the live Dexscreener 0% pool. That 0% pool has a custom hook; Uniswap LPs there collect nothing from volume, and you cannot add a fee to an existing v4 pool (identity is token0, token1, fee, tickSpacing, hooks). Keep-aside stays in the connected wallet.

Before signing, the modal shows LP fee, share of the 1% pool, and share × fee × volume when Uniswap reports volume. After seeding, **Claim fees** collects uncollected tokens from your LP NFT (not keep-aside). **Remove from pool** is secondary.

> Seed the pool · Into the pool · Keep aside · Matching AAPL · Fee estimate · Claim fees
> Two pots. Liquidity goes into a 1% BITE/AAPL pool (no hook). Keep-aside stays in this wallet — Uniswap does not stake $BITE, and those tokens never go into LP.
> The live Dexscreener pool is 0% fee with a custom hook. Uniswap LPs there collect nothing from volume — you cannot turn a fee on that pool. Seed below uses a separate 1% pool with no hook.

---

## Footer

_Source: `copy.footer`_

> $BITE is a deflationary memecoin on Robinhood Chain. Every transaction burns supply. That is not financial advice. That is fruit.
> $BITE × AAPL · Robinhood Chain · 4663
