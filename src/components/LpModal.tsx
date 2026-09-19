"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import {
  useAccount,
  useConfig,
  useConnect,
  useDisconnect,
  useReadContracts,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { getPublicClient, sendTransaction, switchChain } from "wagmi/actions";
import { formatEther, isAddress, parseEther } from "viem";
import { erc20Abi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import { AAPL_TOKEN, BITE_TOKEN } from "@/lib/config";
import { copy } from "@/lib/copy";
import {
  LP_QUOTE_MAX_AGE_MS,
  LP_SEED_FEE_PIPS,
  LP_SLIPPAGE_PERCENT,
  amountForToken,
  estimateSeedFees,
  formatFeeTier,
  formatSharePercent,
  formatUsdEstimate,
  syntheticSeedPool,
  normalizePermitDomain,
  normalizePermitTypes,
  validateApprovalTx,
  validateLpCreateTx,
  validateLpManagerTx,
  type LpApprovalResponse,
  type LpClaimResponse,
  type LpCreateResponse,
  type LpDecreaseResponse,
  type LpPoolInfo,
  type LpPosition,
  type LpPositionsResponse,
} from "@/lib/uniswap-lp";
import { SWAP_TOKENS, formatSwapAmount } from "@/lib/uniswap-trade";
import { AppleBiteLoop } from "./AppleBiteLoop";

type LpModalProps = {
  open: boolean;
  onClose: () => void;
};

const CONNECTOR_LABELS: Record<string, string> = {
  injected: "Browser Wallet",
  walletConnect: "WalletConnect",
  coinbaseWalletSDK: "Coinbase Wallet",
};

function connectorLabel(c: Connector): string {
  if (c.name && c.name !== "Injected") return c.name;
  return CONNECTOR_LABELS[c.type] ?? c.name ?? c.type;
}

function dedupeConnectors(connectors: readonly Connector[]): Connector[] {
  const seen = new Set<string>();
  const result: Connector[] = [];
  for (const c of connectors) {
    const key = c.type === "injected" ? `injected:${c.name}` : c.type;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

function hideInjectedOnThisDevice(): boolean {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent;
  const phone = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  );
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (phone || (coarse && window.innerWidth < 900)) return true;
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
  return !ethereum;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return copy.lp.failed;
}

function parseOptionalAmount(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0") return 0n;
  return parseEther(trimmed);
}

export function LpModal({ open, onClose }: LpModalProps) {
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain: switchChainHook } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();

  const connectors = useMemo(
    () =>
      dedupeConnectors(rawConnectors).filter((c) => {
        if (c.type === "injected" && hideInjectedOnThisDevice()) return false;
        return true;
      }),
    [rawConnectors],
  );

  const [lpAmount, setLpAmount] = useState("1000");
  const [keepAmount, setKeepAmount] = useState("0");
  const [quote, setQuote] = useState<LpCreateResponse | null>(null);
  const [quotedAt, setQuotedAt] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    "approve" | "sign" | "lp" | "claim" | "remove" | null
  >(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [claimDone, setClaimDone] = useState(false);
  const [removeDone, setRemoveDone] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const [pool, setPool] = useState<LpPoolInfo | null>(null);
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);

  const onWrongChain = isConnected && chainId !== robinhoodChain.id;

  const { data: balances } = useReadContracts({
    contracts: address
      ? [
          {
            address: BITE_TOKEN,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
            chainId: robinhoodChain.id,
          },
          {
            address: AAPL_TOKEN,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
            chainId: robinhoodChain.id,
          },
        ]
      : [],
    query: { enabled: Boolean(open && address) },
  });

  const biteBalance =
    balances?.[0]?.status === "success" ? (balances[0].result as bigint) : undefined;
  const aaplBalance =
    balances?.[1]?.status === "success" ? (balances[1].result as bigint) : undefined;

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showWallets && !isConnected) {
        setShowWallets(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, showWallets, isConnected]);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setDone(false);
    setClaimDone(false);
    setRemoveDone(false);
    setTxHash(undefined);
    setBusy(null);
    setShowWallets(false);
    setActiveTokenId(null);
  }, [open]);

  useEffect(() => {
    if (isConnected) setShowWallets(false);
  }, [isConnected]);

  const fetchQuote = useCallback(async (): Promise<LpCreateResponse | null> => {
    let wei: string;
    try {
      wei = parseEther(lpAmount || "0").toString();
    } catch {
      setQuote(null);
      setQuoteError(copy.lp.invalidAmount);
      return null;
    }
    if (BigInt(wei) <= 0n) {
      setQuote(null);
      setQuoteError(null);
      return null;
    }
    setQuoting(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/uniswap/lp/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenIn: "bite",
          amountWei: wei,
          walletAddress: address ?? undefined,
        }),
      });
      const data = (await res.json()) as LpCreateResponse;
      if (!res.ok || !data.create?.data) {
        throw new Error(data.error || copy.lp.quoteFailed);
      }
      setQuote(data);
      setQuotedAt(Date.now());
      return data;
    } catch (error) {
      setQuote(null);
      setQuoteError(errorMessage(error));
      return null;
    } finally {
      setQuoting(false);
    }
  }, [lpAmount, address]);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/uniswap/lp/pool_info", { cache: "no-store" });
      const data = (await res.json()) as {
        seed?: { pool?: LpPoolInfo | null };
        error?: string;
      };
      setPool(data.seed?.pool ?? syntheticSeedPool());
    } catch {
      setPool(syntheticSeedPool());
    }
  }, []);

  const fetchPositions = useCallback(async () => {
    if (!address) {
      setPositions([]);
      return;
    }
    setPositionsLoading(true);
    try {
      const res = await fetch("/api/uniswap/lp/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = (await res.json()) as LpPositionsResponse;
      setPositions(Array.isArray(data.positions) ? data.positions : []);
    } catch {
      setPositions([]);
    } finally {
      setPositionsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!open) return;
    void fetchPool();
  }, [open, fetchPool]);

  useEffect(() => {
    if (!open || !address) {
      setPositions([]);
      return;
    }
    void fetchPositions();
  }, [open, address, fetchPositions]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void fetchQuote();
    }, 350);
    return () => window.clearTimeout(handle);
  }, [open, fetchQuote]);

  useEffect(() => {
    if (!open || !quote) return;
    const id = window.setInterval(() => {
      void fetchQuote();
    }, LP_QUOTE_MAX_AGE_MS);
    return () => window.clearInterval(id);
  }, [open, quote, fetchQuote]);

  useEffect(() => {
    if (!isSuccess || !txHash || !busy) return;
    if (busy === "lp") {
      setDone(true);
      setBusy(null);
      void fetchPositions();
      return;
    }
    if (busy === "claim") {
      setClaimDone(true);
      setBusy(null);
      void fetchPositions();
      return;
    }
    if (busy === "remove") {
      setRemoveDone(true);
      setBusy(null);
      void fetchPositions();
    }
  }, [isSuccess, txHash, busy, fetchPositions]);

  const matchingAapl = useMemo(() => {
    if (!quote) return null;
    try {
      return formatSwapAmount(amountForToken(quote.token0, quote.token1, AAPL_TOKEN));
    } catch {
      return null;
    }
  }, [quote]);

  const biteForLp = useMemo(() => {
    if (!quote) return 0n;
    try {
      return BigInt(amountForToken(quote.token0, quote.token1, BITE_TOKEN));
    } catch {
      return 0n;
    }
  }, [quote]);

  const aaplForLp = useMemo(() => {
    if (!quote) return 0n;
    try {
      return BigInt(amountForToken(quote.token0, quote.token1, AAPL_TOKEN));
    } catch {
      return 0n;
    }
  }, [quote]);

  const feeEstimate = useMemo(
    () =>
      estimateSeedFees({
        pool,
        biteWei: biteForLp,
        aaplWei: aaplForLp,
      }),
    [pool, biteForLp, aaplForLp],
  );

  const keepWei = useMemo(() => {
    try {
      return parseOptionalAmount(keepAmount);
    } catch {
      return -1n;
    }
  }, [keepAmount]);

  const insufficientBite = useMemo(() => {
    if (biteBalance === undefined || keepWei < 0n) return false;
    return biteForLp + keepWei > biteBalance;
  }, [biteBalance, biteForLp, keepWei]);

  const insufficientAapl = useMemo(() => {
    if (aaplBalance === undefined) return false;
    return aaplForLp > aaplBalance;
  }, [aaplBalance, aaplForLp]);

  const sendTx = async (tx: { to: string; data: string; value?: string }) => {
    await switchChain(config, { chainId: robinhoodChain.id });
    const hash = await sendTransaction(config, {
      chainId: robinhoodChain.id,
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || "0"),
    });
    const publicClient = getPublicClient(config, { chainId: robinhoodChain.id });
    if (!publicClient) throw new Error(copy.lp.failed);
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  const runLp = async () => {
    if (!address || !quote) return;
    if (keepWei < 0n) {
      setLocalError(copy.lp.invalidAmount);
      return;
    }
    setLocalError(null);
    setDone(false);
    setTxHash(undefined);
    try {
      let liveQuote: LpCreateResponse | null = quote;
      if (Date.now() - quotedAt > LP_QUOTE_MAX_AGE_MS) {
        liveQuote = await fetchQuote();
      }
      if (!liveQuote) throw new Error(copy.lp.quoteFailed);

      const biteWei = amountForToken(liveQuote.token0, liveQuote.token1, BITE_TOKEN);
      const aaplWei = amountForToken(liveQuote.token0, liveQuote.token1, AAPL_TOKEN);

      setBusy("approve");
      const approvalRes = await fetch("/api/uniswap/lp/check_approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          lpTokens: [
            { tokenAddress: BITE_TOKEN, amount: biteWei },
            { tokenAddress: AAPL_TOKEN, amount: aaplWei },
          ],
        }),
      });
      const approvalJson = (await approvalRes.json()) as LpApprovalResponse;
      if (!approvalRes.ok) throw new Error(approvalJson.error || copy.lp.failed);

      for (const item of approvalJson.transactions ?? []) {
        if (!item.transaction?.to || !item.transaction.data) continue;
        validateApprovalTx(item.transaction, address);
        await sendTx(item.transaction);
      }

      let signature: string | undefined;
      const permit = approvalJson.v4BatchPermitData;
      if (permit && typeof permit === "object") {
        setBusy("sign");
        const types = normalizePermitTypes(permit.types);
        const { EIP712Domain: _domainType, ...rest } = types;
        const primaryType =
          permit.primaryType ??
          (rest.PermitBatch ? "PermitBatch" : Object.keys(rest)[0] ?? "PermitBatch");
        signature = await signTypedDataAsync({
          domain: normalizePermitDomain(permit.domain, robinhoodChain.id) as Parameters<
            typeof signTypedDataAsync
          >[0]["domain"],
          types: rest,
          message: permit.values,
          primaryType,
        });
      }

      setBusy("lp");
      const createRes = await fetch("/api/uniswap/lp/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenIn: "bite",
          amountWei: biteWei,
          walletAddress: address,
          signature,
          batchPermitData: permit ?? undefined,
        }),
      });
      const createJson = (await createRes.json()) as LpCreateResponse;
      if (!createRes.ok || !createJson.create) {
        throw new Error(createJson.error || copy.lp.failed);
      }
      validateLpCreateTx(createJson.create);
      if (
        isAddress(createJson.create.from) &&
        address.toLowerCase() !== createJson.create.from.toLowerCase()
      ) {
        throw new Error(copy.lp.failed);
      }
      const hash = await sendTx(createJson.create);
      setTxHash(hash);
    } catch (error) {
      setBusy(null);
      setLocalError(errorMessage(error));
    }
  };

  const runClaim = async (tokenId: string) => {
    if (!address) return;
    setLocalError(null);
    setClaimDone(false);
    setTxHash(undefined);
    setActiveTokenId(tokenId);
    try {
      setBusy("claim");
      const res = await fetch("/api/uniswap/lp/claim_fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, tokenId }),
      });
      const data = (await res.json()) as LpClaimResponse;
      if (!res.ok || !data.claim) throw new Error(data.error || copy.lp.failed);
      validateLpManagerTx(data.claim);
      if (
        isAddress(data.claim.from) &&
        address.toLowerCase() !== data.claim.from.toLowerCase()
      ) {
        throw new Error(copy.lp.failed);
      }
      const hash = await sendTx(data.claim);
      setTxHash(hash);
    } catch (error) {
      setBusy(null);
      setActiveTokenId(null);
      setLocalError(errorMessage(error));
    }
  };

  const runRemove = async (tokenId: string) => {
    if (!address) return;
    setLocalError(null);
    setRemoveDone(false);
    setTxHash(undefined);
    setActiveTokenId(tokenId);
    try {
      setBusy("remove");
      const res = await fetch("/api/uniswap/lp/decrease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          tokenId,
          percent: 100,
        }),
      });
      const data = (await res.json()) as LpDecreaseResponse;
      if (!res.ok || !data.decrease) throw new Error(data.error || copy.lp.failed);
      validateLpManagerTx(data.decrease);
      if (
        isAddress(data.decrease.from) &&
        address.toLowerCase() !== data.decrease.from.toLowerCase()
      ) {
        throw new Error(copy.lp.failed);
      }
      const hash = await sendTx(data.decrease);
      setTxHash(hash);
    } catch (error) {
      setBusy(null);
      setActiveTokenId(null);
      setLocalError(errorMessage(error));
    }
  };

  if (!open) return null;

  const lpPending = Boolean(busy) || confirming;
  const ctaBusy = lpPending || quoting;
  let lpWei = 0n;
  try {
    lpWei = parseOptionalAmount(lpAmount);
  } catch {
    lpWei = -1n;
  }
  const keepOnly = lpWei <= 0n;

  const pendingLabel =
    busy === "approve"
      ? copy.lp.approving
      : busy === "sign"
        ? copy.lp.signing
        : busy === "claim"
          ? copy.lp.claiming
          : busy === "remove"
            ? copy.lp.removing
            : copy.lp.depositing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.lp.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[22px] border border-[#d2d2d7] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#d2d2d7] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              {copy.lp.title}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#6e6e73]">{copy.lp.note}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#2997ff]"
          >
            {copy.lp.close}
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
          <p className="text-[13px] leading-relaxed text-[#6e6e73]">{copy.lp.body}</p>
          <p className="text-[13px] leading-relaxed text-[#6e6e73]">{copy.lp.hookExplain}</p>

          <label className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
              <span>{copy.lp.intoPool}</span>
              <span>{SWAP_TOKENS.bite.symbol}</span>
            </div>
            <input
              inputMode="decimal"
              value={lpAmount}
              onChange={(e) => {
                setLpAmount(e.target.value);
                setDone(false);
              }}
              className="mt-1 w-full bg-transparent text-[28px] font-semibold tracking-[-0.03em] text-[#1d1d1f] outline-none"
              aria-label={copy.lp.intoPool}
            />
            {isConnected && biteBalance !== undefined && (
              <p className="mt-1 text-[11px] text-[#6e6e73]">
                {copy.lp.balance}:{" "}
                {Number(formatEther(biteBalance)).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                {SWAP_TOKENS.bite.symbol}
              </p>
            )}
          </label>

          <label className="rounded-2xl border border-dashed border-[#d2d2d7] bg-white px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
              <span>{copy.lp.keepAside}</span>
              <span>{SWAP_TOKENS.bite.symbol}</span>
            </div>
            <input
              inputMode="decimal"
              value={keepAmount}
              onChange={(e) => {
                setKeepAmount(e.target.value);
                setDone(false);
              }}
              className="mt-1 w-full bg-transparent text-[28px] font-semibold tracking-[-0.03em] text-[#1d1d1f] outline-none"
              aria-label={copy.lp.keepAside}
            />
            <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
              {copy.lp.keepHint}
            </p>
          </label>

          <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
              <span>{copy.lp.matching}</span>
              <span>{SWAP_TOKENS.aapl.symbol}</span>
            </div>
            <p className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
              {quoting && !matchingAapl ? copy.lp.quoting : matchingAapl ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-[#6e6e73]">
              {copy.lp.slippage(LP_SLIPPAGE_PERCENT)}
            </p>
            {isConnected && aaplBalance !== undefined && (
              <p className="mt-1 text-[11px] text-[#6e6e73]">
                {copy.lp.balance}:{" "}
                {Number(formatEther(aaplBalance)).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}{" "}
                {SWAP_TOKENS.aapl.symbol}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#d2d2d7] px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
              <span>{copy.lp.feeTitle}</span>
              <span>
                {copy.lp.feeTierLabel(
                  formatFeeTier(pool?.fee ?? LP_SEED_FEE_PIPS),
                )}{" "}
                · {copy.lp.feeDisclaimer}
              </span>
            </div>
            {quoting && !matchingAapl ? (
              <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">
                {copy.lp.feeLoading}
              </p>
            ) : feeEstimate.sharePercent != null && matchingAapl ? (
              <div className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-[#1d1d1f]">
                <p>
                  {copy.lp.feeShare(
                    formatSharePercent(feeEstimate.sharePercent),
                    formatSwapAmount(biteForLp.toString()),
                    matchingAapl,
                  )}
                </p>
                {feeEstimate.feeTierPercent != null &&
                  feeEstimate.feeTierPercent > 0 && (
                    <p className="text-[#6e6e73]">
                      {copy.lp.feeTake(
                        formatFeeTier(pool?.fee ?? LP_SEED_FEE_PIPS),
                        formatSharePercent(feeEstimate.sharePercent),
                      )}
                    </p>
                  )}
                {feeEstimate.estimatedUsdPerDay != null ? (
                  <p className="text-[#6e6e73]">
                    {copy.lp.feeDaily(
                      formatUsdEstimate(feeEstimate.estimatedUsdPerDay),
                    )}
                  </p>
                ) : feeEstimate.gap === "thin_volume" ? (
                  <p className="text-[#6e6e73]">{copy.lp.feeThin}</p>
                ) : feeEstimate.gap === "no_volume" ? (
                  <p className="text-[#6e6e73]">{copy.lp.feeNoVolume}</p>
                ) : feeEstimate.gap === "zero_fee" ? (
                  <p className="text-[#6e6e73]">{copy.lp.feeZeroFee}</p>
                ) : null}
                <p className="text-[#6e6e73]">{copy.lp.feeHook}</p>
              </div>
            ) : biteForLp <= 0n ? (
              <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">
                {copy.lp.feeNeedAmount}
              </p>
            ) : (
              <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">
                {copy.lp.feeNoVolume}
              </p>
            )}
          </div>

          <p className="text-center text-[11px] leading-relaxed text-[#6e6e73]">
            {copy.lp.pots}
          </p>

          {quoteError && (
            <p className="text-center text-[13px] text-[#ff3b30]">{quoteError}</p>
          )}
          {localError && (
            <p className="text-center text-[13px] text-[#ff3b30]">{localError}</p>
          )}
          {insufficientBite && (
            <p className="text-center text-[13px] text-[#ff3b30]">
              {copy.lp.insufficientKeep}
            </p>
          )}
          {insufficientAapl && (
            <p className="text-center text-[13px] text-[#ff3b30]">
              {copy.lp.insufficient(SWAP_TOKENS.aapl.symbol)}
            </p>
          )}
          {keepWei < 0n && (
            <p className="text-center text-[13px] text-[#ff3b30]">
              {copy.lp.invalidAmount}
            </p>
          )}
          {done && (
            <p className="text-center text-[13px] font-medium text-[#34c759]">
              {copy.lp.complete}
            </p>
          )}
          {claimDone && (
            <p className="text-center text-[13px] font-medium text-[#34c759]">
              {copy.lp.claimComplete}
            </p>
          )}
          {removeDone && (
            <p className="text-center text-[13px] font-medium text-[#34c759]">
              {copy.lp.removeComplete}
            </p>
          )}

          {lpPending ? (
            <div className="flex flex-col items-center gap-1 py-1" aria-live="polite">
              <AppleBiteLoop />
              <p className="text-center text-[13px] font-medium text-[#1d1d1f]">
                {pendingLabel}
              </p>
            </div>
          ) : !isConnected ? (
            showWallets ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[13px] font-medium text-[#1d1d1f]">
                    {copy.lp.chooseWallet}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowWallets(false)}
                    className="rounded-full px-2 py-1 text-[13px] font-medium text-[#2997ff]"
                  >
                    {copy.lp.back}
                  </button>
                </div>
                {connectors.map((connector) => {
                  const isWC = connector.type === "walletConnect";
                  return (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={connecting}
                      onClick={() => connect({ connector })}
                      className={[
                        "w-full rounded-full px-6 py-3 text-[15px] font-medium transition disabled:opacity-50",
                        isWC
                          ? "border border-[#2997ff] bg-white text-[#2997ff] hover:bg-[#2997ff]/5"
                          : "bg-[#1d1d1f] text-white hover:bg-black",
                      ].join(" ")}
                    >
                      {connecting ? copy.lp.connecting : connectorLabel(connector)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowWallets(true)}
                className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black"
              >
                {copy.lp.connect}
              </button>
            )
          ) : onWrongChain ? (
            <button
              type="button"
              onClick={() => switchChainHook({ chainId: robinhoodChain.id })}
              className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-black"
            >
              {copy.lp.switchNetwork}
            </button>
          ) : (
            <button
              type="button"
              disabled={
                ctaBusy ||
                !quote ||
                insufficientBite ||
                insufficientAapl ||
                done ||
                keepOnly ||
                keepWei < 0n
              }
              onClick={() => void runLp()}
              className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
            >
              {keepOnly ? copy.lp.keepOnly : copy.lp.cta}
            </button>
          )}

          {isConnected && (
            <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
              <p className="text-[12px] font-medium text-[#6e6e73]">
                {copy.lp.positionsTitle}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
                {copy.lp.positionsHint}
              </p>
              {positionsLoading ? (
                <p className="mt-3 text-[13px] text-[#6e6e73]">
                  {copy.lp.positionsLoading}
                </p>
              ) : positions.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#6e6e73]">
                  {copy.lp.positionsEmpty}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {positions.map((position) => {
                    const biteFees = BigInt(position.fees.biteWei || "0");
                    const aaplFees = BigInt(position.fees.aaplWei || "0");
                    const canClaim = biteFees > 0n || aaplFees > 0n;
                    const canRemove = BigInt(position.liquidity || "0") > 0n;
                    const rowBusy = lpPending && activeTokenId === position.tokenId;
                    return (
                      <div
                        key={position.tokenId}
                        className="rounded-2xl border border-[#d2d2d7] bg-white px-3 py-3"
                      >
                        <p className="text-[13px] font-medium text-[#1d1d1f]">
                          {copy.lp.positionLabel(
                            position.tokenId,
                            formatFeeTier(position.feePips ?? 0),
                          )}
                        </p>
                        <p className="mt-1 text-[12px] text-[#6e6e73]">
                          {copy.lp.uncollected}
                        </p>
                        <p className="text-[15px] font-semibold text-[#1d1d1f]">
                          {formatSwapAmount(biteFees.toString())}{" "}
                          {SWAP_TOKENS.bite.symbol}
                          {" · "}
                          {formatSwapAmount(aaplFees.toString())}{" "}
                          {SWAP_TOKENS.aapl.symbol}
                        </p>
                        <button
                          type="button"
                          disabled={lpPending || !canClaim}
                          onClick={() => void runClaim(position.tokenId)}
                          className="mt-3 w-full rounded-full bg-[#1d1d1f] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
                        >
                          {rowBusy && busy === "claim"
                            ? copy.lp.claiming
                            : canClaim
                              ? copy.lp.claim
                              : copy.lp.claimNone}
                        </button>
                        {canRemove && (
                          <button
                            type="button"
                            disabled={lpPending}
                            onClick={() => void runRemove(position.tokenId)}
                            className="mt-2 w-full text-center text-[12px] text-[#6e6e73] disabled:opacity-40"
                          >
                            {rowBusy && busy === "remove"
                              ? copy.lp.removing
                              : copy.lp.remove}
                          </button>
                        )}
                        <p className="mt-1 text-center text-[11px] text-[#6e6e73]">
                          {copy.lp.removeHint}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isConnected && (
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-center text-[12px] text-[#6e6e73]"
            >
              {copy.lp.disconnect}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
