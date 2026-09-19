"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEADERBOARD_POLL_MS } from "@/lib/config";
import type { Eater, SupplyStats } from "@/lib/race";

/**
 * Shared live board for home + /leaderboard.
 * Both surfaces poll /api/leaderboard on the same cadence and apply
 * eaters whenever the payload includes the array (no scoring-label gate).
 */
export function useLeaderboardLive(
  initialEaters: Eater[],
  initialStats?: SupplyStats | null,
  initialCoreTarget = 0,
) {
  const [eaters, setEaters] = useState(initialEaters);
  const [supplyStats, setSupplyStats] = useState<SupplyStats | undefined>(
    initialStats ?? undefined,
  );
  const [coreTarget, setCoreTarget] = useState(initialCoreTarget);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!res.ok || !mountedRef.current) return;
      const data = (await res.json()) as {
        eaters?: Eater[];
        supplyStats?: SupplyStats | null;
        updatedAt?: string | null;
        coreTarget?: number | null;
      };
      if (!mountedRef.current) return;
      if (Array.isArray(data.eaters)) setEaters(data.eaters);
      if (data.supplyStats) setSupplyStats(data.supplyStats);
      if (typeof data.coreTarget === "number" && data.coreTarget > 0) {
        setCoreTarget(data.coreTarget);
      }
      if (data.updatedAt) setUpdatedAt(data.updatedAt);
    } catch {
      // silent — next poll retries
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const kickoff = setTimeout(refresh, 0);
    const id = setInterval(refresh, LEADERBOARD_POLL_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [refresh]);

  return { eaters, supplyStats, coreTarget, updatedAt, refresh };
}
