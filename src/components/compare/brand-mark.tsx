// Brand marks. The symbols live in one inline sprite in the layout (copied
// byte for byte from the verified page), and each mark is a <use> reference to
// it, so there is exactly one copy of every path.
//   Command Code: the symbol published on commandcode.ai/brand.
//   OpenCode: the app icon published on opencode.ai/brand.
//   DeepSeek: from the Simple Icons set. It has no tile behind it, so it takes
//   the text colour and has to fill its box, scaled and recentred rather than
//   inset.

const SYMBOLS = {
  opencode: "mark-oc",
  commandcode: "mark-cc",
  deepseek: "mark-ds",
} as const;

export type MarkId = keyof typeof SYMBOLS;

/** A plan's mark in its fixed slot. One slot for all three, so a wide wordmark
 *  and a square icon align. The two framed marks sit in a rounded tile; the
 *  DeepSeek whale has no tile, so it fills its box at text colour. */
export function BrandMark({ id, small }: { id: MarkId; small?: boolean }) {
  const framed = id !== "deepseek";
  const size = small ? 18 : 24;
  return (
    <span
      className={`mark-slot inline-flex flex-none items-center ${small ? "gap-[7px]" : "gap-2"}`}
    >
      <span
        className={
          framed
            ? "inline-flex items-center justify-center overflow-hidden rounded-md border border-border"
            : "inline-flex items-center justify-center text-foreground"
        }
        style={{ width: size, height: size }}
      >
        <svg
          className={id === "deepseek" ? "scale-[1.25]" : "h-full w-full"}
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          <use href={`#${SYMBOLS[id]}`} />
        </svg>
      </span>
    </span>
  );
}
