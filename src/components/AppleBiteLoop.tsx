"use client";

import { useEffect, useState } from "react";
import { FRAME_COUNT } from "@/lib/race";

/**
 * Fast stop-motion of the Eydeet apple (same 0→9 stages as AppleScene /
 * FRAME_FIT_SCALE). Uses the already-baked still rasters so the swap modal
 * does not mount a second WebGL canvas or pull the GLBs again.
 */
const STILL_URL = (n: number) =>
  `/apple/stills/frame-${String(n).padStart(2, "0")}.png`;

/** Homepage time-lapse is 550ms/frame; pending swap should chomp. */
const SWAP_FRAME_MS = 70;

export function AppleBiteLoop({ className }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = STILL_URL(i);
    }
    const id = window.setInterval(() => {
      setFrame((prev) => (prev >= FRAME_COUNT - 1 ? 0 : prev + 1));
    }, SWAP_FRAME_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={[
        "relative mx-auto h-[148px] w-[188px] overflow-hidden",
        className ?? "",
      ].join(" ")}
      aria-hidden
    >
      {Array.from({ length: FRAME_COUNT }, (_, i) => (
        <img
          key={i}
          src={STILL_URL(i)}
          alt=""
          draggable={false}
          className={[
            "pointer-events-none absolute inset-0 h-[168%] w-full object-contain object-[center_36%]",
            i === frame ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
