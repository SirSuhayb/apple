import { socialLinks } from "./copy";

/** Copy for /challenge — $1M builder challenge (sample / editable). */

export const challengeCopy = {
  meta: {
    title: "$BITE Challenge — Build on the apple.",
    description:
      "A $1,000,000 builder challenge. Five winners. Ship something cool with the $BITE apple and APIs on Robinhood Chain.",
  },

  brand: "$BITE",
  badge: "Challenge",

  hero: {
    headline: "Build on the apple.",
    support:
      "One million dollars. Five winners. Use our apple, our race APIs, and the kitchen — ship something the orchard can’t ignore.",
    ctaPrimary: "Enter the challenge",
    ctaSecondary: "Read the brief ↓",
  },

  prizes: {
    eyebrow: "The purse",
    headline: "Five winners. One million.",
    support:
      "Prize amounts are denominated in USD value at payout. Escrow and claim mechanics publish before submissions close.",
    tiers: [
      { place: "1st", amount: "$400,000", note: "Grand prize" },
      { place: "2nd", amount: "$250,000", note: "Runner-up" },
      { place: "3rd", amount: "$175,000", note: "Third" },
      { place: "4th", amount: "$100,000", note: "Fourth" },
      { place: "5th", amount: "$75,000", note: "Fifth" },
    ] as const,
  },

  brief: {
    eyebrow: "The brief",
    headline: "Make something that bites.",
    support:
      "Clients, bots, games, viz, agents, tools — anything that uses the live apple and at least one $BITE surface.",
    must: [
      "Use the official apple asset (frames / stills).",
      "Call at least one live $BITE API or contract.",
      "Ship a public demo URL + 60-second video.",
      "Open-source the repo (or a reproducible build).",
    ] as const,
  },

  surfaces: {
    eyebrow: "Surfaces",
    headline: "Apple + APIs.",
    support: "Everything you need is already on bite.party.",
    items: [
      {
        title: "Race",
        path: "GET /api/race",
        body: "Progress, phase, deadline, burned supply, eaters snapshot.",
      },
      {
        title: "Leaderboard",
        path: "GET /api/leaderboard",
        body: "Live eater ranks, scoring mode, supply breakdown.",
      },
      {
        title: "Supply",
        path: "GET /api/supply",
        body: "Total and burnable supply for dashboards and bots.",
      },
      {
        title: "Circulating",
        path: "GET /api/circulating-supply",
        body: "Circulating supply for trackers and market tools.",
      },
      {
        title: "Apple",
        path: "/apple/frames · /apple/stills",
        body: "Stop-motion GLBs and PNG stills — the visual heart of $BITE.",
      },
      {
        title: "Kitchen",
        path: "AppleKitchen · bite / digest",
        body: "Onchain burn race on Robinhood Chain (4663).",
      },
    ] as const,
  },

  rules: {
    eyebrow: "Rules",
    headline: "Keep it real.",
    items: [
      "One primary submission per team (teams up to 4).",
      "Must work against live bite.party data — mocks alone don’t qualify.",
      "No phishing, fake official branding, or rug tooling.",
      "Judges may ask for a short live walkthrough of shortlisted work.",
      "By entering you grant $BITE non-exclusive rights to showcase your build.",
    ] as const,
  },

  judging: {
    eyebrow: "Judging",
    headline: "How we pick five.",
    support:
      "A small panel of judges scores every eligible entry. Scores publish with winners.",
    criteria: [
      {
        weight: "30",
        title: "Uses $BITE for real",
        body: "Apple asset plus at least one live API or contract. Fake mockups score near zero.",
      },
      {
        weight: "25",
        title: "Product quality",
        body: "Works on mobile, loads fast, clear UX, survives real chain data.",
      },
      {
        weight: "20",
        title: "Originality",
        body: "A new angle on the race — not a site clone.",
      },
      {
        weight: "15",
        title: "Impact",
        body: "Drives burns, awareness, retention, or useful orchard infra.",
      },
      {
        weight: "10",
        title: "Craft & openness",
        body: "Public repo, docs, reproducible build — clean brand use.",
      },
    ] as const,
  },

  timeline: {
    eyebrow: "Timeline",
    headline: "Dates to lock.",
    support: "Final dates drop with escrow. Sample window below.",
    steps: [
      { label: "Announce", detail: "Challenge page live · builder outreach" },
      { label: "Build", detail: "Open submissions · weekly spotlights" },
      { label: "Close", detail: "Demo + repo + video due" },
      { label: "Shortlist", detail: "Top entries · live or async pitch" },
      { label: "Winners", detail: "Five prizes · public scores" },
    ] as const,
  },

  findUs: {
    eyebrow: "Where builders are",
    headline: "TG · pons · X · Farcaster.",
    support:
      "We’re seeding builders on Telegram, pons, X, and Farcaster. Jump in where you already hang out.",
    places: [
      { name: "Telegram", href: socialLinks.telegram, note: "Primary channel" },
      { name: "X", href: socialLinks.twitter, note: "Announcements" },
      {
        name: "pons",
        href: socialLinks.chart,
        note: "Trade & discover $BITE",
      },
      {
        name: "Farcaster",
        href: process.env.NEXT_PUBLIC_FARCASTER_URL ?? "https://warpcast.com/",
        note: "Casts & casts-about-builds",
      },
    ] as const,
  },

  submit: {
    eyebrow: "Enter",
    headline: "Ready to ship?",
    support:
      "Send your demo, repo, and 60-second video via Telegram. We’ll confirm receipt in-channel.",
    cta: "Submit on Telegram",
    fine: "Sample page — escrow address and exact dates will be published before the build window opens.",
  },

  nav: {
    home: "Home",
    enter: "Enter",
  },
} as const;
