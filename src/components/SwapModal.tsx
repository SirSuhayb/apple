"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import {
  useAccount,
  useBalance,
  useConfig,
  useConnect,
  useDisconnect,
  useReadContract,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { getPublicClient, sendTransaction, switchChain } from "wagmi/actions";
import { formatUnits, isAddress, parseUnits } from "viem";
import { erc20Abi } from "@/lib/abis";
import { robinhoodChain } from "@/lib/chain";
import {
  AAPL_TOKEN,
  BITE_TOKEN,
  PONS_TOKEN_URL,
  SWAP_OPEN_REVERSE_URL,
  SWAP_OPEN_URL,
} from "@/lib/config";
import { copy } from "@/lib/copy";
import {
  BUY_SIDES,
  QUOTE_MAX_AGE_MS,
  SWAP_PORTION_SUPPORTED,
  SWAP_SLIPPAGE_PERCENT,
  SWAP_TOKENS,
  SWAP_TOTAL_FEE_BIPS,
  formatSwapAmount,
  getInputAmount,
  swapFeeDisclosure,
  getOutputAmount,
  isBuySide,
  isNativeSwapToken,
  resolveSwapPair,
  validateSwapBeforeBroadcast,
  type BuySide,
  type QuoteResponse,
  type SwapSide,
  type SwapTransaction,
} from "@/lib/uniswap-trade";
import { AppleBiteLoop } from "./AppleBiteLoop";

type SwapModalProps = {
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
  return copy.swap.failed;
}

function defaultAmountFor(side: SwapSide): string {
  if (side === "bite") return "1000";
  if (side === "usdg") return "10";
  if (side === "aapl") return "0.01";
  return "0.01";
}

