import { copy } from "@/lib/copy";
import { titleArtSrc, type TitleId } from "@/lib/profile-titles";

/** Showcase pill for profile / share — image when art exists, else text name. */
export function TitleBadge({
  titleId,
  size = "md",
  className = "",
}: {
  titleId: TitleId;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const name = copy.profile.titles[titleId].name;
  const src = titleArtSrc(titleId);

  if (src) {
    const height =
      size === "lg" ? "h-10" : size === "sm" ? "h-7" : "h-8";
    const maxW =
      size === "lg"
        ? "max-w-[220px]"
        : size === "sm"
          ? "max-w-[150px]"
          : "max-w-[180px]";
    return (
      <img
        src={src}
        alt={name}
        className={[
          height,
          maxW,
          "w-auto object-contain object-left",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  return (
    <span
      className={[
        "inline-block text-[13px] font-medium text-[#1d1d1f]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {name}
    </span>
  );
}
