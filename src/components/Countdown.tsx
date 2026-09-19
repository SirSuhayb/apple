"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";

export function Countdown({
  secondsLeft,
  deadline,
  urgent = false,
}: {
  secondsLeft: number;
  deadline: number;
  urgent?: boolean;
}) {
  const [left, setLeft] = useState(secondsLeft);
  const labels = copy.core.countdown;

  useEffect(() => {
    setLeft(secondsLeft);
    const id = setInterval(() => {
      const next = Math.max(0, deadline - Math.floor(Date.now() / 1000));
      setLeft(next);
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft, deadline]);

  const days = Math.floor(left / 86_400);
  const hours = Math.floor((left % 86_400) / 3600);
  const mins = Math.floor((left % 3600) / 60);
  const secs = left % 60;

  const numClass = urgent
    ? "text-[#e53935]"
    : "text-[#1d1d1f]";

  const cell = (value: number, label: string) => (
    <div className="flex flex-col items-center text-center">
      <span
        className={[
          "text-[36px] font-extrabold leading-none tabular-nums",
          numClass,
        ].join(" ")}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] tracking-[1.5px] text-[#6e6e73] uppercase">
        {label}
      </span>
    </div>
  );

  return (
    <div
      className={[
        "flex items-end justify-center gap-5",
        urgent && left < 3600 ? "animate-pulse" : "",
      ].join(" ")}
    >
      {cell(days, labels[0])}
      {cell(hours, labels[1])}
      {cell(mins, labels[2])}
      {cell(secs, labels[3])}
    </div>
  );
}
