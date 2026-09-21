import { readFile } from "fs/promises";
import path from "path";
import {
  SWAP_KITCHEN_PORTION_BIPS,
  SWAP_TOKENS,
  type BuySide,
  type SwapSide,
} from "./uniswap-trade";

export type NativeSwapWindow = {
  swapCount: number;
  uniqueWallets: number;
  feeBiteRaw: number;
  feeAaplRaw: number;
  buyCount: number;
  sellCount: number;
  clientConfirmed: number;
  feeBite?: number;
  feeAapl?: number;
  estVolumeBite?: number;
  estVolumeAapl?: number;
  feeBips?: number;
  feeUsd?: number | null;
  estVolumeUsd?: number | null;
};

export type NativeSwapStats = {
  definition: string;
  mode: string;
  cursor: number;
  updatedAt: string;
  allTime: NativeSwapWindow;
  h24: NativeSwapWindow;
  limits: string;
};

const emptyWindow = (): NativeSwapWindow => ({
  swapCount: 0,
  uniqueWallets: 0,
  feeBiteRaw: 0,
  feeAaplRaw: 0,
  buyCount: 0,
  sellCount: 0,
  clientConfirmed: 0,
  feeBite: 0,
  feeAapl: 0,
  estVolumeBite: 0,
  estVolumeAapl: 0,
  feeBips: SWAP_KITCHEN_PORTION_BIPS,
  feeUsd: null,
  estVolumeUsd: null,
});

export function emptyNativeSwapStats(): NativeSwapStats {
  return {
    definition:
      "Native swap = bite.party SwapModal / Trading API path with integratorFees → kitchen. Not all-chain DEX volume.",
    mode: "unavailable",
    cursor: 0,
    updatedAt: new Date().toISOString(),
    allTime: emptyWindow(),
    h24: emptyWindow(),
    limits: "Bot swap index not available yet.",
  };
}

function asWindow(raw: unknown): NativeSwapWindow {
  if (!raw || typeof raw !== "object") return emptyWindow();
  const o = raw as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(o[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    swapCount: Math.max(0, Math.floor(n("swapCount"))),
    uniqueWallets: Math.max(0, Math.floor(n("uniqueWallets"))),
    feeBiteRaw: Math.max(0, Math.floor(n("feeBiteRaw"))),
    feeAaplRaw: Math.max(0, Math.floor(n("feeAaplRaw"))),
    buyCount: Math.max(0, Math.floor(n("buyCount"))),
    sellCount: Math.max(0, Math.floor(n("sellCount"))),
    clientConfirmed: Math.max(0, Math.floor(n("clientConfirmed"))),
    feeBite: n("feeBite"),
    feeAapl: n("feeAapl"),
    estVolumeBite: n("estVolumeBite"),
    estVolumeAapl: n("estVolumeAapl"),
    feeBips: n("feeBips") || SWAP_KITCHEN_PORTION_BIPS,
    feeUsd: o.feeUsd == null ? null : n("feeUsd"),
    estVolumeUsd: o.estVolumeUsd == null ? null : n("estVolumeUsd"),
  };
}

export function parseNativeSwapStats(raw: unknown): NativeSwapStats | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.allTime && !o.h24) return null;
  return {
    definition: typeof o.definition === "string" ? o.definition : emptyNativeSwapStats().definition,
    mode: typeof o.mode === "string" ? o.mode : "unknown",
    cursor: Math.max(0, Math.floor(Number(o.cursor) || 0)),
    updatedAt:
      typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    allTime: asWindow(o.allTime),
    h24: asWindow(o.h24),
    limits: typeof o.limits === "string" ? o.limits : "",
  };
}

async function fetchRemoteJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Prefer bot HTTP /swap-stats.json (via BITE_SWAP_STATS_URL or derived from
 * BITE_LEADERBOARD_URL), then leaderboard.swapStats, then local bot state.
 */
