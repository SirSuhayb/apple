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
    badge: {
      preparing: "Preparing",
      live: "Live",
      racing: "Racing",
    },
  },

  phases: {
    labels: [
      "Finding the apple",
      "First bite",
      "To the core",
    ] as const,
    banners: {
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
      1: "Finding the right apple.",
      2: "Eat it to the core.",
      3: "Eat it to the core.",
      core: "They ate it to the core.",
      rot: "The apple has rotted.",
    } as const,
    /** Short stake line under the Act I tagline */
    support: {
      1: "Eat to the core before time runs out — winners split the pot.",
    } as const,
    ctaPrimary: "Trade on bite.party",
    ctaSecondary: {
      1: "The game ↓",
      2: "How eating works ↓",
      3: "How eating works ↓",
    } as const,
    appleLabel: "Tap the apple.",
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
      1: ["Every transaction", "will take a bite."],
      racing: ["Every transaction", "takes a bite."],
    } as const,
    body: {
      1: "When the burn contract goes live in Act II, every buy, sell, and transfer will burn supply. Right now, you're accumulating. The race hasn't started.",
      racing:
        "Buy. Sell. Transfer. Every time $BITE moves, supply is burned forever. The apple gets smaller. Your share gets bigger.",
    },
  },

  how: {
    intro: ["A few ways", "$BITE gets smaller."],
    comingAct2: "Coming in Act II",
    items: [
      {
        icon: "↔",
        title: "Trade.",
        body: "Buys and sells both burn supply. Selling chews harder — a larger cut on the way out.",
        lockInAct1: false,
      },
      {
        icon: "👆",
        title: "Tap.",
        body: "The only real burn. Destroy your $BITE directly and push toward the core.",
        lockInAct1: true,
      },
      {
        icon: "◐",
        title: "Digest.",
        body: "Creator fees split fifty-fifty. Half buys and burns. Half fills the prize pot.",
        lockInAct1: true,
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
    intro: ["Who", "ate the most."],
    columns: ["Rank", "Eater", "Burned", "Buys", "Sells"] as const,
    rowMeta: (burned: string, buys: string, sells: string) =>
      `burned ${burned} · ${buys} buys · ${sells} sells`,
    empty: "No bites yet. Be first.",
    emptyHint: "The leaderboard activates when the race begins in Act II.",
  },

  tap: {
    eyebrow: "Tap the apple",
    headline: "The only real burn.",
    body: "Trades write the tape — they move the price and burn a little. Tapping destroys your $BITE permanently and pushes the whole race toward the core.",
    cta: "Burn $BITE",
    ctaLocked: "Burns open in Act II. Accumulate now.",
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
      completePoints: (points: string) => `+${points} eater points`,
      completeProgress: (pct: string) => `${pct}% of the apple eaten`,
      done: "Done",
      demoNote:
        "Preview mode — no chain required. Wire kitchen + token for live burns.",
    },
    dayOne: {
      note: "Day one — watch the apple eaten to the core. Burns unlock when the kitchen is live.",
    },
  },

  finePrint: {
    chain: "Robinhood\n4663",
    standard: "ERC-20",
    pair: "AAPL",
    mechanism: "Burn on\nevery tx",
    phase: (act: SiteAct) => `Act ${act} of 3`,
    burned: (pct: string) => `${pct}%`,
  },

  take: {
    headline: "Take a $BITE.",
    copyAddress: "Copy address →",
    copied: "Copied.",
    buy: "Buy on PONS",
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
    uniswapNote: "Preview — ETH ↔ USDC on Ethereum",
    ponsNote: "Trade on pons",
    ponsBody:
      "Open pons to trade $BITE from your wallet.",
    deepLinkBody:
      "Open Uniswap to swap ETH → USDC. In-page embed is available after Uniswap allowlists this site’s origin.",
    pairLabel: (usdc: string) =>
      `Demo pair: ETH → USDC (${usdc.slice(0, 6)}…${usdc.slice(-4)}).`,
    openUniswap: "Open Uniswap",
    openUniswapFallback: "Or try Uniswap ETH ↔ USDC →",
    openPons: "Open pons →",
  },

  footer: {
    disclaimer:
      "$BITE is a deflationary memecoin on Robinhood Chain. Every transaction burns supply. That is not financial advice. That is fruit.",
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
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL ?? "https://x.com",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "https://t.me",
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
