"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import {
  useAccount,
  useConnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import {
  baseChain,
  JB_MULTI_TERMINAL,
  JB_NATIVE_TOKEN,
  REVNET_PROJECT_ID,
  REVNET_READY,
  AAPLC_TOKEN,
  JUICE_TOKEN,
  JUICE_LIVE,
} from "@/lib/juice-config";
import { jbMultiTerminalAbi } from "@/lib/jb-abis";
import { erc20Abi } from "@/lib/abis";

type SaleSummary = {
  salesCount: number;
  totalSalesUsd: number;
  totalDepositsUsd: number;
  confirmedDepositsUsd: number;
  sales: Array<{
    orderId: string;
    amountUsd: number;
    depositAmountUsd: number;
    depositStatus: string;
    txHash?: string;
    source: string;
    loggedAt: string;
    itemCount: number;
  }>;
};

function connectorLabel(c: Connector): string {
  if (c.name && c.name !== "Injected") return c.name;
  const labels: Record<string, string> = {
    injected: "Browser Wallet",
    walletConnect: "WalletConnect",
    coinbaseWalletSDK: "Coinbase Wallet",
  };
  return labels[c.type] ?? c.name ?? c.type;
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

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RevShareDashboard() {
  const [sales, setSales] = useState<SaleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("0.01");
  const [depositMemo, setDepositMemo] = useState("");
  const [showWallets, setShowWallets] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors: rawConnectors, isPending: connecting } = useConnect();
  const { switchChain } = useSwitchChain();
  const connectors = useMemo(() => dedupeConnectors(rawConnectors), [rawConnectors]);
  const onWrongChain = isConnected && chainId !== baseChain.id;

  const { data: juiceBalance } = useReadContract({
    address: JUICE_TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: baseChain.id,
    query: { enabled: Boolean(address && JUICE_LIVE) },
  });

  const {
    writeContract,
    data: hash,
    isPending: writing,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: baseChain.id,
  });

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch("/api/juice/log-sale");
      if (res.ok) setSales(await res.json());
    } catch { /* best effort */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchSales(); }, [fetchSales]);

  const handleDeposit = () => {
    if (!address || !REVNET_READY) return;
    reset();
    try {
      const value = parseEther(depositAmount || "0");
      if (value <= 0n) return;
      writeContract({
        address: JB_MULTI_TERMINAL,
        abi: jbMultiTerminalAbi,
        functionName: "addToBalanceOf",
        args: [
          REVNET_PROJECT_ID,
          JB_NATIVE_TOKEN,
          value,
          false,
          depositMemo || "Juice brand revenue deposit",
          "0x",
        ],
        value,
        chainId: baseChain.id,
      });
    } catch { /* handled by writeError */ }
  };

  const busy = writing || confirming;

  return (
    <div className="space-y-6">
      {/* Sales stats */}
      <div className="rounded-[22px] border border-[#d2d2d7] bg-white px-6 py-7">
        <p className="text-[10px] font-semibold tracking-[1.5px] text-[#f97316] uppercase">
          Juice brand revenue
        </p>
        <h3 className="mt-2 text-[22px] font-bold text-[#1d1d1f]">
          Real-world sales → onchain treasury
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6e6e73]">
          Every juice brand sale is logged. A percentage of revenue is deposited
          into the Juicebox V6 revnet via <code className="text-[12px] bg-[#f5f5f7] px-1 py-0.5 rounded">addToBalanceOf</code>,
          which backs $JUICE holders without minting new tokens. NFT container
          holders earn rev share from these deposits.
        </p>

        {loading ? (
          <p className="mt-4 text-[13px] text-[#6e6e73]">Loading sales data…</p>
        ) : sales ? (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-[14px] bg-[#f5f5f7] px-4 py-3 text-center">
              <p className="text-[10px] font-semibold tracking-[1px] text-[#6e6e73] uppercase">
                Total sales
              </p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#1d1d1f]">
                {sales.salesCount}
              </p>
              <p className="text-[11px] tabular-nums text-[#6e6e73]">
                {fmtUsd(sales.totalSalesUsd)}
              </p>
            </div>
            <div className="rounded-[14px] bg-[#f97316]/10 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold tracking-[1px] text-[#f97316] uppercase">
                Rev → treasury
              </p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#f97316]">
                {fmtUsd(sales.totalDepositsUsd)}
              </p>
              <p className="text-[11px] tabular-nums text-[#6e6e73]">
                {fmtUsd(sales.confirmedDepositsUsd)} confirmed
              </p>
            </div>
            <div className="rounded-[14px] bg-[#34c759]/10 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold tracking-[1px] text-[#34c759] uppercase">
                Your $JUICE
              </p>
              <p className="mt-1 text-[24px] font-bold tabular-nums text-[#1d1d1f]">
                {juiceBalance !== undefined
                  ? Number(formatEther(juiceBalance as bigint)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : "—"}
              </p>
              <p className="text-[11px] text-[#6e6e73]">
                backed by surplus
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-[#6e6e73]">No sales logged yet.</p>
        )}

        {/* Recent sales feed */}
        {sales && sales.sales.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold tracking-[1px] text-[#6e6e73] uppercase mb-2">
              Recent sales
            </p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {sales.sales.slice(-10).reverse().map((s) => (
                <div
                  key={s.orderId}
                  className="flex items-center justify-between rounded-lg bg-[#f5f5f7] px-3 py-2 text-[12px]"
                >
                  <div>
                    <span className="font-medium text-[#1d1d1f]">#{s.orderId}</span>
                    <span className="ml-2 text-[#6e6e73]">{s.source}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-[#1d1d1f]">{fmtUsd(s.amountUsd)}</span>
                    <span className="ml-2 text-[#f97316]">→ {fmtUsd(s.depositAmountUsd)}</span>
                    <span className={`ml-2 ${s.depositStatus === "confirmed" ? "text-[#34c759]" : "text-[#6e6e73]"}`}>
                      {s.depositStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual deposit (admin / ops) */}
      <div className="rounded-[22px] border border-[#d2d2d7] bg-white px-6 py-7">
        <p className="text-[10px] font-semibold tracking-[1.5px] text-[#6e6e73] uppercase">
          Deposit revenue
        </p>
        <h3 className="mt-2 text-[17px] font-bold text-[#1d1d1f]">
          Add to treasury balance
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
          Deposit ETH into the revnet via <code className="text-[11px] bg-[#f5f5f7] px-1 py-0.5 rounded">addToBalanceOf</code>.
          This backs existing $JUICE holders without minting new tokens.
        </p>

        {!REVNET_READY ? (
          <p className="mt-4 text-center text-[13px] text-[#6e6e73]">
            Revnet not deployed yet. Set NEXT_PUBLIC_REVNET_PROJECT_ID and
            NEXT_PUBLIC_JB_MULTI_TERMINAL.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block rounded-xl bg-[#f5f5f7] px-4 py-3">
              <span className="text-[12px] text-[#6e6e73]">Amount (ETH)</span>
              <input
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="mt-1 w-full bg-transparent text-[20px] font-semibold text-[#1d1d1f] outline-none"
              />
            </label>
            <input
              value={depositMemo}
              onChange={(e) => setDepositMemo(e.target.value)}
              placeholder="Memo (e.g. 'October juice sales batch')"
              className="w-full rounded-xl border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#f97316]"
            />

            {isSuccess && (
              <p className="text-center text-[13px] font-medium text-[#34c759]">
                Deposited — existing $JUICE holders are backed.
              </p>
            )}
            {writeError && (
              <p className="text-center text-[13px] text-[#ff3b30]">
                {writeError.message?.slice(0, 120)}
              </p>
            )}

            {!isConnected ? (
              showWallets ? (
                <div className="space-y-2">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={connecting}
                      onClick={() => connect({ connector })}
                      className="w-full rounded-full border border-[#d2d2d7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
                    >
                      {connecting ? "Connecting…" : connectorLabel(connector)}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowWallets(true)}
                  className="w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-[15px] font-semibold text-white hover:bg-black"
                >
                  Connect wallet
                </button>
              )
            ) : onWrongChain ? (
              <button
                type="button"
                onClick={() => switchChain({ chainId: baseChain.id })}
                className="w-full rounded-full bg-[#1d1d1f] px-5 py-3 text-[15px] font-semibold text-white hover:bg-black"
              >
                Switch to Base
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || isSuccess}
                onClick={handleDeposit}
                className="w-full rounded-full bg-[#f97316] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#ea580c] disabled:opacity-40"
              >
                {busy
                  ? confirming ? "Confirming…" : "Confirm in wallet…"
                  : "Deposit to treasury"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
