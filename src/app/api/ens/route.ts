import { NextResponse } from "next/server";
import { normalizeEnsAddresses, resolveEnsNames } from "@/lib/ens-server";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
};

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const addresses = normalizeEnsAddresses(
    body && typeof body === "object" && "addresses" in body
      ? (body as { addresses: unknown }).addresses
      : null,
  );
  const names = await resolveEnsNames(addresses);
  return NextResponse.json({ names }, { headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("addresses") ?? url.searchParams.get("a") ?? "";
  const addresses = normalizeEnsAddresses(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const names = await resolveEnsNames(addresses);
  return NextResponse.json({ names }, { headers });
}
