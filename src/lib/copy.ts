import { formatEther } from "viem";
import {
  BITE_TOKEN,
  CHAIN_ID,
  PONS_TOKEN_URL,
} from "./config";
import type { SiteAct } from "./phase";

/** Central site copy — keep in sync with COPY.md */

export const copy = {
  meta: {
    title: "$BITE — Eat it to the core.",
    description:
      "A deflationary token on Robinhood Chain, priced in AAPL. Every transaction burns supply. Tap to destroy your $BITE and push toward the core. Reach the core before the deadline — or the apple rots.",
  },

  brand: "$BITE",
  tagline: "Eat it to the core.",

  nav: {
    buy: "Buy",
    seed: "Seed the pool",
    soon: "Soon",
    leaderboard: "Leaderboard",
    profile: "Profile",
    badge: {
      soon: "Soon",
      preparing: "Preparing",
      live: "Live",
      racing: "Racing",
    },
  },

  phases: {
    prologue: "Prologue",
    labels: [
      "Finding the apple",
      "First bite",
      "To the core",
    ] as const,
    banners: {
      prologue:
        "The orchard is closed. $BITE mints soon — check back when trading opens.",
      act1: "The orchard is being prepared. Trading is live — burns begin in Act II.",
      earlyEater:
        "🔥 EARLY EATER BONUS — Burns in the first 72 hours count 2× toward your leaderboard rank.",
      earlyEaterRemaining: (remaining: string) =>
        `🔥 EARLY EATER BONUS — ${remaining} remaining.`,
      urgency: (pct: string, days: string) =>
        `🍎 ${pct}% eaten. ${days} days left. The whole orchard is watching.`,
      browning: "The apple is browning.",
      minutes: "Minutes remain.",
      core: "🔥 Core reached. Payouts processing.",
      rot: "🪱 Deadline passed. The farmer collects.",
    },
  },

  hero: {
    tagline: {
      0: "Before the first bite.",
      1: "Finding the right apple.",
      2: "Eat it to the core.",
      3: "Eat it to the core.",
      core: "They ate it to the core.",
      rot: "The apple has rotted.",
    } as const,
    /** Short stake line under Prologue / Act I tagline */
    support: {
      0: "Eat to the core before time runs out — winners split the pot. Lose, and the farmer takes it.",
      1: "Eat to the core before time runs out — winners split the pot.",
    } as const,
    ctaPrimary: "Trade on bite.party",
    ctaSeed: "Seed the pool",
    ctaPrimarySoon: "Mint soon",
    ctaSecondary: {
      0: "The game ↓",
      1: "The game ↓",
      2: "How eating works ↓",
      3: "How eating works ↓",
    } as const,
    appleLabel: "Tap the apple.",
    /** Produce-sticker lines on the hero apple */
    sticker: {
      kicker: "$BITE",
      action: "Tap the apple",
      detail: "to burn $BITE",
    },
  },

  /** Core game explainer — visible in Act I (and later acts) before mechanics */
  game: {
    eyebrow: "The game",
    headline: "The game is simple.",
    body: [
      "Your goal is to eat the apple to its core before the timer runs out.",
      "Win, and you split the rewards from every trade with the other eaters.",
      "Lose, and the farmer takes the pot.",
    ] as const,
  },

  line: {
    headline: {
      0: ["Every transaction", "will take a bite."],
      1: ["Every transaction", "will take a bite."],
      racing: ["Every transaction", "takes a bite."],
    } as const,
    body: {
      0: "When $BITE launches, every buy, sell, and transfer will burn supply. Right now the orchard is quiet. The race hasn't started.",
      1: "When the burn contract goes live in Act II, every buy, sell, and transfer will burn supply. Right now, you're accumulating. The race hasn't started.",
      racing:
        "Buy. Sell. Transfer. Every time $BITE moves, supply is burned forever. The apple gets smaller. Your share gets bigger.",
    },
  },

  how: {
    intro: ["A few ways", "$BITE gets smaller."],
    comingAct1: "Coming in Act I",
    comingAct2: "Coming in Act II",
    items: [
      {
        icon: "↔",
        title: "Trade.",
        body: "Buys and sells both burn supply. Selling chews harder — a larger cut on the way out.",
        /** Locked in Prologue; active from Act I when trading opens */
        lockUntilAct: 1 as const,
      },
      {
        icon: "👆",
        title: "Tap.",
        body: "The only real burn. Destroy your $BITE directly and push toward the core.",
        lockUntilAct: 2 as const,
      },
      {
        icon: "◐",
        title: "Digest.",
        body: "Creator fees split fifty-fifty. Half buys and burns. Half fills the prize pot.",
        lockUntilAct: 2 as const,
      },
    ],
  },

  wager: {
    eyebrow: "The wager",
    headline: ["Half the supply.", "One deadline. One farmer."],
    body: "Burn 50% of the burnable supply before the deadline. Reach the core and the prize pot pays eaters. Miss it, and the apple rots. Only the farmer is paid.",
    clarifier:
      "The farmer is the deployer. The eaters are you. This is not a metaphor. It is fruit.",
  },

  decay: {
    bannerFresh: "The apple is fresh.",
    bannerRotting: "The apple is rotting.",
    statusFresh: "Fresh",
    statusRotting: "Rotting",
    tooltipLabel: "Fresh or Rotten",
    modalTitle: "Fresh or Rotten",
    modalPrev: "Back",
    modalNext: "Next",
    modalDone: "Done",
    slides: [
      {
        title: "Keep the apple fresh",
        body: [
          "When the market is active, the apple stays fresh to eat. Frequent activity keeps the decay at bay. Low activity lets the rot in.",
        ],
      },
      {
        title: "Or the apple rots over time",
        body: [
          "The apple begins to turn brown when the market is quiet. When trading volume and the market cap slumps, the rot follows.",
        ],
      },
      {
        title: "The floor rises every week",
        // Static fallback; live floors replace via floorSlideBody().
        body: [
          "The ATH of each week determines the floor of the next week. This week's floor is 50k. Next week's is 151k. Below the floor, the rot grows.",
        ],
      },
    ] as const,
    floorSlideBody: (thisWeek: string, nextWeek: string) =>
      `The ATH of each week determines the floor of the next week. This week's floor is ${thisWeek}. Next week's is ${nextWeek}. Below the floor, the rot grows.`,
    eatenLabel: "Eaten",
    eatenPct: (pct: string) => `${pct}% eaten`,
    qaChip: (n: string) => `QA decay ${n} — localhost only`,
  },

  metaWager: {
    eyebrow: "The meta wager",
    emptyTitle: "Core or rot?",
    emptyBody:
      "The meta wager opens when the burn hits 10%. Pick a side — will the eaters reach the core, or will the apple rot?",
    opensAt: "Opens at 10% burned",
    thresholdProgress: (pct: string) => `${pct}% of 10% threshold`,
    liveLead: "The worms are betting against you.",
    liveCta: "Pick a side. Stake your $BITE.",
    betCore: "Bet CORE",
    betRot: "Bet ROT",
    infoTitle: "The Meta Wager",
    infoBody:
      "A side bet on the outcome. Stake $BITE on CORE (50% reached before deadline) or ROT (deadline first). Odds shift with every wager. Winners split the pot proportionally.",
  },

  core: {
    eyebrow: "To the core",
    countdown: ["days", "hours", "min", "sec"] as const,
    remaining: (n: string) => `${n} remaining`,
    burned: (n: string) => `${n} burned`,
  },

  pairing: {
    eyebrow: "Why AAPL",
    headline: [
      "The most valuable company on earth,",
      "being eaten alive.",
    ],
    body: "The Apple logo is an apple with a bite taken out of it. Rob Janoff designed it in 1977. He said the bite was for scale — so you'd know it was an apple, not a cherry.",
    then: "$BITE is priced in AAPL. A three-trillion-dollar company, denominated in a token whose entire purpose is to be consumed.",
  },

  eaters: {
    intro: ["Who", "traded the most."],
    introAct2: ["Who", "ate the most."],
    columns: ["Rank", "Eater", "Burned", "Buys", "Sells"] as const,
    rowMeta: (burned: string, buys: string, sells: string) =>
      `burned ${burned} · ${buys} buys · ${sells} sells`,
    empty: "No traders yet. Be first.",
    emptyHint: "The leaderboard activates when the race begins in Act II.",
    emptyHintPrologue: "The leaderboard waits for the first eaters.",
  },

  leaderboard: {
    title: "Leaderboard",
    headline: "Every trade counts.",
    headlineAct1: "Accumulate. Hold. Burn. Climb.",
    subtitle:
      "Points from buys, sells, and burns. Wagers are a side bet — they count a little.",
    subtitleAct1:
      "Points from buying, holding, and burning $BITE. Act I accumulation carries into Act II.",
    columns: ["Rank", "Trader", "Points", "Trades"] as const,
    pts: "pts",
    trades: (n: number) => `${n} trade${n === 1 ? "" : "s"}`,
    burnsCount: (n: number) => `${n} burn${n === 1 ? "" : "s"}`,
    burnedAmount: (amount: string) => `${amount} burned`,
    wageredAmount: (amount: string) => `${amount} wagered`,
    eatenPct: (pct: string) => `${pct} of apple`,
    topEater: "Top eater",
    buys: "Buys",
    sells: "Sells",
    burns: "Burns",
    totalTrades: "Total trades",
    totalPoints: "Total points",
    empty: "No trades yet.",
    emptyHint: "The leaderboard populates when trading begins.",
    emptyHintAct1:
      "All wallets trading or holding $BITE since launch appear here. DM the bot your 0x… in Telegram to claim identity for /points.",
    viewAll: "Show full leaderboard",
    viewAllHint: "Top 10 on the home board — open the full list for every trader.",
    devBadge: "Dev",
    ineligible: "Ineligible",
    yourRank: "Your Rank",
    you: "You",
    connectHint: "Connect a wallet to see your rank.",
    connectCta: "Connect wallet",
    rankOf: (rank: number, total: number) => `#${rank} of ${total}`,
    showOnBoard: "Show on board",
    notOnBoard: "Not on the board yet.",
    notOnBoardHint:
      "This wallet isn’t in the ranked list — no points yet, below the threshold, or a contract. Trade or burn $BITE from an eligible wallet to appear.",
    belowThreshold: "Not ranked yet.",
    belowThresholdHint:
      "This wallet is on file but has no ranking points. Only wallets with points above zero are ranked.",
    ineligibleYou: "Not eligible to win.",
    ineligibleYouHint:
      "This wallet is marked ineligible — it can appear on the board but cannot take the pot.",
    top10Spot: (amount: string) =>
      `Burn ${amount} $BITE to secure a top 10 spot`,
    searchPlaceholder: "Search by address",
    searchEmpty: "No wallets match that address.",
    searchClear: "Clear",
    scoring: {
      eyebrow: "How scoring works",
      buy: "Buy — 0.01 pts per $BITE",
      sell: "Sell — 0.015 pts per $BITE (1.5× buy)",
      tap: "Burn — 1 pt per $BITE (2× in the early-eater window)",
      wager: "Wager — 0.001 pts per $BITE staked on entry (side bet, not a bite)",
      accum: "Act I — Accumulation: +0.01 pt per whole $BITE gained",
      hold: "Act I — Holding: 100 $BITE held for 1 hour = 0.01 pt",
      burn: "Act II — Burns: kitchen.bite() scores 1 pt per $BITE",
      tapFloor:
        "Every kitchen burn scores. Telegram still only posts burns over $50.",
      tradesAct1:
        "Trades — buys since launch count (all wallets; link in Telegram for /points identity)",
      devNote:
        "Dev wallets appear on the board with a Dev badge and are ineligible to win.",
      eligibility:
        "Only wallets with points > 0 are ranked. Dev and team wallets are shown but marked ineligible — they cannot win the pot.",
    },
    back: "← Back",
    shareRank: "Share your rank",
  },

  tap: {
    eyebrow: "Tap the apple",
    headline: "The only real burn.",
    body: "Trades write the tape — they move the price and burn a little. Tapping destroys your $BITE permanently and pushes the whole race toward the core.",
    cta: "Burn $BITE",
    ctaLocked: "Burns open in Act II. Accumulate now.",
    ctaLockedPrologue: "Burns open after mint. Stay hungry.",
    raceOver: "The race is over.",
    connect: "Connect wallet",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    burn: (amount: string) => `Burn ${amount} $BITE`,
    burning: "Chomping…",
    kitchenMissing: "Kitchen not deployed yet",
    demoBurn: "Simulate burn (preview)",
    confirm: (amount: string) => `You ate ${amount} $BITE. Gone forever.`,
    approve: "Approve",
    amountPlaceholder: "BITE amount",
    presets: [
      { label: "Nibble", amount: "100" },
      { label: "Mouthful", amount: "1000" },
      { label: "Big bite", amount: "5000" },
    ] as const,
    modal: {
      close: "Close",
      stepConnect: "Connect your wallet to take a bite.",
      stepAmount: "How much do you want to eat?",
      stepBurning: "Confirm in your wallet…",
      completeTitle: "Bite taken.",
      completePoints: (points: string) => `+${points} pts`,
      completeProgress: (pct: string) => `${pct}% of the apple eaten`,
      done: "Done",
      demoNote:
        "Preview mode — no chain required. Wire kitchen + token for live burns.",
      share: "Share this bite",
    },
    dayOne: {
      note: "Day one — watch the apple eaten to the core. Burns unlock when the kitchen is live.",
      notePrologue:
        "Watch the apple. Trading opens when $BITE mints — check back soon.",
    },
  },

  share: {
    eyebrow: "$BITE",
    postX: "Post on X",
    share: "Share",
    copy: "Copy text",
    copied: "Copied.",
    takeSpot: "Take their spot",
    eatenBoast: (pct: string) => `I ate ${pct} of the apple`,
    pitch:
      "the game is simple — burn more, rank higher, earn more when the pot pays out.",
    home: "Return to bite.party",
    fallback:
      "i just took a $bite of the apple to earn a piece of the pie.",
    burn: (_amount: string, _rank?: number) =>
      "I just burned $BITE and climbed the leaderboard. the game is simple — burn more, rank higher, earn more when the pot pays out.",
    rank: (_rank: number) =>
      "i just took a $bite of the apple to earn a piece of the pie.",
    ogBurnTitle: (amount: string, rank?: number) =>
      rank
        ? `I just burned ${amount} $BITE · #${rank}`
        : `I just burned ${amount} $BITE`,
    ogRankTitle: (rank: number) => `I'm #${rank} on $BITE`,
  },

  profile: {
    title: "Profile",
    headline: "Your bite.",
    headlinePublic: "Eater profile.",
    subtitle: "Rank, stats, and titles from the board — no new contracts.",
    back: "← Back",
    connectHint: "Connect a wallet to open your profile.",
    connectCta: "Connect wallet",
    viewPublic: "Public profile",
    notOnBoard: "Not on the board yet.",
    notOnBoardHint:
      "No scored trades or burns for this wallet yet. Trade or burn $BITE to appear.",
    rankLabel: "Rank",
    scoreLabel: "Score",
    burnedLabel: "Burned",
    buysLabel: "Buys",
    sellsLabel: "Sells",
    holdLabel: "Holding",
    holdLoading: "Reading wallet…",
    holdUnavailable:
      "Hold titles need a live wallet balance — available on your own profile.",
    titlesEyebrow: "Titles",
    titlesHeadline: "Unlocked so far.",
    titlesEmpty: "No titles yet — take a first bite.",
    titlesPickHint: "Tap an unlocked title to use it on your share.",
    titlesPickNone: "Share without a title until you unlock one.",
    forShare: "On share",
    useOnShare: "Use on share",
    locked: "Locked",
    unlocked: "Unlocked",
    unavailable: "Unavailable",
    comingSoon: "Coming soon",
    titles: {
      // Orchard arc: pick → keep → bite toward the core → invite the grove.
      first_burn: {
        name: "First Bite",
        body: "Take your first kitchen bite of $BITE.",
      },
      first_buy: {
        name: "Fresh Pick",
        body: "Pick $BITE from the orchard at least once.",
      },
      hold_1m: {
        name: "Bushel",
        body: "Keep over 1M $BITE in hand.",
      },
      hold_10m: {
        name: "Laden Bough",
        body: "Keep over 10M $BITE — a branch heavy with fruit.",
      },
      hold_25m: {
        name: "Rootstock",
        body: "Keep over 25M $BITE — planted deep.",
      },
      burn_1m: {
        name: "Past the Skin",
        body: "Burn over 1M $BITE — into the flesh.",
      },
      burn_10m: {
        name: "Corebound",
        body: "Burn over 10M $BITE — closing on the core.",
      },
      burn_25m: {
        name: "To the Core",
        body: "Burn over 25M $BITE — eaten through.",
      },
      referrals: {
        name: "Windfall",
        body: "Earn an on-chain referral payout when someone you invite swaps at least $25 and burns at least $5 in-app.",
      },
    },
    referrals: {
      eyebrow: "Referrals",
      headline: "Invite the orchard.",
      body: "Share your link. When they connect, they bind you on-chain. Once their in-app swaps total at least $25 and they burn at least $5, you earn a fixed $BITE payout from escrow.",
      linkLabel: "Your link",
      copyLink: "Copy link",
      copied: "Copied.",
      shareText:
        "Take a bite with me and share a pot of apple stock!",
      countLabel: "Paid referrals",
      earningsLabel: "Earnings",
      rewardLabel: "Payout",
      rewardAmount: (n: string) => `${n} $BITE`,
      stubZero: "0",
      needWallet: "Connect a wallet to bind a pending invite on-chain.",
      pendingNote: (short: string) =>
        `Pending invite from ${short} — confirm bind in your wallet.`,
      boundNote: (short: string) => `Bound on-chain to ${short}.`,
      binding: "Confirm bind in your wallet…",
      bindCta: "Bind referrer",
      bindSuccess: "Referrer bound on-chain.",
      selfBlocked: "You can’t refer yourself.",
      escrowOffline: "Referral escrow is unavailable right now.",
    },
  },

  /** Thin home banner for referees arriving via ?ref= / bound invite. */
  referralChecklist: {
    headline: "Someone sent you into the grove.",
    body: "Swap at least $25 total and burn at least $5 to count — then they earn their Windfall.",
    connect: "Connect wallet",
    connecting: "Connecting…",
    buy: "Swap $25+ total on bite.party",
    buyCta: "Trade",
    burn: "Burn via the kitchen",
    burnCta: "Bite",
    bindHint: "Confirm bind in your wallet to lock in who invited you.",
    bindCta: "Bind referrer",
    binding: "Confirm bind…",
    doneBuy: "Bought",
    doneBurn: "Burned",
  },

  invite: {
    eyebrow: "$BITE",
    title: "Take a bite with me.",
    description:
      "Take a bite with me and share a pot of apple stock!",
    cta: "Take a bite",
    home: "Return to bite.party",
  },

  finePrint: {
    chain: "Robinhood\n4663",
    standard: "ERC-20",
    pair: "AAPL",
    mechanism: "Burn on\nevery tx",
    phase: (act: SiteAct) => (act === 0 ? "Prologue" : `Act ${act} of 3`),
    burned: (pct: string) => `${pct}%`,
  },

  take: {
    headline: "Take a $BITE.",
    headlinePrologue: "Get ready for $BITE.",
    copyAddress: "Copy address →",
    copied: "Copied.",
    buy: "Buy on PONS",
    buySoon: "Mint soon",
    social: {
      twitter: "Twitter",
      telegram: "Telegram",
      chart: "Chart",
    },
  },

  swap: {
    title: "Swap",
    close: "Close",
    iframeTitle: "Uniswap swap",
    uniswapNote: "Buy $BITE with AAPL, USDG, or ETH · sell to AAPL",
    ponsNote: "Trade on pons",
    ponsBody:
      "Open pons to trade $BITE from your wallet.",
    deepLinkBody:
      "Buy $BITE with AAPL, USDG, WETH, or ETH on Robinhood Chain. Sell only to AAPL. Uniswap and pons stay available if this quote misses.",
    pairLabel: (aapl: string, bite: string) =>
      `Buy with AAPL / USDG / ETH → $BITE (${bite.slice(0, 6)}…${bite.slice(-4)}). Sell → AAPL (${aapl.slice(0, 6)}…${aapl.slice(-4)}).`,
    openUniswap: "Open Uniswap",
    openUniswapFallback: "Or try Uniswap AAPL → $BITE →",
    openPons: "Open pons →",
    youPay: "You pay",
    youReceive: "You receive",
    flip: "Switch direction",
    choosePayToken: "Pay with",
    quoting: "Quoting…",
    quoteFailed: "Couldn’t quote this size. Try Uniswap or pons.",
    invalidAmount: "Enter a valid amount.",
    slippage: (pct: number, feeLine?: string) =>
      feeLine
        ? `${pct}% slippage · ${feeLine} · Uniswap v4`
        : `${pct}% slippage · Uniswap v4`,
    balance: "Balance",
    insufficient: (symbol: string) => `Not enough ${symbol}`,
    cta: "Swap",
    connect: "Connect wallet",
    chooseWallet: "Choose a wallet",
    back: "Back",
    connecting: "Connecting…",
    eating: "Eating to the core…",
    switchNetwork: "Switch to Robinhood",
    approving: "Approve in wallet…",
    signing: "Sign permit…",
    swapping: "Confirm swap…",
    disconnect: "Disconnect",
    complete: "Swap submitted.",
    failed: "Swap didn’t go through. Try again, or use Uniswap / pons.",
  },

  digest: {
    label: "Kitchen surplus",
    none: "No surplus AAPL yet. Digest splits kitchen AAPL 50/50 into a $BITE burn and the prize pot — it never runs in the background.",
    ready: (amount: string) =>
      `${amount} AAPL ready. 50% buy+burn $BITE · 50% prize pot. Confirm in your wallet.`,
    cta: "Digest",
    connect: "Connect to digest",
    chooseWallet: "Choose a wallet",
    back: "Back",
    connecting: "Connecting…",
    switchNetwork: "Switch to Robinhood",
    pending: "Confirm digest…",
    complete: "Digested.",
    failed: "Digest didn’t go through. Try again.",
    racingOnly: "Digest is only available while the race is on.",
  },

  lp: {
    title: "Seed the pool",
    close: "Close",
    note: "1% $BITE / AAPL · Uniswap v4",
    body: "Two pots. Liquidity goes into a 1% BITE/AAPL pool (no hook). Keep-aside stays in this wallet — Uniswap does not stake $BITE, and those tokens never go into LP.",
    hookExplain:
      "The live Dexscreener pool is 0% fee with a custom hook. Uniswap LPs there collect nothing from volume — you cannot turn a fee on that pool. Seed below uses a separate 1% pool with no hook.",
    intoPool: "Into the pool",
    keepAside: "Keep aside",
    keepHint: "Stays in this wallet. Not LP’d. Still circulating.",
    matching: "Matching AAPL",
    quoting: "Sizing…",
    quoteFailed: "Couldn’t size this LP. Try a smaller amount.",
    invalidAmount: "Enter a valid amount.",
    slippage: (pct: number) => `${pct}% slippage · full range`,
    balance: "Balance",
    insufficient: (symbol: string) => `Not enough ${symbol}`,
    insufficientKeep: "Keep-aside plus pool amount exceeds your $BITE.",
    pots: "Circulating supply counts wallet-held $BITE only. Pool tokens leave circulating. Keep-aside does not.",
    cta: "Seed the pool",
    connect: "Connect wallet",
    chooseWallet: "Choose a wallet",
    back: "Back",
    connecting: "Connecting…",
    switchNetwork: "Switch to Robinhood",
    approving: "Approve in wallet…",
    signing: "Sign permit…",
    depositing: "Confirm liquidity…",
    disconnect: "Disconnect",
    complete: "Position submitted. Keep-aside never left your wallet.",
    failed: "LP didn’t go through. Try again.",
    keepOnly: "Keep-aside does not send a transaction.",
    feeTitle: "Fee estimate",
    feeDisclaimer: "Estimate — not a promise.",
    feeShare: (share: string, bite: string, aapl: string) =>
      `If you seed ${bite} $BITE (~${aapl} AAPL), your share of the pool is ${share}.`,
    feeTake: (fee: string, share: string) =>
      `LP fee ${fee}. At your share, you earn ${fee} × ${share} of this pool’s swap volume.`,
    feeDaily: (usd: string) => `At recent volume that’s about ${usd} / day.`,
    feeZeroFee:
      "Uniswap lists a 0% fee for this pool, so LPs collect nothing from volume.",
    feeNoVolume:
      "Uniswap doesn’t report volume on this 1% pool yet, so we can’t project $/day. LPs still earn 1% of swaps that route here.",
    feeThin:
      "Recent volume is too thin to project daily fees. This pool may be small.",
    feeHook:
      "The live 0% pool’s hook can run extra swap/add-liquidity logic for its owner. That is not Uniswap LP APR, and claim_fees on that pool has been 0.",
    feeLoading: "Estimating share…",
    feeNeedAmount: "Enter an amount into the pool to estimate fees.",
    feeTierLabel: (fee: string) => `${fee} LP fee`,
    positionsTitle: "Your positions",
    positionsHint:
      "Uncollected $BITE and AAPL from your LP NFT on this pair. Keep-aside wallet $BITE is not a position and cannot be claimed here. Claiming fees does not withdraw liquidity. 0% positions earn no swap fees.",
    positionsEmpty: "No LP position on this pool yet.",
    positionsLoading: "Looking up positions…",
    uncollected: "Uncollected fees",
    claim: "Claim fees",
    claiming: "Confirm claim…",
    claimComplete: "Fees claimed.",
    claimNone: "Nothing to claim yet.",
    remove: "Remove from pool",
    removing: "Confirm withdrawal…",
    removeHint: "Withdraws liquidity. Separate from claiming fees.",
    removeComplete: "Liquidity withdrawn.",
    positionLabel: (id: string, fee: string) => `Position #${id} · ${fee}`,
  },

  footer: {
    disclaimer:
      "$BITE is a deflationary memecoin on Robinhood Chain. Every transaction burns supply. That is not financial advice. That is fruit.",
    privacy: "Privacy",
    terms: "Terms",
    colophon: `$BITE × AAPL · Robinhood Chain · ${CHAIN_ID}`,
  },

  toasts: {
    loading: "Loading...",
    raceLive: "The race is live. Tap the apple to eat.",
    burned: (n: string, pct: string) =>
      `You burned ${n} $BITE. ${pct}% to the core.`,
    skin: "The skin is breaking.",
    quarter: "Quarter eaten. The core is showing.",
    almost: "Almost there. Ten percent to go.",
    onePercent: "One percent. The whole orchard is watching.",
    core: "🔥 Core reached. Payout incoming.",
    rot: "🪱 The apple has rotted. Farmer paid.",
    eaterRank: (n: number) => `You're eater #${n}.`,
    comeBack: "Come back hungry.",
    previewNibble: "A quiet nibble. Launch the kitchen for real burns.",
  },

  messages: {
    preview:
      "Preview — launch $BITE on pons vs AAPL, then set NEXT_PUBLIC_BITE_TOKEN.",
    prologue:
      "Prologue — $BITE is not live yet. Set NEXT_PUBLIC_BITE_TOKEN (and clear NEXT_PUBLIC_SITE_ACT=0) to enter Act I.",
    kitchenWire:
      "Token is set. Wire AppleKitchen and the indexer will replace demo eaters with live burns and trades.",
    racing: (pct: string) =>
      `The race is live. ${pct}% eaten. Tap the apple to eat.`,
    core: "🔥 Core reached. The pot pays eaters.",
    rot: "🪱 The apple has rotted. The farmer collects.",
    liveFailed: (err: string) =>
      `Live read failed — showing preview numbers. ${err}`,
  },

  scene: {
    proceduralNote:
      "Procedural frames — bake Eydeet glTFs into /public/apple/frames/",
  },
} as const;

export const socialLinks = {
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL ?? "https://x.com/biteparty_",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "https://t.me/biteparty",
  chart: process.env.NEXT_PUBLIC_CHART_URL ?? PONS_TOKEN_URL,
};

export function contractAddressDisplay(): string {
  return BITE_TOKEN ?? "Deploy pending";
}

export function formatTokenAmount(wei: string, digits = 0): string {
  try {
    const n = Number(formatEther(BigInt(wei)));
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });
  } catch {
    return "0";
  }
}

export function formatDeadline(unix: number): string {
  try {
    return new Date(unix * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function heroTagline(
  act: SiteAct,
  racePhase: "racing" | "core" | "rot" | "preview",
): string {
  if (racePhase === "core") return copy.hero.tagline.core;
  if (racePhase === "rot") return copy.hero.tagline.rot;
  return copy.hero.tagline[act];
}

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
