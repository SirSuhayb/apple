"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type TouchEvent,
} from "react";
import { copy } from "@/lib/copy";
import {
  appleLooksRotting,
  DECAY_FLOOR_NEXT_WEEK_USD,
  DECAY_FLOOR_THIS_WEEK_USD,
} from "@/lib/decay";
import { formatFloorUsd } from "@/lib/decay-week";
import type { DecayFloors } from "@/lib/decay-week";

type AppleConditionBannerProps = {
  decay: number;
  floors?: DecayFloors | null;
};

const SLIDES = copy.decay.slides;
const LAST = SLIDES.length - 1;
const SWIPE_PX = 40;
const FRESH_CUTOUT = "/apple/cutouts/frame-00.png";
const ROT_GIF = "/apple/rot-loop.gif";

function resolveFloors(floors?: DecayFloors | null): {
  thisWeekUsd: number;
  nextWeekUsd: number;
  thisWeekLabel: string;
  nextWeekLabel: string;
} {
  const thisWeekUsd = floors?.thisWeekUsd ?? DECAY_FLOOR_THIS_WEEK_USD;
  const nextWeekUsd = floors?.nextWeekUsd ?? DECAY_FLOOR_NEXT_WEEK_USD;
  return {
    thisWeekUsd,
    nextWeekUsd,
    thisWeekLabel: floors?.thisWeekLabel ?? formatFloorUsd(thisWeekUsd),
    nextWeekLabel: floors?.nextWeekLabel ?? formatFloorUsd(nextWeekUsd),
  };
}

