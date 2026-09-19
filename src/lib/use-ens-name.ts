"use client";

import { useEffect, useReducer } from "react";
import { isAddress } from "viem";

const names = new Map<string, string | null>();
const inflight = new Set<string>();
const queued = new Set<string>();
const listeners = new Set<() => void>();

const FLUSH_MS = 50;
const BATCH_SIZE = 40;

let timer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

function scheduleFlush() {
  if (timer != null) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_MS);
}

async function flush() {
  const batch: string[] = [];
  for (const addr of queued) {
    if (names.has(addr) || inflight.has(addr)) continue;
    batch.push(addr);
    if (batch.length >= BATCH_SIZE) break;
  }
  for (const addr of batch) {
    queued.delete(addr);
    inflight.add(addr);
  }
  if (!batch.length) return;

  try {
    const res = await fetch("/api/ens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: batch }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        names?: Record<string, string | null>;
      };
      for (const [addr, name] of Object.entries(data.names ?? {})) {
        names.set(addr.toLowerCase(), name);
      }
      for (const addr of batch) {
        if (!names.has(addr)) names.set(addr, null);
      }
    }
  } catch {
    // leave uncached so a later mount can retry
  } finally {
    for (const addr of batch) inflight.delete(addr);
    notify();
    if (queued.size > 0) scheduleFlush();
  }
}

function enqueue(address: string) {
  const key = address.trim().toLowerCase();
  if (!isAddress(key)) return;
  if (names.has(key) || inflight.has(key) || queued.has(key)) return;
  queued.add(key);
  scheduleFlush();
}

/** Reverse ENS lookup; returns null until resolved (or if the wallet has none). */
export function useEnsName(address: string | undefined | null): string | null {
  const key = address?.trim().toLowerCase() ?? "";
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    return () => {
      listeners.delete(rerender);
    };
  }, []);

  useEffect(() => {
    if (!key) return;
    enqueue(key);
  }, [key]);

  if (!key) return null;
  return names.get(key) ?? null;
}
