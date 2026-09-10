# $BITE — Execution Doc

**Domain:** bite.party
**Chain:** Robinhood Chain (4663)
**Pair:** AAPL Stock Token
**Stack:** SvelteKit + Three.js + ethers/viem
**Deploy:** Vercel (adapter-vercel)

---

## 1. In-Site Trading

No PONS redirect. Embed Uniswap directly on bite.party.

### Uniswap Swap Widget

```bash
npm i @uniswap/widgets
```

```svelte
<SwapWidget
  provider={provider}
  jsonRpcUrlMap={{ 4663: "https://rpc.mainnet.chain.robinhood.com" }}
  defaultInputTokenAddress="NATIVE"
  defaultOutputTokenAddress="{BITE_CA}"
  theme={{
    primary: "#1d1d1f",
    secondary: "#86868b",
    interactive: "#f5f5f7",
    container: "#ffffff",
    accent: "#e53935",
    fontFamily: "-apple-system, SF Pro Display, sans-serif"
  }}
  width="100%"
/>
```

### Robinhood Chain contract addresses

| Contract | Address |
|---|---|
| UniswapV2Router02 | `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` |
| WETH (L2) | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| USDG (L2) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

### Where the swap widget appears

- **Hero section:** "Trade on bite.party" button opens a slide-up panel
  containing the swap widget, not a new page. The panel overlays the
  bottom half of the screen (mobile) or appears as a right-side drawer
  (desktop).
- **"Take a $BITE" section:** The swap widget is embedded inline,
  always visible, below the contract address.
- **Nav "Buy" button:** Scrolls to the inline widget in the Take a
  $BITE section, or opens the slide-up panel if user hasn't scrolled
  that far.

### Swap panel states

| State | Display |
|---|---|
| No wallet | "Connect wallet to trade" + wallet button |
| Connected, no ETH | "You need ETH on Robinhood Chain to trade" + bridge link |
| Connected, ready | Full swap widget, $BITE pre-selected as output |
| Tx pending | Spinner + "Swapping..." |
| Tx confirmed | "Swapped! You now hold {n} $BITE" + close |
| Tx failed | "Transaction failed" + retry |

---

## 2. Phase Specs

### PROLOGUE — "Before the First Bite"

**Duration:** Until `$BITE` is minted / CA published  
**Burn contract:** Not deployed.  
**Trading:** Not live. No buy / pons / launchpad CTAs.

Default when `NEXT_PUBLIC_BITE_TOKEN` is unset. Force with `NEXT_PUBLIC_SITE_ACT=0` or `NEXT_PUBLIC_PROLOGUE=true`. Exit by setting the token CA (and clearing act/prologue overrides) → Act I.

#### Site states

| Section | State |
|---|---|
| Nav badge | "Soon" (gray) |
| Phase dots | Prologue active, Acts I–III upcoming |
| Banner | "The orchard is closed. $BITE mints soon — check back when trading opens." |
| Hero tagline | "Before the first bite." |
| Hero apple | Time-lapse / whole apple for atmosphere. Not tappable. |
| Hero CTA primary | "Mint soon" — disabled, not a buy link |
| Hero CTA secondary | "The game ↓" |
| Progress / countdown / wager | Hidden |
| Game explainer | Visible (eat to core / split pot / farmer) |
| Leaderboard | Empty + tease |
| Buy / Chart / PONS | Hidden or "Mint soon" — no launchpad deep-links |

---

### ACT I — "Finding the Right Apple"

**Duration:** ~1 week
**Burn contract:** Not deployed. Creator fees flow to deployer wallet.
**Burn amount this phase:** Zero.

#### Site states

| Section | State |
|---|---|
| Nav badge | "Preparing" (gray) |
| Phase dots | ① active, ②③ upcoming |
| Banner | "The orchard is being prepared. Trading is live — burns begin in Act II." |
| Hero tagline | "Finding the right apple." |
| Hero apple | Whole, untouched, rotating. Not tappable. |
| Hero CTA primary | "Trade on bite.party" → opens swap panel |
| Hero CTA secondary | "What's coming ↓" |
| Progress bar | Hidden |
| Countdown | Hidden |
| "Every transaction" section | Future tense: "will take a bite" / "Right now, you're accumulating." |
| How cards | Trade: active. Tap: locked ("Coming in Act II"). Digest: locked. |
| Wager section | Hidden entirely |
| Meta wager | Hidden entirely |
| Leaderboard | Empty state: "No bites yet. Be first." + "The leaderboard activates in Act II." |
| Tap the Apple section | Shows concept but burn button disabled: "Burns open in Act II. Accumulate now." |
| Spec grid | Phase cell shows "Act 1 of 3" · Burned cell shows "0%" |

