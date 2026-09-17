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

**Challenge**
> Challenge → `/challenge`

**Buy** (Act I+)
> Buy

**Soon** (Prologue — not a link)
> Soon

---

## Challenge (`/challenge`)

_Source: `src/lib/challenge-copy.ts` · `ChallengePage`_

**1,000,000 $BITE** builder challenge (prizes in **$BITE**, not USD). Five winners. Media kit: `public/challenge/bite-builder-kit.zip` (rebuild with `npm run challenge-kit`). Kit source docs live in `public/challenge/builder-kit/`.

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
> Mint soon (Prologue, not a link) · Trade on bite.party (Act I+)

**Secondary CTA**
> The game ↓ · How eating works ↓

**Apple label**
> Tap the apple.

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
> Take a $BITE. · Copy address → · Buy on PONS · Twitter · Telegram · Chart (Act I+)

---

## Footer

_Source: `copy.footer`_

> $BITE is a deflationary memecoin on Robinhood Chain. Every transaction burns supply. That is not financial advice. That is fruit.
> $BITE × AAPL · Robinhood Chain · 4663
