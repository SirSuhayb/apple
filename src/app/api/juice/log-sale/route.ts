import { NextResponse } from "next/server";

/**
 * POST /api/juice/log-sale
 *
 * Log a real-world juice brand sale. The server validates the sale and
 * deposits part of the revenue into the revnet via `addToBalanceOf`.
 *
 * In production this endpoint would be called by a Shopify webhook,
 * POS integration, or manual admin entry. The deposit itself happens
 * server-side with a hot wallet (JUICE_OPS_KEY) or is queued for
 * a multisig batch.
 *
 * Body:
 *   orderId    — external order identifier (Shopify order #, POS receipt, etc.)
 *   amountUsd  — gross sale amount in USD
 *   revSharePct — percentage of sale routed to the revnet (e.g. 10)
 *   items      — array of { name, qty, priceUsd }
 *   source     — "shopify" | "pos" | "manual"
 *   timestamp  — ISO 8601 (optional, defaults to now)
 *
 * Response:
 *   { logged: true, orderId, depositAmountUsd, depositStatus }
 *
 * depositStatus is "queued" until the onchain addToBalanceOf tx is confirmed,
 * then "confirmed" with a txHash.
 */

export const dynamic = "force-dynamic";

const API_SECRET = process.env.JUICE_SALES_API_SECRET?.trim();

type SaleItem = { name: string; qty: number; priceUsd: number };

type SalePayload = {
  orderId: string;
  amountUsd: number;
  revSharePct: number;
  items: SaleItem[];
  source: "shopify" | "pos" | "manual";
  timestamp?: string;
};

type SaleRecord = SalePayload & {
  loggedAt: string;
  depositAmountUsd: number;
  depositStatus: "queued" | "confirmed";
  txHash?: string;
};

/**
 * In-memory store for this prototype. Production would persist to a database
 * and trigger an onchain addToBalanceOf transaction.
 */
const sales: SaleRecord[] = [];

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (API_SECRET && authHeader !== `Bearer ${API_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SalePayload;
  try {
    payload = (await request.json()) as SalePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.orderId || typeof payload.amountUsd !== "number" || payload.amountUsd <= 0) {
    return NextResponse.json({ error: "Missing orderId or invalid amountUsd" }, { status: 400 });
  }

  if (typeof payload.revSharePct !== "number" || payload.revSharePct < 0 || payload.revSharePct > 100) {
    return NextResponse.json({ error: "revSharePct must be 0-100" }, { status: 400 });
  }

  if (sales.some((s) => s.orderId === payload.orderId)) {
    return NextResponse.json({ error: "Duplicate orderId" }, { status: 409 });
  }

  const depositAmountUsd = (payload.amountUsd * payload.revSharePct) / 100;

  const record: SaleRecord = {
    ...payload,
    loggedAt: new Date().toISOString(),
    depositAmountUsd,
    depositStatus: "queued",
  };

  sales.push(record);

  // In production: convert depositAmountUsd to ETH at market rate,
  // then call JBMultiTerminal.addToBalanceOf(projectId, JB_NATIVE_TOKEN, ...)
  // with a memo like "Juice brand sale: order #${orderId}"

  return NextResponse.json({
    logged: true,
    orderId: payload.orderId,
    depositAmountUsd,
    depositStatus: "queued",
  });
}

/** GET /api/juice/log-sale — list all logged sales (public read). */
export async function GET() {
  const totalSalesUsd = sales.reduce((sum, s) => sum + s.amountUsd, 0);
  const totalDepositsUsd = sales.reduce((sum, s) => sum + s.depositAmountUsd, 0);
  const confirmedDepositsUsd = sales
    .filter((s) => s.depositStatus === "confirmed")
    .reduce((sum, s) => sum + s.depositAmountUsd, 0);

  return NextResponse.json({
    salesCount: sales.length,
    totalSalesUsd,
    totalDepositsUsd,
    confirmedDepositsUsd,
    sales: sales.map((s) => ({
      orderId: s.orderId,
      amountUsd: s.amountUsd,
      depositAmountUsd: s.depositAmountUsd,
      depositStatus: s.depositStatus,
      txHash: s.txHash,
      source: s.source,
      loggedAt: s.loggedAt,
      itemCount: s.items?.length ?? 0,
    })),
  });
}