#### What you're doing operationally
- Collecting creator fees to personal wallet
- Setting up Dexscreener listing
- Twitter bot reporting swaps (not burns — there are none)
- Telegram bot forwarding swap alerts
- Building + testing burn contract on testnet (chain ID 46630)
- Building holder base for the race

#### Bot behavior (Twitter + Telegram)
- Reports: new swaps, holder count milestones, volume
- Does NOT mention burns or the race — those don't exist yet
- Tone: "The orchard is growing. {n} holders."

---

### ACT II — "The First Bite"

**Trigger:** You deploy burn contract, swap creator fee wallet, announce.
**Duration:** First ~3 days of the race (72-hour early eater bonus).
**What changes operationally:** Creator fees now route to burn contract.
50% buy-and-burn, 50% prize pot.

#### Transition moment

On X and Telegram:
> The first bite has been taken.
> 50% of the supply. One deadline.
> Act II. The clock is running.
> bite.party

#### Site states

| Section | State |
|---|---|
| Nav badge | "Live" (green) |
| Phase dots | ① ✓, ② active, ③ upcoming |
| Banner | "🔥 EARLY EATER BONUS — Burns in the first 72h count 2× toward leaderboard rank." |
| Hero tagline | "Eat it to the core." |
| Hero apple | First small bite visible (~2–5%). Now tappable. |
| Hero CTA primary | "Trade on bite.party" |
| Hero CTA secondary | "How eating works ↓" |
| Progress bar | Live. Shows real burn % from onchain data. |
| Countdown | Live. Shows time remaining to deadline. |
| "Every transaction" section | Present tense: "takes a bite" |
| How cards | All three unlocked |
| Wager section | Visible |
| Meta wager | Empty state (see below) |
| Leaderboard | Begins populating. Shows first 1–3 eaters. |
| Tap the Apple section | Burn button active: "Burn $BITE" → opens tap modal |
| Spec grid | Phase: "Act 2 of 3" · Burned: live % |

#### Meta wager empty state (Act II)

The meta wager section is visible but locked:

```
🍎 ⚔️ 🪱

Core or rot?

The meta wager opens when the burn hits 10%.
Pick a side — will the eaters reach the core,
or will the apple rot?

[  Opens at 10% burned  ]

████░░░░░░  4.2% of 10% threshold
```

Info button (?) opens modal explaining both sides.

#### 72-hour multiplier logic

- Burns (tap and trade) in the first 72 hours of Act II get 2× leaderboard
  weight.
- After 72 hours, multiplier drops to 1×.
- The banner auto-updates: "🔥 EARLY EATER BONUS — 14h 22m remaining."
- When expired: banner disappears. No announcement — it just ends.

#### Setting the deadline

Do NOT set the deadline before Act II launches. Watch burn velocity
for the first 48 hours. Then set a deadline that makes 50% feel
achievable but tight — the community should feel like they *might
not make it*. That doubt is the engine.

Announce the deadline 48 hours into Act II:
> The deadline is set. {n} days.
> The clock is running. bite.party

---

### ACT III — "To the Core"

**Trigger:** Automatic. When leaderboard has 5+ eaters and burn is past
10%, the site reads as Act III. No manual switch needed — the content
fills itself in.
**Duration:** Remaining time until deadline (~2–3 weeks).

#### Site states

| Section | State |
|---|---|
| Nav badge | "Racing" (red) |
| Phase dots | ①② ✓, ③ active |
| Banner (if < 7 days left) | "🍎 {pct}% eaten. {n} days left. The whole orchard is watching." |
| Hero apple | Significantly eaten. Bite grows with real burn data. |
| Progress bar | Prominent. Color shifts toward red as deadline approaches. |
| Countdown | Large. Turns red under 3 days. |
| Meta wager | Live (see below) |
| Leaderboard | Full bento grid. Competitive. Updates in real time. |
| Tap section | Active with growing urgency copy as deadline nears |

#### Meta wager live state (Act III)

Appears once burn passes 10%:

```
🍎 CORE 68% ████████████░░░░ ROT 32% 🪱

The worms are betting against you.
Pick a side. Stake your $BITE.

[ Bet CORE ]  [ Bet ROT ]
```

Odds shift in real time as new wagers come in. Parimutuel pool — the
more people bet one side, the better the payout for the other.

#### Milestone toasts

