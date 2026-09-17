"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { challengeCopy as c } from "@/lib/challenge-copy";
import { socialLinks } from "@/lib/copy";

const HERO_FRAMES = [
  "/apple/stills/frame-01.png",
  "/apple/stills/frame-03.png",
  "/apple/stills/frame-05.png",
  "/apple/stills/frame-07.png",
] as const;

export function ChallengePage() {
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrameIdx((i) => (i + 1) % HERO_FRAMES.length);
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfbfd] text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-[#d2d2d7] bg-[rgba(251,251,253,0.82)] backdrop-blur-[20px] backdrop-saturate-150">
        <div className="page-gutter mx-auto flex h-12 max-w-[980px] items-center justify-between">
          <Link href="/" className="text-[17px] font-semibold">
            {c.brand}
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[13px] font-medium text-[#2997ff]"
            >
              {c.nav.home}
            </Link>
            <a
              href="#enter"
              className="rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
            >
              {c.nav.enter}
            </a>
          </div>
        </div>
      </header>

      {/* Hero — one composition: brand, line, support, CTAs, full-bleed apple */}
      <section
        id="top"
        className="relative isolate flex min-h-[100svh] flex-col overflow-hidden"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 35%, #fff5f4 0%, #fbfbfd 55%, #f0f4f8 100%)",
          }}
        />
        <div
          aria-hidden
          className="challenge-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        />

        <div className="page-gutter relative mx-auto flex w-full max-w-[980px] flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
          <p className="animate-rise text-[12px] font-semibold tracking-[0.18em] text-[#e53935] uppercase">
            {c.badge}
          </p>
          <h1 className="animate-rise-delay-1 mt-2 text-[clamp(52px,12vw,88px)] font-bold leading-none tracking-[-0.04em]">
            {c.brand}
          </h1>
          <p className="animate-rise-delay-1 mt-2.5 text-[clamp(20px,4vw,30px)] font-medium tracking-[-0.02em] text-[#1d1d1f]">
            {c.hero.headline}
          </p>
          <p className="animate-rise-delay-2 mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-[#6e6e73] sm:text-[16px]">
            {c.hero.support}
          </p>

          <div className="animate-fade relative mx-auto mt-1 w-full max-w-[520px]">
            <div className="challenge-apple-glow absolute inset-[14%] rounded-full bg-[#e53935]/10 blur-3xl" />
            <div className="relative mx-auto aspect-square w-[min(100%,min(42svh,400px))]">
              {HERO_FRAMES.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="(max-width: 640px) 90vw, 400px"
                  className={[
                    "object-contain transition-opacity duration-500",
                    i === frameIdx ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>

          <div className="animate-rise-delay-3 mt-1 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#enter"
              className="rounded-full bg-[#1d1d1f] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-black"
            >
              {c.hero.ctaPrimary}
            </a>
            <a
              href={c.kit.href}
              download
              className="text-[15px] text-[#2997ff] no-underline"
            >
              {c.hero.ctaKit}
            </a>
            <a
              href="#brief"
              className="text-[15px] text-[#2997ff] no-underline"
            >
              {c.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </section>

      {/* Prizes */}
      <section
        id="prizes"
        className="page-gutter border-t border-[#d2d2d7] bg-[#f5f5f7] py-20 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.prizes.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.prizes.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#86868b]">
          {c.prizes.support}
        </p>

        <ol className="mx-auto mt-12 max-w-[520px] text-left">
          {c.prizes.tiers.map((tier, i) => (
            <li
              key={tier.place}
              className="challenge-tier flex items-baseline justify-between gap-4 border-b border-[#d2d2d7] py-4 first:border-t"
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[13px] text-[#86868b]">
                  {tier.place}
                </span>
                <span className="text-[15px] text-[#6e6e73]">{tier.note}</span>
              </div>
              <span
                className={[
                  "text-right text-[18px] font-bold tracking-[-0.02em] tabular-nums sm:text-[20px]",
                  i === 0 ? "text-[#e53935]" : "text-[#1d1d1f]",
                ].join(" ")}
              >
                {tier.amount}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Starter kit */}
      <section
        id="kit"
        className="page-gutter py-20 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.kit.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.kit.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#86868b]">
          {c.kit.support}
        </p>
        <a
          href={c.kit.href}
          download
          className="mt-8 inline-block rounded-full bg-[#1d1d1f] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black"
        >
          {c.kit.cta}
        </a>
        <p className="mx-auto mt-4 max-w-[380px] text-[12px] leading-relaxed text-[#86868b]">
          {c.kit.fine}
        </p>
      </section>

      {/* Brief */}
      <section
        id="brief"
        className="page-gutter py-20 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.brief.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.brief.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#86868b]">
          {c.brief.support}
        </p>
        <ul className="mx-auto mt-10 max-w-[480px] space-y-4 text-left">
          {c.brief.must.map((line) => (
            <li
              key={line}
              className="flex gap-3 text-[16px] leading-relaxed text-[#1d1d1f]"
            >
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#e53935]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Surfaces */}
      <section
        id="surfaces"
        className="page-gutter border-t border-[#d2d2d7] bg-[#f5f5f7] py-20 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.surfaces.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.surfaces.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[420px] text-[17px] leading-relaxed text-[#86868b]">
          {c.surfaces.support}
        </p>

        <div className="mx-auto mt-12 max-w-[720px] divide-y divide-[#d2d2d7] border-y border-[#d2d2d7] text-left">
          {c.surfaces.items.map((item) => (
            <div
              key={item.title}
              className="grid gap-1 py-5 sm:grid-cols-[140px_1fr] sm:gap-6"
            >
              <div>
                <div className="text-[17px] font-semibold">{item.title}</div>
                <div className="mt-0.5 font-mono text-[11px] text-[#86868b]">
                  {item.path}
                </div>
              </div>
              <p className="text-[15px] leading-relaxed text-[#6e6e73] sm:pt-0.5">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section id="rules" className="page-gutter py-20 text-center">
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.rules.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.rules.headline}
        </h2>
        <ol className="mx-auto mt-10 max-w-[520px] list-decimal space-y-4 pl-5 text-left text-[16px] leading-relaxed text-[#1d1d1f] marker:text-[#86868b]">
          {c.rules.items.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      {/* Judging */}
      <section
        id="judging"
        className="page-gutter border-t border-[#d2d2d7] bg-[#f5f5f7] py-20 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.judging.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.judging.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#86868b]">
          {c.judging.support}
        </p>

        <div className="mx-auto mt-12 max-w-[640px] space-y-8 text-left">
          {c.judging.criteria.map((row) => (
            <div key={row.title}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-[18px] font-semibold tracking-[-0.01em]">
                  {row.title}
                </h3>
                <span className="font-mono text-[13px] font-medium text-[#e53935]">
                  {row.weight}
                </span>
              </div>
              <div className="mb-2 h-[3px] overflow-hidden rounded-full bg-[#d2d2d7]">
                <div
                  className="progress-fill h-full rounded-full bg-[#e53935]"
                  style={{ width: `${row.weight}%` }}
                />
              </div>
              <p className="text-[15px] leading-relaxed text-[#6e6e73]">
                {row.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section id="timeline" className="page-gutter py-20 text-center">
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.timeline.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.timeline.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[420px] text-[17px] leading-relaxed text-[#86868b]">
          {c.timeline.support}
        </p>

        <ol className="mx-auto mt-12 max-w-[480px] text-left">
          {c.timeline.steps.map((step, i) => (
            <li
              key={step.label}
              className="relative flex gap-5 pb-10 last:pb-0"
            >
              {i < c.timeline.steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-3 left-[11px] h-[calc(100%-12px)] w-px bg-[#d2d2d7]"
                />
              )}
              <span className="relative z-10 mt-1 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border border-[#d2d2d7] bg-white text-[11px] font-semibold text-[#86868b]">
                {i + 1}
              </span>
              <div>
                <div className="text-[17px] font-semibold">{step.label}</div>
                <div className="mt-1 text-[15px] leading-relaxed text-[#86868b]">
                  {step.detail}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Find us */}
      <section
        id="channels"
        className="page-gutter border-t border-[#d2d2d7] bg-[#f5f5f7] py-20 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.findUs.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.findUs.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[460px] text-[17px] leading-relaxed text-[#86868b]">
          {c.findUs.support}
        </p>

        <ul className="mx-auto mt-10 flex max-w-[520px] flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {c.findUs.places.map((place) => (
            <li key={place.name}>
              <a
                href={place.href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex flex-col items-center"
              >
                <span className="text-[17px] font-semibold text-[#2997ff] group-hover:underline">
                  {place.name}
                </span>
                <span className="mt-0.5 text-[12px] text-[#86868b]">
                  {place.note}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Enter */}
      <section
        id="enter"
        className="page-gutter py-24 text-center"
      >
        <p className="mb-2.5 text-xs font-semibold tracking-[1.5px] text-[#86868b] uppercase">
          {c.submit.eyebrow}
        </p>
        <h2 className="text-[clamp(28px,6vw,42px)] font-bold leading-[1.1] tracking-[-0.02em]">
          {c.submit.headline}
        </h2>
        <p className="mx-auto mt-3.5 max-w-[420px] text-[17px] leading-relaxed text-[#86868b]">
          {c.submit.support}
        </p>
        <a
          href={socialLinks.telegram}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-block rounded-full bg-[#e53935] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#c62828]"
        >
          {c.submit.cta}
        </a>
        <p className="mx-auto mt-5 max-w-[380px] text-[12px] leading-relaxed text-[#86868b]">
          {c.submit.fine}
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