export function SwapModal({ open, onClose }: SwapModalProps) {
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

  const [tokenInSide, setTokenInSide] = useState<SwapSide>("aapl");
  const [lastBuySide, setLastBuySide] = useState<BuySide>("aapl");
  const [amount, setAmount] = useState("0.01");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quotedAt, setQuotedAt] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "sign" | "swap" | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [loggedTx, setLoggedTx] = useState<string | null>(null);

  const { tokenIn, tokenOut } = resolveSwapPair(tokenInSide);
  const buying = isBuySide(tokenInSide);
  const payingNative = isNativeSwapToken(tokenIn);
  const onWrongChain = isConnected && chainId !== robinhoodChain.id;

  const { data: erc20Balance } = useReadContract({
    address: tokenIn.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(open && address && !payingNative) },
  });

  const { data: nativeBalance } = useBalance({
    address,
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(open && address && payingNative) },
  });

  const balance = payingNative ? nativeBalance?.value : erc20Balance;

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: robinhoodChain.id,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (payPickerOpen) {
        setPayPickerOpen(false);
        return;
      }
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
  }, [open, onClose, showWallets, isConnected, payPickerOpen]);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setDone(false);
    setTxHash(undefined);
    setBusy(null);
    setShowWallets(false);
    setPayPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (isConnected) setShowWallets(false);
  }, [isConnected]);

  useEffect(() => {
    if (!open) {
      setPreviewPending(false);
      return;
    }
    const sync = () => setPreviewPending(window.location.hash === "#swap-pending");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [open]);

  const fetchQuote = useCallback(async (): Promise<QuoteResponse | null> => {
    let wei: string;
    try {
      wei = parseUnits(amount || "0", tokenIn.decimals).toString();
    } catch {
      setQuote(null);
      setQuoteError(copy.swap.invalidAmount);
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
      const res = await fetch("/api/uniswap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountWei: wei,
          swapper: address ?? undefined,
        }),
      });
      const data = (await res.json()) as QuoteResponse & { error?: string };
      if (!res.ok || !data.routing) {
        throw new Error(data.error || copy.swap.quoteFailed);
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
  }, [amount, tokenIn.address, tokenIn.decimals, tokenOut.address, address]);

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
    }, QUOTE_MAX_AGE_MS);
    return () => window.clearInterval(id);
  }, [open, quote, fetchQuote]);

  useEffect(() => {
    if (!isSuccess || !txHash || busy !== "swap") return;
    setDone(true);
    setBusy(null);
  }, [isSuccess, txHash, busy]);

  useEffect(() => {
    if (!isSuccess || !txHash || !address || loggedTx === txHash) return;
    setLoggedTx(txHash);
    const side = buying ? "buy" : "sell";
    const amountIn = quote ? getInputAmount(quote) : amount;
    let amountOut = "";
    try {
      amountOut = quote ? getOutputAmount(quote) : "";
    } catch {
      amountOut = "";
    }
    void fetch("/api/swap-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        txHash,
        wallet: address,
        side,
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn,
        amountOut,
        feeToken: side === "buy" ? "BITE" : "AAPL",
      }),
    }).catch(() => {
      /* KPI ingest is best-effort; never block the swap UI */
    });
  }, [
    isSuccess,
    txHash,
    address,
    loggedTx,
    buying,
    quote,
    amount,
    tokenIn.symbol,
    tokenOut.symbol,
  ]);

  const quotedOut = useMemo(() => {
    if (!quote) return null;
    try {
      return formatSwapAmount(getOutputAmount(quote), tokenOut.decimals);
    } catch {
      return null;
    }
  }, [quote, tokenOut.decimals]);

  const insufficient = useMemo(() => {
    if (balance === undefined) return false;
    try {
      return parseUnits(amount || "0", tokenIn.decimals) > balance;
    } catch {
      return false;
    }
  }, [amount, balance, tokenIn.decimals]);

  const selectBuyToken = (side: BuySide) => {
    setTokenInSide(side);
    setLastBuySide(side);
    setAmount(defaultAmountFor(side));
    setDone(false);
    setPayPickerOpen(false);
  };

  const flipDirection = () => {
    if (buying) {
      setTokenInSide("bite");
      setAmount(defaultAmountFor("bite"));
    } else {
      setTokenInSide(lastBuySide);
      setAmount(defaultAmountFor(lastBuySide));
    }
    setDone(false);
    setPayPickerOpen(false);
  };

  const sendTx = async (tx: { to: string; data: string; value?: string }) => {
    await switchChain(config, { chainId: robinhoodChain.id });
    const hash = await sendTransaction(config, {
      chainId: robinhoodChain.id,
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value || "0"),
    });
    const publicClient = getPublicClient(config, { chainId: robinhoodChain.id });
    if (!publicClient) throw new Error(copy.swap.failed);
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  const runSwap = async () => {
    if (!address || !quote) return;
    setLocalError(null);
    setDone(false);
    try {
      let liveQuote: QuoteResponse | null = quote;
      if (Date.now() - quotedAt > QUOTE_MAX_AGE_MS) {
        liveQuote = await fetchQuote();
      }
      if (!liveQuote) throw new Error(copy.swap.quoteFailed);

      const amountWei = getInputAmount(liveQuote);

      if (!payingNative) {
        setBusy("approve");
        const approvalRes = await fetch("/api/uniswap/check_approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            token: tokenIn.address,
            amount: amountWei,
            chainId: robinhoodChain.id,
          }),
        });
        const approvalJson = (await approvalRes.json()) as {
          approval?: { to: string; data: string; value?: string } | null;
          error?: string;
        };
        if (!approvalRes.ok) throw new Error(approvalJson.error || copy.swap.failed);
        if (approvalJson.approval?.to && approvalJson.approval.data) {
          await sendTx(approvalJson.approval);
        }
      }

      let signature: string | undefined;
      if (liveQuote.permitData && typeof liveQuote.permitData === "object") {
        setBusy("sign");
        const permit = liveQuote.permitData as {
          domain: Record<string, unknown>;
          types: Record<string, Array<{ name: string; type: string }>>;
          values: Record<string, unknown>;
          primaryType?: string;
        };
        const { EIP712Domain: _domainType, ...types } = permit.types;
        const primaryType =
          permit.primaryType ??
          Object.keys(types)[0] ??
          "PermitSingle";
        signature = await signTypedDataAsync({
          domain: permit.domain as Parameters<typeof signTypedDataAsync>[0]["domain"],
          types,
          message: permit.values,
          primaryType,
        });
      }

      setBusy("swap");
      const swapRes = await fetch("/api/uniswap/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: liveQuote, signature }),
      });
      const swapJson = (await swapRes.json()) as {
        swap?: SwapTransaction;
        error?: string;
      };
      if (!swapRes.ok || !swapJson.swap) {
        throw new Error(swapJson.error || copy.swap.failed);
      }
      validateSwapBeforeBroadcast(swapJson.swap);
      if (isAddress(swapJson.swap.from) && address.toLowerCase() !== swapJson.swap.from.toLowerCase()) {
        throw new Error(copy.swap.failed);
      }
      const hash = await sendTx(swapJson.swap);
      setTxHash(hash);
    } catch (error) {
      setBusy(null);
      setLocalError(errorMessage(error));
    }
  };

  if (!open) return null;

  const swapPending = Boolean(busy) || confirming || previewPending;
  const ctaBusy = swapPending || quoting;

  const pendingLabel =
    busy === "approve"
      ? copy.swap.approving
      : busy === "sign"
        ? copy.swap.signing
        : copy.swap.swapping;

  const uniswapHref = buying ? SWAP_OPEN_URL : SWAP_OPEN_REVERSE_URL;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={copy.swap.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[22px] border border-[#d2d2d7] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#d2d2d7] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              {copy.swap.title}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#6e6e73]">
              {copy.swap.uniswapNote}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#2997ff]"
          >
            {copy.swap.close}
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
          <label className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
              <span>{copy.swap.youPay}</span>
              {buying ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPayPickerOpen((v) => !v);
                    }}
                    className="rounded-full border border-[#d2d2d7] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#1d1d1f]"
                    aria-expanded={payPickerOpen}
                    aria-haspopup="listbox"
                    aria-label={copy.swap.choosePayToken}
                  >
                    {tokenIn.symbol} ▾
                  </button>
                  {payPickerOpen && (
                    <ul
                      role="listbox"
                      className="absolute right-0 z-10 mt-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-[#d2d2d7] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    >
                      {BUY_SIDES.map((side) => (
                        <li key={side} role="option" aria-selected={tokenInSide === side}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              selectBuyToken(side);
                            }}
                            className={[
                              "block w-full px-3 py-2 text-left text-[13px] font-medium",
                              tokenInSide === side
                                ? "bg-[#f5f5f7] text-[#1d1d1f]"
                                : "text-[#1d1d1f] hover:bg-[#f5f5f7]",
                            ].join(" ")}
                          >
                            {SWAP_TOKENS[side].symbol}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <span>{tokenIn.symbol}</span>
              )}
            </div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setDone(false);
              }}
              className="mt-1 w-full bg-transparent text-[28px] font-semibold tracking-[-0.03em] text-[#1d1d1f] outline-none"
              aria-label={copy.swap.youPay}
            />
            {isConnected && balance !== undefined && (
              <p className="mt-1 text-[11px] text-[#6e6e73]">
                {copy.swap.balance}:{" "}
                {Number(formatUnits(balance, tokenIn.decimals)).toLocaleString(undefined, {
                  maximumFractionDigits: tokenIn.decimals === 6 ? 2 : 4,
                })}{" "}
                {tokenIn.symbol}
              </p>
            )}
          </label>

          <button
            type="button"
            onClick={flipDirection}
            className="mx-auto rounded-full border border-[#d2d2d7] bg-white px-3 py-1 text-[12px] font-medium text-[#2997ff]"
          >
            {copy.swap.flip}
          </button>

          <div className="rounded-2xl bg-[#f5f5f7] px-4 py-3">
            <div className="flex items-center justify-between text-[12px] text-[#6e6e73]">
              <span>{copy.swap.youReceive}</span>
              <span>{tokenOut.symbol}</span>
            </div>
            <p className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#1d1d1f]">
              {quoting && !quotedOut
                ? copy.swap.quoting
                : quotedOut ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-[#6e6e73]">
              {SWAP_PORTION_SUPPORTED && SWAP_TOTAL_FEE_BIPS > 0
                ? copy.swap.slippage(
                    SWAP_SLIPPAGE_PERCENT,
                    swapFeeDisclosure(tokenOut.symbol),
                  )
                : copy.swap.slippage(SWAP_SLIPPAGE_PERCENT)}
            </p>
          </div>

          {quoteError && (
            <p className="text-center text-[13px] text-[#ff3b30]">{quoteError}</p>
          )}
          {localError && (
            <p className="text-center text-[13px] text-[#ff3b30]">{localError}</p>
          )}
          {insufficient && (
            <p className="text-center text-[13px] text-[#ff3b30]">
              {copy.swap.insufficient(tokenIn.symbol)}
            </p>
          )}
          {done && (
            <p className="text-center text-[13px] font-medium text-[#34c759]">
              {copy.swap.complete}
            </p>
          )}

          {swapPending ? (
            <div className="flex flex-col items-center gap-1 py-1" aria-live="polite">
              <AppleBiteLoop />
              <p className="text-center text-[13px] font-medium text-[#1d1d1f]">
                {previewPending && !busy && !confirming
                  ? copy.swap.eating
                  : pendingLabel}
              </p>
            </div>
          ) : !isConnected ? (
            showWallets ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[13px] font-medium text-[#1d1d1f]">
                    {copy.swap.chooseWallet}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowWallets(false)}
                    className="rounded-full px-2 py-1 text-[13px] font-medium text-[#2997ff]"
                  >
                    {copy.swap.back}
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
                      {connecting ? copy.swap.connecting : connectorLabel(connector)}
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
                {copy.swap.connect}
              </button>
            )
          ) : onWrongChain ? (
            <button
              type="button"
              onClick={() => switchChainHook({ chainId: robinhoodChain.id })}
              className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-black"
            >
              {copy.swap.switchNetwork}
            </button>
          ) : (
            <button
              type="button"
              disabled={ctaBusy || !quote || insufficient || done}
              onClick={() => void runSwap()}
              className="w-full rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
            >
              {copy.swap.cta}
            </button>
          )}

          {isConnected && (
            <button
              type="button"
              onClick={() => disconnect()}
              className="text-center text-[12px] text-[#6e6e73]"
            >
              {copy.swap.disconnect}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#d2d2d7] px-5 py-4">
          <p className="text-center text-[11px] leading-relaxed text-[#6e6e73]">
            {copy.swap.pairLabel(AAPL_TOKEN, BITE_TOKEN)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={uniswapHref}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-[#2997ff]"
            >
              {copy.swap.openUniswap}
            </a>
            <a
              href={PONS_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-[#2997ff]"
            >
              {copy.swap.openPons}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