| Burn % | Toast |
|---|---|
| 10% | "The skin is breaking." + Meta wager unlocks |
| 25% | "Quarter eaten. The core is showing." |
| 40% | "Almost there. Ten percent to go." |
| 49% | "One percent. The whole orchard is watching." |
| 50% | "🔥 Core reached." → Resolution state |
| Deadline hit | "🪱 The apple has rotted." → Resolution state |

#### Urgency escalation

| Time remaining | Site behavior |
|---|---|
| > 7 days | Normal display |
| 3–7 days | Banner appears with days remaining |
| 1–3 days | Countdown turns red. Banner: "The apple is browning." |
| < 24 hours | Countdown pulses. Background tints slightly warm. |
| < 1 hour | Full urgency. "Minutes remain." |

---

## 3. Tap to Burn — Full Modal Flow

The tap-to-burn is the core mechanic. The UX must be
frictionless but deliberate — burning is permanent.

### Flow

```
User taps apple (or "Burn $BITE" button)
         │
         ▼
┌─ STEP 1: Connect ─────────────┐
│ "Connect wallet to burn."      │
│ [ Connect Wallet ]             │
│                                │
│ (Skip if already connected)    │
└────────────────────────────────┘
         │
         ▼
┌─ STEP 2: Amount ───────────────┐
│ "How much do you want to eat?" │
│                                │
│ Your balance: 12,400 $BITE     │
│                                │
│ [ 100 ] [ 500 ] [ 1000 ] [MAX]│
│                                │
│ Or type a custom amount:       │
│ [ __________ ]                 │
│                                │
│ This will permanently destroy  │
│ your tokens. No undo.          │
│                                │
│ [ Burn {n} $BITE ]             │
└────────────────────────────────┘
         │
         ▼
┌─ STEP 3: Confirm (wallet) ─────┐
│ Wallet popup appears.           │
│ Site shows: "Confirm in wallet" │
│ Spinner.                        │
└─────────────────────────────────┘
         │
         ▼
┌─ STEP 4: Result ───────────────┐
│                                │
│ 🔥                             │
│ You ate 500 $BITE.             │
│ Gone forever.                  │
│                                │
│ {pct}% closer to the core.    │
│                                │
│ [ Burn more ] [ Close ]        │
│                                │
│ Share: "I burned 500 $BITE     │
│ on bite.party 🍎🔥"    [Copy] │
└────────────────────────────────┘
```

### Modal states

| State | Display |
|---|---|
| No wallet | Step 1: connect prompt |
| Wallet connected, zero balance | "You don't have any $BITE to burn." + link to swap widget |
| Wallet connected, has balance | Step 2: amount picker |
| Tx pending | "Confirm in your wallet..." + spinner |
| Tx confirmed | Step 4: celebration + share prompt |
| Tx failed | "Transaction failed. Try again?" + retry button |
| User rejects in wallet | "You cancelled the burn." + close |

### Technical

The burn is a transfer to a known dead address:
`0x000000000000000000000000000000000000dEaD`

Or a custom burn function on the contract if you build one. The
standard ERC-20 approach is `transfer(DEAD_ADDRESS, amount)` which
any wallet can sign.

---

## 4. Leaderboard States

### Empty (Act I)
```
No bites yet. Be first.
The leaderboard activates when the race begins in Act II.
```

### Sparse (early Act II, 1–3 eaters)
Show whatever exists. No minimum to display. Even one eater gets
the #1 hero card treatment — it incentivizes being first.

### Populated (late Act II / Act III, 4+ eaters)
Full bento grid:
- #1: full-width hero card
- #2–3: half-width row
- #4–6: third-width row
- #7+: compact list below the grid (if needed)

### Post-resolution
Leaderboard freezes. Shows final rankings. If core was reached,
shows payout amounts next to each eater.

---

## 5. Resolution States

### Core reached (win)

| Element | State |
|---|---|
| Apple 3D | Shows the core — stem, seeds, nothing else |
| Hero tagline | "They ate it to the core." |
| Banner | "🔥 Core reached. Payouts processing." |
| Countdown | Replaced with: "Reached in {n} days, {h} hours." |
| Progress | 50%+ — bar full, green |
| Leaderboard | Frozen. Shows payout column. |
| Meta wager | CORE wins. Shows payout processing. |
| Burn button | Disabled. "The race is over." |
| Prize pot | Shows total, breakdown per eater |

### Apple rots (lose)

| Element | State |
|---|---|
| Apple 3D | Shows decay — brown, wilted, worm holes |
| Hero tagline | "The apple has rotted." |
| Banner | "🪱 Deadline passed. The farmer collects." |
| Countdown | "Time's up." |
| Progress | Shows final %, under 50, red |
| Leaderboard | Frozen. No payout column (eaters get nothing) |
| Meta wager | ROT wins. Shows payout processing. |
| Burn button | Disabled. |
| Farmer payout | Shows deployer payout |