/** Hero strip: FRESH vs ROTTING looks. Not kitchen revealCore / revealRot. */
export function AppleConditionBanner({
  decay,
  floors,
}: AppleConditionBannerProps) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const titleId = useId();
  const rotting = appleLooksRotting(decay);
  const line = rotting ? copy.decay.bannerRotting : copy.decay.bannerFresh;
  const liveFloors = resolveFloors(floors);

  const close = useCallback(() => {
    setOpen(false);
    setSlide(0);
  }, []);

  const go = useCallback((next: number) => {
    setSlide(Math.min(LAST, Math.max(0, next)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") {
        if (slide >= LAST) close();
        else go(slide + 1);
      }
      if (e.key === "ArrowLeft") go(slide - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slide, close, go]);

  return (
    <>
      <div
        className={[
          "page-gutter border-b py-2.5",
          rotting
            ? "border-[#c4a574]/40 bg-[#8a5a2b]/8"
            : "border-[#34c759]/25 bg-[#34c759]/10",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-[980px] items-center justify-center gap-2">
          <p
            className={[
              "text-center text-[13px] font-semibold tracking-wide",
              rotting ? "text-[#8a5a2b]" : "text-[#248a3d]",
            ].join(" ")}
            role="status"
          >
            {line}
          </p>
          <button
            type="button"
            onClick={() => {
              setSlide(0);
              setOpen(true);
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#d2d2d7] text-[11px] font-bold text-[#6e6e73]"
            aria-label={copy.decay.tooltipLabel}
          >
            ?
          </button>
        </div>
      </div>
      {open && (
        <ConditionCarousel
          slide={slide}
          titleId={titleId}
          floors={liveFloors}
          onClose={close}
          onGo={go}
        />
      )}
    </>
  );
}

function ConditionCarousel({
  slide,
  titleId,
  floors,
  onClose,
  onGo,
}: {
  slide: number;
  titleId: string;
  floors: ReturnType<typeof resolveFloors>;
  onClose: () => void;
  onGo: (n: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const item = SLIDES[slide];
  const isLast = slide >= LAST;
  const body =
    slide === LAST
      ? [copy.decay.floorSlideBody(floors.thisWeekLabel, floors.nextWeekLabel)]
      : item.body;

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (dx > SWIPE_PX) onGo(slide - 1);
    else if (dx < -SWIPE_PX) {
      if (isLast) onClose();
      else onGo(slide + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[400px] rounded-[20px] bg-[#fbfbfd] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.15)] sm:p-7"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <span id={titleId} className="text-[19px] font-bold text-[#1d1d1f]">
            {copy.decay.modalTitle}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f7] text-base text-[#6e6e73]"
            aria-label={copy.tap.modal.close}
          >
            ×
          </button>
        </div>

        <SlideVisual slide={slide} floors={floors} />

        <h3 className="text-[19px] font-bold tracking-[-0.02em] text-[#1d1d1f]">
          {item.title}
        </h3>
        <div className="mt-2.5 min-h-[5.5rem] space-y-2 text-[15px] leading-relaxed text-[#6e6e73]">
          {body.map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onGo(slide - 1)}
            disabled={slide === 0}
            className="text-[15px] font-medium text-[#2997ff] disabled:opacity-30"
          >
            {copy.decay.modalPrev}
          </button>
          <div className="flex items-center gap-1.5" role="tablist">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === slide}
                aria-label={s.title}
                onClick={() => onGo(i)}
                className={[
                  "h-1.5 rounded-full transition-[width,background-color]",
                  i === slide ? "w-4 bg-[#1d1d1f]" : "w-1.5 bg-[#d2d2d7]",
                ].join(" ")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (isLast ? onClose() : onGo(slide + 1))}
            className="text-[15px] font-semibold text-[#2997ff]"
          >
            {isLast ? copy.decay.modalDone : copy.decay.modalNext}
          </button>
        </div>
      </div>
    </div>
  );
}

function SlideVisual({
  slide,
  floors,
}: {
  slide: number;
  floors: ReturnType<typeof resolveFloors>;
}) {
  if (slide === 0) {
    return (
      <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f5f5f7]">
        <Image
          src={FRESH_CUTOUT}
          alt="A fresh whole apple"
          fill
          sizes="360px"
          className="object-contain p-4"
        />
      </div>
    );
  }
  if (slide === 1) {
    return (
      <div className="relative mb-4 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f5f5f7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key="rot-gif"
          src={ROT_GIF}
          alt="The apple turning brown"
          className="h-full w-auto max-h-[220px] object-contain p-4"
        />
      </div>
    );
  }
  return <FloorChart floors={floors} />;
}

function FloorChart({
  floors,
}: {
  floors: ReturnType<typeof resolveFloors>;
}) {
  // 4:3 viewBox matches the card so overlay apples share the plot coordinates.
  const vb = { w: 320, h: 240 };
  const plot = { left: 56, right: 292, top: 56, bottom: 176 };
  const topUsd = Math.max(floors.thisWeekUsd, floors.nextWeekUsd, 1);
  const yAt = (usd: number) =>
    plot.bottom - (usd / topUsd) * (plot.bottom - plot.top);
  const xThis = 110;
  const xNext = 236;
  const yThis = yAt(floors.thisWeekUsd);
  const yNext = yAt(floors.nextWeekUsd);
  const apples = [
    { x: xThis, y: yThis, delay: "0.18s" },
    { x: xNext, y: yNext, delay: "0.55s" },
  ] as const;

  return (
    <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f5f5f7]">
      <svg
        viewBox={`0 0 ${vb.w} ${vb.h}`}
        className="h-full w-full"
        role="img"
        aria-label={`Market floor rising from ${floors.thisWeekLabel} this week to ${floors.nextWeekLabel} next week`}
      >
        <line
          x1={plot.left}
          y1={plot.top}
          x2={plot.left}
          y2={plot.bottom}
          stroke="#d2d2d7"
          strokeWidth="1"
        />
        <line
          x1={plot.left}
          y1={plot.bottom}
          x2={plot.right}
          y2={plot.bottom}
          stroke="#d2d2d7"
          strokeWidth="1"
        />
        <line
          x1={plot.left}
          y1={yThis}
          x2={plot.right}
          y2={yThis}
          stroke="#ececef"
          strokeWidth="1"
        />
        <line
          x1={plot.left}
          y1={yNext}
          x2={plot.right}
          y2={yNext}
          stroke="#ececef"
          strokeWidth="1"
        />
        <text
          x={plot.left - 8}
          y={plot.bottom + 4}
          textAnchor="end"
          fontSize="10"
          fill="#86868b"
        >
          0
        </text>
        <text
          x={plot.left - 8}
          y={yThis + 4}
          textAnchor="end"
          fontSize="10"
          fill="#86868b"
        >
          {floors.thisWeekLabel}
        </text>
        <text
          x={plot.left - 8}
          y={yNext + 4}
          textAnchor="end"
          fontSize="10"
          fill="#86868b"
        >
          {floors.nextWeekLabel}
        </text>
        <line
          className="floor-chart-line"
          x1={xThis}
          y1={yThis}
          x2={xNext}
          y2={yNext}
          stroke="#8a5a2b"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
        />
        <text
          x={xThis}
          y={plot.bottom + 28}
          textAnchor="middle"
          fontSize="11"
          fill="#6e6e73"
        >
          This week
        </text>
        <text
          x={xNext}
          y={plot.bottom + 28}
          textAnchor="middle"
          fontSize="11"
          fill="#6e6e73"
        >
          Next week
        </text>
      </svg>
      {apples.map((apple) => (
        <span
          key={`${apple.x}-${apple.y}`}
          className="pointer-events-none absolute"
          style={{
            left: `${(apple.x / vb.w) * 100}%`,
            top: `${(apple.y / vb.h) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <span
            className="floor-chart-apple text-[22px] leading-none"
            style={{ animationDelay: apple.delay }}
            aria-hidden
          >
            🍎
          </span>
        </span>
      ))}
    </div>
  );
}
