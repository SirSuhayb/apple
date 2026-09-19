import { type Hex, isAddress, keccak256 } from "viem";
import { FRAME_COUNT } from "./race";

/**
 * Apple flesh / skin backdrop palette — Pink Lady blush, Red Delicious / candy,
 * Granny Smith. Deterministic per wallet so the same eater looks the same on
 * the home mini-board, /leaderboard, Your Rank, and share chips.
 */
export const APPLE_AVATAR_COLORS = [
  { name: "pink-lady", hex: "#F3C4C0" },
  { name: "blush", hex: "#E8B4B0" },
  { name: "honeycrisp", hex: "#F7D0C8" },
  { name: "petal", hex: "#D9928C" },
  { name: "red-delicious", hex: "#C4453C" },
  { name: "candy", hex: "#D45A52" },
  { name: "gala", hex: "#E07068" },
  { name: "crimson", hex: "#A8332C" },
  { name: "granny-smith", hex: "#A8C47A" },
  { name: "pippin", hex: "#C5D4A4" },
  { name: "orchard", hex: "#8FB05C" },
  { name: "leaf", hex: "#B7C98E" },
] as const;

export type AppleAvatarColor = (typeof APPLE_AVATAR_COLORS)[number];

export type AppleAvatar = {
  frame: number;
  src: string;
  color: string;
  colorName: string;
};

const COLOR_COUNT = APPLE_AVATAR_COLORS.length;

function fnv1a(s: string): bigint {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return BigInt(h >>> 0);
}

/** Stable 256-bit id from the wallet — keccak of the 20-byte address. */
export function walletAvatarHash(address: string): bigint {
  const key = address.trim().toLowerCase();
  if (isAddress(key, { strict: false })) {
    return BigInt(keccak256(key as Hex));
  }
  return fnv1a(key);
}

export function appleAvatarFor(address: string): AppleAvatar {
  const h = walletAvatarHash(address);
  const frame = Number(h % BigInt(FRAME_COUNT));
  const colorIndex = Number((h / BigInt(FRAME_COUNT)) % BigInt(COLOR_COUNT));
  const color = APPLE_AVATAR_COLORS[colorIndex] ?? APPLE_AVATAR_COLORS[0];
  return {
    frame,
    src: `/apple/cutouts/frame-${String(frame).padStart(2, "0")}.png`,
    color: color.hex,
    colorName: color.name,
  };
}

export function cutoutSrc(frame: number): string {
  const n = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(frame)));
  return `/apple/cutouts/frame-${String(n).padStart(2, "0")}.png`;
}