---

## 6. Bot Behavior by Phase

### Twitter bot

| Phase | Triggers on | Format |
|---|---|---|
| Act I | New swap (> threshold) | "🍎 {wallet} bought {n} $BITE. {holders} holders in the orchard." |
| Act I | Holder milestone | "🌱 {n} holders. The orchard grows." |
| Act II | Burn (tap) | "🔥 {wallet} burned {n} $BITE. {pct}% to the core. {time} left." |
| Act II | Burn (trade) | "🍎 Trade burn: {n} $BITE chewed. {pct}% to the core." |
| Act II | Early multiplier ends | "⏰ The 2× bonus has ended. Burns now count 1×." |
| Act III | Large burn | "🔥🔥 {wallet} BURNED {n} $BITE. {pct}% — the core is close." |
| Act III | Milestone | "🍎 {milestone_message}" |
| Act III | Meta wager shift | "🪱 The worms are gaining — ROT now at {pct}%." |
| Act III | < 24h left | "⏰ FINAL HOURS. {pct}% eaten. {time} left. bite.party" |
| Resolution | Core reached | "🔥 CORE REACHED. {total} $BITE burned. The eaters win. bite.party" |
| Resolution | Rotted | "🪱 The apple has rotted. {pct}% eaten. The farmer collects." |

### Telegram bot

Same triggers, same copy, but with:
- Inline buttons: [View on bite.party] [View on Blockscout]
- Pin milestone messages
- Pin deadline announcement

---

## 7. Contract Architecture

### Phase 1 (Act I): Standard ERC-20

Deployed via PONS. Creator fees flow to your wallet. No custom logic.

### Phase 2 (Act II+): Burn contract

A contract that receives creator fees and executes the 50/50 split:

```
receive()
  ├── 50% → buy $BITE on Uniswap → send to 0xdead (burn)
  └── 50% → prize pot (held in contract)

claimPrize(wallet, amount)  // called post-resolution by owner
```

Swap the creator fee destination on PONS from your wallet to this
contract address. From that moment, every swap's creator fee
auto-splits.

### Phase 3 (optional): Meta wager contract

```
wageCORE(amount)     → lock $BITE
wageROT(amount)      → lock $BITE
resolve(outcome)     → called by owner when result is determined
claim()              → winners withdraw proportional share
```

5% protocol fee on winning pot.

Owner calls `resolve(CORE)` or `resolve(ROT)` based on whether
50% burn was reached by the deadline. Can be automated with a
Chainlink Automation keeper watching the burn address balance.

---

## 8. Data Reads

All live data on the site comes from onchain reads:

| Data point | Source |
|---|---|
| Burn % | `balanceOf(0xdead)` / total supply |
| Remaining supply | total supply - `balanceOf(0xdead)` |
| Holder count | Blockscout API or Transfer event indexing |
| Leaderboard | Index Transfer events to 0xdead, sum per wallet |
| Prize pot | `address(burnContract).balance` or `balanceOf` |
| Meta wager odds | Read contract state |
| AAPL price | Chainlink price feed on Robinhood Chain |

Use viem's `readContract` for direct reads. Poll every 15 seconds
for the progress bar. Poll every 60 seconds for the leaderboard.
Use WebSocket subscription for real-time burn events (animate the
apple bite on each incoming burn).

---

## 9. Timeline

```
Week 0
  Day 1    Deploy token on PONS (BITE × AAPL)
  Day 1    bite.party live in Act I state
  Day 1    Twitter + Telegram bots reporting swaps
  Day 1-7  Collect creator fees, build holder base
  Day 3-7  Build + test burn contract on testnet

Week 1
  Day 7-8  Deploy burn contract to mainnet
  Day 8    Swap creator fee wallet → burn contract
  Day 8    Site flips to Act II. Countdown starts.
  Day 8    Announce on X + TG. 72h multiplier live.
  Day 10   Watch burn velocity. Set deadline.
  Day 10   Announce deadline. "The clock is running."

Week 2-4
  Day 10+  Act III. Full race. Leaderboard competitive.
  Day 14   Meta wager opens (if 10% burned)
  Day 21+  Urgency escalation as deadline approaches.

Week 4 (or whenever deadline hits)
  Day ~30  Resolution. Core or rot.
           Prize payout or farmer payout.
           Site enters trophy/memorial state.
```

---

*bite.party · $BITE × AAPL · Robinhood Chain · 4663*