export async function fetchNativeSwapStats(): Promise<NativeSwapStats> {
  const explicit = process.env.BITE_SWAP_STATS_URL?.trim();
  if (explicit) {
    const parsed = parseNativeSwapStats(await fetchRemoteJson(explicit));
    if (parsed) return parsed;
  }

  const boardUrl = process.env.BITE_LEADERBOARD_URL?.trim();
  if (boardUrl) {
    try {
      const swapUrl = new URL(boardUrl);
      swapUrl.pathname = swapUrl.pathname.replace(
        /leaderboard\.json\/?$/i,
        "swap-stats.json",
      );
      if (!/swap-stats\.json$/i.test(swapUrl.pathname)) {
        swapUrl.pathname = swapUrl.pathname.replace(/\/?$/, "/swap-stats.json");
      }
      const fromSwap = parseNativeSwapStats(await fetchRemoteJson(swapUrl.toString()));
      if (fromSwap) return fromSwap;
    } catch {
      // fall through
    }
    const board = await fetchRemoteJson(boardUrl);
    if (board && typeof board === "object" && "swapStats" in board) {
      const nested = parseNativeSwapStats(
        (board as { swapStats?: unknown }).swapStats,
      );
      if (nested) return nested;
    }
  }

  const statePath =
    process.env.BITE_BOT_STATE_FILE?.trim() ||
    path.join(process.cwd(), "bots", ".bite_bot_state.json");
  const stateRaw = await readJsonFile(statePath);
  if (stateRaw && typeof stateRaw === "object") {
    const ns = (stateRaw as { native_swaps?: unknown }).native_swaps;
    if (ns && typeof ns === "object") {
      // Local state has raw index — build a minimal summary without Python.
      const byTx = (ns as { by_tx?: Record<string, unknown> }).by_tx || {};
      const wallets = (ns as { wallets?: Record<string, unknown> }).wallets || {};
      const allTime = (ns as { all_time?: Record<string, unknown> }).all_time;
      const now = Date.now() / 1000;
      let h24Count = 0;
      let h24Wallets = new Set<string>();
      let h24Bite = 0;
      let h24Aapl = 0;
      let h24Buy = 0;
      let h24Sell = 0;
      let h24Client = 0;
      for (const rec of Object.values(byTx)) {
        if (!rec || typeof rec !== "object") continue;
        const r = rec as Record<string, unknown>;
        const ts = Number(r.ts) || 0;
        if (ts < now - 86_400) continue;
        h24Count += 1;
        const w = String(r.wallet || "").toLowerCase();
        if (w.startsWith("0x")) h24Wallets.add(w);
        const fee = Math.max(0, Math.floor(Number(r.feeRaw) || 0));
        const token = String(r.feeToken || "");
        if (token === "BITE") h24Bite += fee;
        if (token === "AAPL") h24Aapl += fee;
        if (r.side === "buy") h24Buy += 1;
        if (r.side === "sell") h24Sell += 1;
        if (r.clientConfirmed) h24Client += 1;
      }
      const at: NativeSwapWindow = allTime
        ? asWindow({
            ...allTime,
            feeBite: Number(allTime.feeBiteRaw || 0) / 1e18,
            feeAapl: Number(allTime.feeAaplRaw || 0) / 1e18,
            estVolumeBite:
              (Number(allTime.feeBiteRaw || 0) * 10_000) /
              SWAP_KITCHEN_PORTION_BIPS /
              1e18,
            estVolumeAapl:
              (Number(allTime.feeAaplRaw || 0) * 10_000) /
              SWAP_KITCHEN_PORTION_BIPS /
              1e18,
          })
        : {
            ...emptyWindow(),
            swapCount: Object.keys(byTx).length,
            uniqueWallets: Object.keys(wallets).length,
          };
      return {
        ...emptyNativeSwapStats(),
        mode: String((ns as { mode?: string }).mode || "local"),
        cursor: Math.max(0, Math.floor(Number((ns as { cursor?: number }).cursor) || 0)),
        allTime: at,
        h24: {
          swapCount: h24Count,
          uniqueWallets: h24Wallets.size,
          feeBiteRaw: h24Bite,
          feeAaplRaw: h24Aapl,
          buyCount: h24Buy,
          sellCount: h24Sell,
          clientConfirmed: h24Client,
          feeBite: h24Bite / 1e18,
          feeAapl: h24Aapl / 1e18,
          estVolumeBite: (h24Bite * 10_000) / SWAP_KITCHEN_PORTION_BIPS / 1e18,
          estVolumeAapl: (h24Aapl * 10_000) / SWAP_KITCHEN_PORTION_BIPS / 1e18,
          feeBips: SWAP_KITCHEN_PORTION_BIPS,
          feeUsd: null,
          estVolumeUsd: null,
        },
      };
    }
  }

  return emptyNativeSwapStats();
}

export type ClientSwapLog = {
  txHash: string;
  wallet: string;
  side: "buy" | "sell" | "unknown";
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  feeToken?: "BITE" | "AAPL";
};

export function sideFromTokens(tokenIn: SwapSide, tokenOut: SwapSide): "buy" | "sell" {
  if (tokenOut === "bite") return "buy";
  if (tokenIn === "bite") return "sell";
  return "buy";
}

export function feeTokenForSide(side: "buy" | "sell"): "BITE" | "AAPL" {
  return side === "buy" ? "BITE" : "AAPL";
}

export function symbolForSide(side: SwapSide | BuySide): string {
  return SWAP_TOKENS[side as SwapSide]?.symbol ?? String(side);
}

/** Forward client confirm to Railway bot ingest when BITE_SWAP_INGEST_URL is set. */
export async function forwardClientSwapLog(payload: ClientSwapLog): Promise<{
  ok: boolean;
  forwarded?: boolean;
  error?: string;
}> {
  const ingest =
    process.env.BITE_SWAP_INGEST_URL?.trim() ||
    deriveIngestFromLeaderboard(process.env.BITE_LEADERBOARD_URL?.trim());
  if (!ingest) {
    return { ok: true, forwarded: false };
  }
  try {
    const res = await fetch(ingest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        forwarded: true,
        error: text || `ingest ${res.status}`,
      };
    }
    return { ok: true, forwarded: true };
  } catch (e) {
    return {
      ok: false,
      forwarded: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function deriveIngestFromLeaderboard(boardUrl: string | undefined): string | null {
  if (!boardUrl) return null;
  try {
    const u = new URL(boardUrl);
    u.pathname = u.pathname.replace(/leaderboard\.json\/?$/i, "native-swap");
    if (!/native-swap$/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/?$/, "/native-swap");
    }
    return u.toString();
  } catch {
    return null;
  }
}
