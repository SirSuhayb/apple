import { appleAvatarFor } from "@/lib/apple-avatar";

const SIZES = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 64,
  xl: 80,
} as const;

export type AppleAvatarSize = keyof typeof SIZES;

export function AppleAvatar({
  address,
  size = "sm",
  className = "",
}: {
  address: string;
  size?: AppleAvatarSize | number;
  className?: string;
}) {
  const avatar = appleAvatarFor(address);
  const px = typeof size === "number" ? size : SIZES[size];
  return (
    <span
      className={[
        "relative inline-block shrink-0 overflow-hidden rounded-full",
        "shadow-[inset_0_0_0_1px_rgba(29,29,31,0.08)]",
        className,
      ].join(" ")}
      style={{ width: px, height: px, backgroundColor: avatar.color }}
      aria-hidden
    >
      <img
        src={avatar.src}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full object-contain"
        style={{ transform: "scale(0.84)" }}
      />
    </span>
  );
}
