import {
  SWAP_PORTION_SUPPORTED,
  SWAP_SLIPPAGE_PERCENT,
  UNISWAP_ROUTER_VERSION,
  UNISWAP_TRADE_CHAIN_ID,
  swapIntegratorFees,
} from "./uniswap-trade";

const TRADE_API = "https://trade-api.gateway.uniswap.org/v1";

/** Human-mediated: user reviews and confirms each swap in their wallet. */
const AGENT_INFO = JSON.stringify({
  integration_name: "swap-integration",
  decision_origin: "human_mediated",
  version: "1.5.0",
});

const ALLOWED_PATHS = new Set(["quote", "swap", "check_approval"]);

/** Quote always sends kitchen integratorFees. /swap echoes them if omitted. */
function withIntegratorFees(path: string, body: unknown): unknown {
  if (path !== "quote" && path !== "swap") return body;
  if (!SWAP_PORTION_SUPPORTED) return body;
  if (!body || typeof body !== "object") return body;
  const current = body as Record<string, unknown>;
  if (Array.isArray(current.integratorFees) && current.integratorFees.length > 0) {
    return current;
  }
  const integratorFees = swapIntegratorFees();
  if (!integratorFees.length) return current;
  return { ...current, integratorFees };
}

function apiKey(): string {
  const key = process.env.UNISWAP_API_KEY?.trim();
  if (!key) {
    throw new Error("Swap quotes are not configured.");
  }
  return key;
}

function sanitizeUpstreamError(value: unknown): string {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "detail" in value
        ? String((value as { detail: unknown }).detail)
        : value && typeof value === "object" && "message" in value
          ? String((value as { message: unknown }).message)
          : value && typeof value === "object" && "error" in value
            ? String((value as { error: unknown }).error)
            : "Uniswap request failed";
  const key = process.env.UNISWAP_API_KEY;
  return key && raw.includes(key) ? "Uniswap request failed" : raw.slice(0, 280);
}

export async function tradeApiPost(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  if (!ALLOWED_PATHS.has(path)) {
    return { ok: false, status: 404, json: { error: "Not found" } };
  }

  const key = apiKey();
  const payload = withIntegratorFees(path, body);
  let res: Response;
  try {
    res = await fetch(`${TRADE_API}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": key,
        "x-universal-router-version": UNISWAP_ROUTER_VERSION,
        "x-agent-info": AGENT_INFO,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, json: { error: "Uniswap unreachable" } };
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = { error: "Invalid Uniswap response" };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      json: { error: sanitizeUpstreamError(json) },
    };
  }

  return { ok: true, status: res.status, json };
}

export function assertRobinhoodChain(chainId: unknown): void {
  const n = typeof chainId === "string" ? Number(chainId) : chainId;
  if (n !== UNISWAP_TRADE_CHAIN_ID) {
    throw new Error("Unsupported chain");
  }
}

export { SWAP_SLIPPAGE_PERCENT };
