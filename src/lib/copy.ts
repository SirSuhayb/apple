import { formatEther } from "viem";
import {
  JUICE_TOKEN,
  CHAIN_ID,
  SWAP_OPEN_URL,
} from "./config";
import type { SiteAct } from "./phase";

/** Central site copy — juice/revnet rebrand on Base */

export const copy = {
  meta: {
    title: "$JUICE — Squeeze every drop.",
    description:
      "A revnet-backed token on Base. Every transaction squeezes supply through the press. Seeds grow into containers of juice. Powered by Juicebox V6.",
  },

  brand: "$JUICE",
  tagline: "Squeeze every drop.",

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
      racing: "Pressing",
    },
  },

  phases: {
    prologue: "Prologue",
    labels: [
      "Loading the press",
      "First squeeze",
      "To the last drop",
    ] as const,
    banners: {
      prologue:
        "The grove is closed. $JUICE presses soon — check back when trading opens.",
      act1: "The grove is being prepared. Trading is live — squeezes begin in Act II.",
      earlyEater:
        "🍊 EARLY SQUEEZER BONUS — Squeezes in the first 72 hours count 2× toward your leaderboard rank.",
      earlyEaterRemaining: (remaining: string) =>
        `🍊 EARLY SQUEEZER BONUS — ${remaining} remaining.`,
      urgency: (pct: string, days: string) =>
        `🍊 ${pct}% squeezed. ${days} days left. The whole grove is watching.`,
      browning: "The fruit is drying.",
      minutes: "Minutes remain.",
      core: "🍊 Last drop squeezed. Payouts processing.",
      rot: "🪱 Deadline passed. The grower collects.",
    },
  },

  hero: {
    tagline: {
      0: "Before the first squeeze.",
      1: "Loading the press.",
      2: "Squeeze every drop.",
      3: "Squeeze every drop.",
      core: "They squeezed every drop.",
      rot: "The fruit has dried up.",
    } as const,
    support: {
      0: "Squeeze to the last drop before time runs out — winners split the pot. Lose, and the grower takes it.",
      1: "Squeeze to the last drop before time runs out — winners split the pot.",
    } as const,
    ctaPrimary: "Trade on juice.party",
    ctaBuyThenBite: "Buy then squeeze",
    ctaFirstBite: "Take a first squeeze",
    ctaBurn: "Squeeze $JUICE",
    ctaTradeSecondary: "Trade",
    ctaSeed: "Seed the pool",
    ctaPrimarySoon: "Press soon",
    ctaSecondary: {
      0: "The game ↓",
      1: "The game ↓",
      2: "How pressing works ↓",
      3: "How pressing works ↓",
    } as const,
    eaterCount: (n: number) =>
      n === 1 ? "1 has squeezed." : `${n} have squeezed.`,
    appleLabel: "Tap the press.",
    sticker: {
      kicker: "$JUICE",
      action: "Tap the press",
      detail: "to squeeze $JUICE",
    },
  },

  game: {
    eyebrow: "The game",
    headline: "The game is simple—squeeze the fruit.",
    body: "Buy. Sell. Transfer. Every time $JUICE moves, supply flows through the press. The fruit gets lighter. Your share gets richer. Revenue backs the treasury through the revnet.",
  },

  line: {
    headline: {
      0: ["Every transaction", "will squeeze the press."],
      1: ["Every transaction", "will squeeze the press."],
      racing: ["Every transaction", "squeezes the press."],
    } as const,
    body: {
      0: "When $JUICE launches, every buy, sell, and transfer will squeeze supply through the press. Right now the grove is quiet.",
      1: "When the press goes live in Act II, every trade squeezes supply. Right now, you're accumulating.",
      racing:
        "Buy. Sell. Transfer. Every time $JUICE moves, supply is squeezed through the press. The fruit gets lighter. Your container fills up.",
    },
  },

  how: {
    intro: "How to press the fruit",
    comingAct1: "Coming in Act I",
    comingAct2: "Coming in Act II",
    items: [
      {
        icon: "↔",
        title: "Trade.",
        body: "Buys and sells both squeeze supply. Revenue flows through the revnet treasury on Base.",
        lockUntilAct: 1 as const,
      },
      {
        icon: "🍊",
        title: "Squeeze.",
        body: "The real press. Destroy your $JUICE directly and push toward the last drop. Seeds earn for every squeeze.",
        lockUntilAct: 2 as const,
      },
      {
        icon: "◐",
        title: "Digest.",
        body: "Revenue splits through the revnet. Half squeezes more $JUICE. Half fills the prize pot.",
        lockUntilAct: 2 as const,
      },
    ],
  },

  wager: {
    eyebrow: "The wager",
    headline: ["Half the supply.", "One deadline. One grower."],
    body: "Squeeze 50% of the supply through the press before the deadline. Reach the last drop and the prize pot pays squeezers. Miss it, and the fruit dries. Only the grower is paid.",
    clarifier:
      "The grower is the deployer. The squeezers are you. This is not a metaphor. It is fruit.",
  },

  decay: {
    bannerFresh: "The fruit is ripe.",
    bannerRotting: "The fruit is drying.",
    statusFresh: "Ripe",
    statusRotting: "Drying",
    tooltipLabel: "Ripe or Dry",
    modalTitle: "Ripe or Dry",
    modalPrev: "Back",
    modalNext: "Next",
    modalDone: "Done",
    slides: [
      {
        title: "Keep the fruit ripe",
        body: [
          "When the market is active, the fruit stays ripe to squeeze. Frequent activity keeps the press turning.",
        ],
      },
      {
        title: "Or the fruit dries over time",
        body: [
          "The fruit dries when the market is quiet. Low volume and soft prices let the pulp harden.",
        ],
      },
      {
        title: "The floor rises every week",
        body: [
          "The ATH of each week determines the floor of the next week. Below the floor, the fruit dries.",
        ],
      },
    ] as const,
    floorSlideBody: (thisWeek: string, nextWeek: string) =>
      `The ATH of each week determines the floor of the next week. This week's floor is ${thisWeek}. Next week's is ${nextWeek}. Below the floor, the fruit dries.`,
    eatenLabel: "Squeezed",
    eatenPct: (pct: string) => `${pct}% squeezed`,
    qaChip: (n: string) => `QA decay ${n} — localhost only`,
  },

  metaWager: {
    eyebrow: "The meta wager",
    emptyTitle: "Last drop or dry?",
    emptyBody:
      "The meta wager opens when squeezing hits 10%. Pick a side — will the squeezers reach the last drop, or will the fruit dry?",
    opensAt: "Opens at 10% squeezed",
    thresholdProgress: (pct: string) => `${pct}% of 10% threshold`,
    liveLead: "The worms are betting against you.",
    liveCta: "Pick a side. Stake your $JUICE.",
    betCore: "Bet LAST DROP",
    betRot: "Bet DRY",
    infoTitle: "The Meta Wager",
    infoBody:
      "A side bet on the outcome. Stake $JUICE on LAST DROP (50% squeezed before deadline) or DRY (deadline first). Odds shift with every wager. Winners split the pot proportionally.",
  },

  core: {
    eyebrow: "To the last drop",
    countdown: ["days", "hours", "min", "sec"] as const,
    remaining: (n: string) => `${n} remaining`,
    burned: (n: string) => `${n} squeezed`,
    notStarted: "The press hasn't started.",
  },

  pairing: {
    eyebrow: "Why Base × Juicebox",
    headline: [
      "Revenue-backed juice,",
      "pressed on Base.",
    ],
    body: "Juicebox V6 revnets give $JUICE a real treasury. Every payment mints tokens. Every revenue deposit backs holders. Cash-outs are backed by surplus. All onchain, all transparent.",
    then: "$JUICE is backed by a revnet on Base. Revenue flows in, token supply is programmatic, and holders can cash out against real surplus.",
  },

  eaters: {
    intro: ["Who", "traded the most."],
    introAct2: ["Who", "squeezed the most."],
    prizeEligible: "Only squeezers are eligible for the prize pool.",
    columns: ["Rank", "Squeezer", "Squeezed", "Buys", "Sells"] as const,
    rowMeta: (burned: string, buys: string, sells: string) =>
      `squeezed ${burned} · ${buys} buys · ${sells} sells`,
    empty: "No traders yet. Be first.",
    noBurners: "No squeezes yet. Squeeze $JUICE to take a spot.",
    emptyHint: "The leaderboard activates when the press begins in Act II.",
    emptyHintPrologue: "The leaderboard waits for the first squeezers.",
  },

  leaderboard: {
    title: "Leaderboard",
    headline: "Every trade counts.",
    headlineAct1: "Accumulate. Hold. Squeeze. Climb.",
    subtitle:
      "Points from buys, sells, and squeezes. Wagers are a side bet — they count a little.",
    subtitleAct1:
      "Points from buying, holding, and squeezing $JUICE. Act I accumulation carries into Act II.",
    columns: ["Rank", "Trader", "Points", "Trades"] as const,
    pts: "pts",
    trades: (n: number) => `${n} trade${n === 1 ? "" : "s"}`,
    burnsCount: (n: number) => `${n} squeeze${n === 1 ? "" : "s"}`,
    burnedAmount: (amount: string) => `${amount} squeezed`,
    wageredAmount: (amount: string) => `${amount} wagered`,
    eatenPct: (pct: string) => `${pct} of fruit`,
    ofApple: "of fruit",
    inThePot: "In the pot",
    notInThePot: "Not in the pot",
    homeUnrankedHint:
      "This board is squeezers only. Squeeze $JUICE to take a spot.",
    topEater: "Top squeezer",
    topPlayer: "Top player",
    topTrader: "Top trader",
    buys: "Buys",
    sells: "Sells",
    burns: "Squeezes",
    totalTrades: "Total trades",
    totalPoints: "Total points",
    empty: "No trades yet.",
    emptyHint: "The leaderboard populates when trading begins.",
    emptyHintAct1:
      "All wallets trading or holding $JUICE since launch appear here.",
    viewAll: "Show full leaderboard",
    viewAllHint:
      "Home board is squeezers only. The full list ranks every wallet by points.",
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
      "This wallet isn't in the ranked list — no points yet, below the threshold, or a contract. Trade or squeeze $JUICE from an eligible wallet to appear.",
    belowThreshold: "Not ranked yet.",
    belowThresholdHint:
      "This wallet is on file but has no ranking points. Only wallets with points above zero are ranked.",
    ineligibleYou: "Not eligible to win.",
    ineligibleYouHint:
      "This wallet is marked ineligible — it can appear on the board but cannot take the pot.",
    top10Spot: (amount: string) =>
      `Squeeze ${amount} $JUICE to secure a top 10 spot`,
    searchPlaceholder: "Search by address",
    searchEmpty: "No wallets match that address.",
    searchClear: "Clear",
    scoring: {
      eyebrow: "How scoring works",
      buy: "Buy — 0.01 pts per $JUICE (DEX)",
      buyNative:
        "Buy on juice.party — 0.02 pts per $JUICE (2× · feeds the treasury)",
      sell: "Sell — 0.015 pts per $JUICE (1.5× buy)",
      tap: "Squeeze — 1 pt per $JUICE (2× in the early-squeezer window)",
      wager: "Wager — 0.001 pts per $JUICE staked on entry (side bet, not a squeeze)",
      accum: "Act I — Accumulation: +0.01 pt per whole $JUICE gained",
      hold: "Act I — Holding: 100 $JUICE held for 1 hour = 0.01 pt",
      burn: "Act II — Squeezes: press scores 1 pt per $JUICE",
      tapFloor:
        "Every press squeeze scores. Telegram still only posts squeezes over $50.",
      tradesAct1:
        "Trades — buys since launch count (all wallets)",
      devNote:
        "Dev wallets appear on the board with a Dev badge and are ineligible to win.",
      eligibility:
        "Only squeezers are eligible for the prize pool. A trade without a squeeze does not get you in.",
    },
    back: "← Back",
    shareRank: "Share your rank",
  },

  tap: {
    eyebrow: "Tap the press",
    headline: "The only real squeeze.",
    body: "Trades write the tape — they move the price and squeeze a little. Pressing destroys your $JUICE permanently and pushes the whole race toward the last drop. Seeds grow with every squeeze.",
    cta: "Squeeze $JUICE",
    ctaLocked: "Squeezes open in Act II. Accumulate now.",
    ctaLockedPrologue: "Squeezes open after press. Stay thirsty.",
    raceOver: "The press is done.",
    connect: "Connect wallet",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    burn: (amount: string) => `Squeeze ${amount} $JUICE`,
    burning: "Pressing…",
    kitchenMissing: "Press not deployed yet",
    demoBurn: "Simulate squeeze (preview)",
    confirm: (amount: string) => `You squeezed ${amount} $JUICE. Gone forever.`,
    approve: "Approve",
    amountPlaceholder: "JUICE amount",
    presets: [
      { label: "Sip", amount: "100" },
      { label: "Glass", amount: "1000" },
      { label: "Pitcher", amount: "5000" },
    ] as const,
    modal: {
      close: "Close",
      stepConnect: "Connect your wallet to squeeze.",
      stepAmount: "How much do you want to press?",
      stepBurning: "Confirm in your wallet…",
      completeTitle: "Juice squeezed.",
      completePoints: (points: string) => `+${points} pts`,
      completeProgress: (pct: string) => `${pct}% of the fruit squeezed`,
      done: "Done",
      demoNote:
        "Preview mode — no chain required. Wire revnet + token for live squeezes.",
      share: "Share this squeeze",
    },
    dayOne: {
      note: "Day one — watch the fruit squeezed to the last drop. Squeezes unlock when the press is live.",
      notePrologue:
        "Watch the fruit. Trading opens when $JUICE goes live on Base — check back soon.",
    },
  },

  share: {
    eyebrow: "$JUICE",
    postX: "Post on X",
    share: "Share",
    copy: "Copy text",
    copied: "Copied.",
    takeSpot: "Take their spot",
    eatenBoast: (pct: string) => `I squeezed ${pct} of the fruit`,
    pitch:
      "the game is simple — squeeze more, rank higher, earn more when the pot pays out.",
    home: "Return to juice.party",
    fallback:
      "i just squeezed some $juice and filled my container.",
    burn: (_amount: string, _rank?: number) =>
      "I just squeezed $JUICE and climbed the leaderboard. the game is simple — squeeze more, rank higher, earn more when the pot pays out.",
    rank: (_rank: number) =>
      "i just squeezed some $juice and filled my container.",
    ogBurnTitle: (amount: string, rank?: number) =>
      rank
        ? `I just squeezed ${amount} $JUICE · #${rank}`
        : `I just squeezed ${amount} $JUICE`,
    ogRankTitle: (rank: number) => `I'm #${rank} on $JUICE`,
  },

  profile: {
    title: "Profile",
    headline: "Your juice.",
    headlinePublic: "Squeezer profile.",
    subtitle: "Rank, stats, and titles from the board — no new contracts.",
    back: "← Back",
    connectHint: "Connect a wallet to open your profile.",
    connectCta: "Connect wallet",
    viewPublic: "Public profile",
    notOnBoard: "Not on the board yet.",
    notOnBoardHint:
      "No scored trades or squeezes for this wallet yet. Trade or squeeze $JUICE to appear.",
    rankLabel: "Rank",
    scoreLabel: "Score",
    burnedLabel: "Squeezed",
    buysLabel: "Buys",
    sellsLabel: "Sells",
    holdLabel: "Holding",
    holdLoading: "Reading wallet…",
    holdUnavailable:
      "Hold titles need a live wallet balance — available on your own profile.",
    titlesEyebrow: "Titles",
    titlesHeadline: "Unlocked so far.",
    titlesEmpty: "No titles yet — take a first squeeze.",
    titlesPickHint: "Tap an unlocked title to use it on your share.",
    titlesPickNone: "Share without a title until you unlock one.",
    forShare: "On share",
    useOnShare: "Use on share",
    locked: "Locked",
    unlocked: "Unlocked",
    unavailable: "Unavailable",
    comingSoon: "Coming soon",
    titles: {
      first_burn: {
        name: "First Squeeze",
        body: "Take your first press squeeze of $JUICE.",
      },
      first_buy: {
        name: "Fresh Pick",
        body: "Pick $JUICE from the grove at least once.",
      },
      hold_1m: {
        name: "Juice Box",
        body: "Keep over 1M $JUICE in hand.",
      },
      hold_10m: {
        name: "Bottle",
        body: "Keep over 10M $JUICE — filling up.",
      },
      hold_25m: {
        name: "Mason Jar",
        body: "Keep over 25M $JUICE — packed and sealed.",
      },
      burn_1m: {
        name: "Past the Rind",
        body: "Squeeze over 1M $JUICE — into the pulp.",
      },
      burn_10m: {
        name: "Pulped",
        body: "Squeeze over 10M $JUICE — nothing but juice left.",
      },
      burn_25m: {
        name: "Last Drop",
        body: "Squeeze over 25M $JUICE — wrung dry.",
      },
      referrals: {
        name: "Windfall",
        body: "Earn 250,000 $JUICE when someone you invite swaps at least $25 and squeezes at least $5 in-app. Limited seats in the grove.",
      },
    },
    referrals: {
      eyebrow: "Referrals",
      headline: "Invite the grove.",
      body: "Share your link. When they connect, they bind you on-chain. Once their in-app swaps total at least $25 and they squeeze at least $5, you earn 250,000 $JUICE from escrow — while seats last.",
      linkLabel: "Your link",
      copyLink: "Copy link",
      copied: "Copied.",
      shareText:
        "Take a squeeze with me and fill your container!",
      countLabel: "Paid referrals",
      earningsLabel: "Earnings",
      rewardLabel: "Payout",
      rewardAmount: (n: string) => `${n} $JUICE`,
      remainingLabel: "Windfalls left",
      remainingCount: (n: number) =>
        n === 1 ? "1 Windfall left" : `${n} Windfalls left`,
      remainingEmpty: "Escrow empty — no Windfalls left.",
      stubZero: "0",
      needWallet: "Connect a wallet to bind a pending invite on-chain.",
      pendingNote: (short: string) =>
        `Pending invite from ${short} — confirm bind in your wallet.`,
      boundNote: (short: string) => `Bound on-chain to ${short}.`,
      binding: "Confirm bind in your wallet…",
      bindCta: "Bind referrer",
      bindSuccess: "Referrer bound on-chain.",
      selfBlocked: "You can't refer yourself.",
      escrowOffline: "Referral escrow is unavailable right now.",
    },
  },

  firstBiteQuest: {
    headline: "You've got $JUICE. Take a first squeeze.",
    body: "Tape doesn't pay the pot. Squeezing does — unlock First Squeeze.",
    cta: "Take a first squeeze",
  },

  referralChecklist: {
    headline: "Someone sent you into the grove.",
    body: "Swap at least $25 total and squeeze at least $5 to count — then they earn 250,000 $JUICE (Windfall).",
    connect: "Connect wallet",
    connecting: "Connecting…",
    buy: "Swap $25+ total on juice.party",
    buyCta: "Trade",
    burn: "Squeeze via the press",
    burnCta: "Squeeze",
    bindHint: "Confirm bind in your wallet to lock in who invited you.",
    bindCta: "Bind referrer",
    binding: "Confirm bind…",
    doneBuy: "Bought",
    doneBurn: "Squeezed",
  },

  claim: {
    title: "Claim desk",
    eyebrow: "Internal",
    notOpen: "Claim desk is not open yet.",
    about: "About $1 in ETH.",
    headline: "You can claim $1 in ETH.",
    amountLine: (eth: string, wei: string) => `${eth} ETH (${wei} wei) per claim.`,
    seatsLine: (n: string) => `${n} claims left that the contract can pay.`,
    connectHint: "Connect the wallet that is on the list.",
    connectCta: "Connect wallet",
    connecting: "Connecting…",
    wrongChain: "Switch to Base.",
    switchCta: "Switch network",
    reading: "Reading the claim desk…",
    notEligible: "This wallet is not on the list.",
    alreadyClaimed: "Already claimed.",
    nothingLeft: "Nothing left to claim.",
    claimCta: "Claim",
    claiming: "Confirm in your wallet…",
    claimed: "Claimed.",
    failed: "Claim failed.",
    readFailed: "Could not read the claim desk.",
    back: "← Back",
  },

  invite: {
    eyebrow: "$JUICE",
    title: "Squeeze with me.",
    description:
      "Squeeze with me and fill your container!",
    cta: "Start squeezing",
    home: "Return to juice.party",
  },

  finePrint: {
    chain: "Base\n8453",
    standard: "ERC-20",
    pair: "ETH",
    mechanism: "Squeeze on\nevery tx",
    phase: (act: SiteAct) => (act === 0 ? "Prologue" : `Act ${act} of 3`),
    burned: (pct: string) => `${pct}%`,
  },

  take: {
    headline: "Get some $JUICE.",
    headlinePrologue: "Get ready for $JUICE.",
    copyAddress: "Copy address →",
    copied: "Copied.",
    buy: "Buy $JUICE",
    buySoon: "Press soon",
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
    uniswapNote: "Buy $JUICE with ETH, USDC, or WETH on Base",
    nativeBonus:
      "Buys here score 2× on the board and feed the treasury pot.",
    ponsNote: "Trade on Uniswap",
    ponsBody:
      "Open Uniswap to trade $JUICE from your wallet.",
    deepLinkBody:
      "Buy $JUICE with ETH, USDC, or WETH on Base. Uniswap stays available as fallback.",
    pairLabel: (usdc: string, juice: string) =>
      `Buy with ETH / USDC / WETH → $JUICE (${juice.slice(0, 6)}…${juice.slice(-4)}). Sell → ETH.`,
    openUniswap: "Open Uniswap",
    openUniswapFallback: "Or try Uniswap ETH → $JUICE →",
    openPons: "Open Uniswap →",
    youPay: "You pay",
    youReceive: "You receive",
    flip: "Switch direction",
    choosePayToken: "Pay with",
    quoting: "Quoting…",
    quoteFailed: "Couldn't quote this size. Try Uniswap directly.",
    invalidAmount: "Enter a valid amount.",
    slippage: (pct: number, feeLine?: string) =>
      feeLine
        ? `${pct}% slippage · ${feeLine} · Uniswap on Base`
        : `${pct}% slippage · Uniswap on Base`,
    balance: "Balance",
    insufficient: (symbol: string) => `Not enough ${symbol}`,
    cta: "Swap",
    connect: "Connect wallet",
    chooseWallet: "Choose a wallet",
    back: "Back",
    connecting: "Connecting…",
    eating: "Squeezing to the last drop…",
    switchNetwork: "Switch to Base",
    approving: "Approve in wallet…",
    signing: "Sign permit…",
    swapping: "Confirm swap…",
    disconnect: "Disconnect",
    complete: "Swap submitted.",
    failed: "Swap didn't go through. Try again, or use Uniswap directly.",
  },

  digest: {
    label: "Treasury surplus",
    none: "No surplus yet. Digest splits treasury ETH 50/50 into a $JUICE squeeze and the prize pot.",
    ready: (amount: string) =>
      `${amount} ETH ready. 50% squeeze $JUICE · 50% prize pot. Confirm in your wallet.`,
    cta: "Digest",
    connect: "Connect to digest",
    chooseWallet: "Choose a wallet",
    back: "Back",
    connecting: "Connecting…",
    switchNetwork: "Switch to Base",
    pending: "Confirm digest…",
    complete: "Digested.",
    failed: "Digest didn't go through. Try again.",
    racingOnly: "Digest is only available while the press is on.",
  },

  lp: {
    title: "Seed the pool",
    close: "Close",
    note: "1% $JUICE / ETH · Uniswap on Base",
    body: "Two pots. Liquidity goes into a 1% JUICE/ETH pool. Keep-aside stays in this wallet.",
    hookExplain:
      "The revnet handles token issuance. This LP pool is separate from the revnet treasury.",
    intoPool: "Into the pool",
    keepAside: "Keep aside",
    keepHint: "Stays in this wallet. Not LP'd. Still circulating.",
    matching: "Matching ETH",
    quoting: "Sizing…",
    quoteFailed: "Couldn't size this LP. Try a smaller amount.",
    invalidAmount: "Enter a valid amount.",
    slippage: (pct: number) => `${pct}% slippage · full range`,
    balance: "Balance",
    insufficient: (symbol: string) => `Not enough ${symbol}`,
    insufficientKeep: "Keep-aside plus pool amount exceeds your $JUICE.",
    pots: "Circulating supply counts wallet-held $JUICE only. Pool tokens leave circulating. Keep-aside does not.",
    cta: "Seed the pool",
    connect: "Connect wallet",
    chooseWallet: "Choose a wallet",
    back: "Back",
    connecting: "Connecting…",
    switchNetwork: "Switch to Base",
    approving: "Approve in wallet…",
    signing: "Sign permit…",
    depositing: "Confirm liquidity…",
    disconnect: "Disconnect",
    complete: "Position submitted. Keep-aside never left your wallet.",
    failed: "LP didn't go through. Try again.",
    keepOnly: "Keep-aside does not send a transaction.",
    feeTitle: "Fee estimate",
    feeDisclaimer: "Estimate — not a promise.",
    feeShare: (share: string, juice: string, eth: string) =>
      `If you seed ${juice} $JUICE (~${eth} ETH), your share of the pool is ${share}.`,
    feeTake: (fee: string, share: string) =>
      `LP fee ${fee}. At your share, you earn ${fee} × ${share} of this pool's swap volume.`,
    feeDaily: (usd: string) => `At recent volume that's about ${usd} / day.`,
    feeZeroFee:
      "Uniswap lists a 0% fee for this pool, so LPs collect nothing from volume.",
    feeNoVolume:
      "Uniswap doesn't report volume on this pool yet, so we can't project $/day.",
    feeThin:
      "Recent volume is too thin to project daily fees.",
    feeHook:
      "The revnet may run extra logic on payments. LP fees are separate from revnet flows.",
    feeLoading: "Estimating share…",
    feeNeedAmount: "Enter an amount into the pool to estimate fees.",
    feeTierLabel: (fee: string) => `${fee} LP fee`,
    positionsTitle: "Your positions",
    positionsHint:
      "Uncollected $JUICE and ETH from your LP NFT on this pair.",
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

  /** Revnet-specific copy */
  revnet: {
    eyebrow: "Revnet Treasury",
    headline: "Backed by the press.",
    body: "Revenue flows through the Juicebox V6 revnet on Base. Payments mint $JUICE. Revenue deposits back existing holders. Cash-outs are backed by real surplus.",
    payTitle: "Pay the treasury",
    payBody: "Send ETH to mint $JUICE tokens from the revnet. The beneficiary receives project tokens based on the current issuance rate.",
    payCta: "Pay",
    addBalanceTitle: "Add to balance",
    addBalanceBody: "Deposit revenue that backs existing holders without minting new tokens. Increases the surplus available for cash-outs.",
    addBalanceCta: "Add to balance",
    cashOutTitle: "Cash out",
    cashOutBody: "Redeem your $JUICE tokens for a share of the treasury surplus. Cash-out value depends on supply, surplus, and the revnet's cash-out rules.",
    cashOutCta: "Cash out",
    surplusLabel: "Treasury surplus",
    tokenBalanceLabel: "Your $JUICE",
    notDeployed: "Revnet not deployed yet. Set NEXT_PUBLIC_REVNET_PROJECT_ID and NEXT_PUBLIC_JB_MULTI_TERMINAL.",
  },

  /** NFT container copy */
  nft: {
    eyebrow: "Containers",
    headline: "Seeds grow into containers.",
    body: "Your seeds fill containers of juice. Mint your container NFT on Base to claim your tier. Each container is an ERC-721 that proves your squeeze history.",
    mintCta: "Mint container",
    minting: "Minting…",
    minted: "Container minted.",
    notEligible: "Earn more seeds to unlock a container.",
    notDeployed: "Container NFTs coming soon.",
    tiers: {
      juiceBox: "Juice Box (4 oz)",
      bottle: "Bottle (8 oz)",
      masonJar: "Mason Jar (16 oz)",
      growler: "Growler (32 oz)",
    },
  },

  footer: {
    disclaimer:
      "$JUICE is a revnet-backed token on Base powered by Juicebox V6. Every transaction squeezes supply through the press. That is not financial advice. That is fruit.",
    privacy: "Privacy",
    terms: "Terms",
    colophon: `$JUICE × Revnet · Base · ${CHAIN_ID}`,
  },

  toasts: {
    loading: "Loading...",
    raceLive: "The press is live. Tap the press to squeeze.",
    burned: (n: string, pct: string) =>
      `You squeezed ${n} $JUICE. ${pct}% to the last drop.`,
    skin: "The rind is breaking.",
    quarter: "Quarter squeezed. The core is showing.",
    almost: "Almost there. Ten percent to go.",
    onePercent: "One percent. The whole grove is watching.",
    core: "🍊 Last drop reached. Payout incoming.",
    rot: "🪱 The fruit has dried. Grower paid.",
    eaterRank: (n: number) => `You're squeezer #${n}.`,
    comeBack: "Come back thirsty.",
    previewNibble: "A quiet sip. Launch the press for real squeezes.",
  },

  messages: {
    preview:
      "Preview — deploy the revnet on Base, then set NEXT_PUBLIC_JUICE_TOKEN.",
    prologue:
      "Prologue — $JUICE is not live yet. Set NEXT_PUBLIC_JUICE_TOKEN to enter Act I.",
    kitchenWire:
      "Token is set. Wire the revnet and the indexer will replace demo data with live trades and squeezes.",
    racing: (pct: string) =>
      `The press is live. ${pct}% squeezed. Tap to squeeze.`,
    core: "🍊 Last drop reached. The pot pays squeezers.",
    rot: "🪱 The fruit has dried. The grower collects.",
    liveFailed: (err: string) =>
      `Live read failed — showing preview numbers. ${err}`,
  },

  scene: {
    proceduralNote:
      "Procedural frames — bake fruit glTFs into /public/apple/frames/",
  },
} as const;

export const socialLinks = {
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL ?? "https://x.com/juiceparty_",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "https://t.me/juiceparty",
  chart: process.env.NEXT_PUBLIC_CHART_URL ?? SWAP_OPEN_URL,
};

export function contractAddressDisplay(): string {
  return JUICE_TOKEN && JUICE_TOKEN !== "0x0000000000000000000000000000000000000000"
    ? JUICE_TOKEN
    : "Deploy pending";
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
