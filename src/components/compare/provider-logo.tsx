// A model's provider mark, read off the model name. The symbols live in one
// inline sprite in the layout (public marks, one copy of every path), so a
// 64-row table references paths that ship once. A model with no provider —
// the catalogue's house models — renders a plain spark glyph: nothing boxed,
// because a letter in a tile reads as a brand mark, and inventing one for a
// maker that does not exist would be a lie with good manners.

import { Sparkle } from "lucide-react";

import { providerOf } from "./providers";

export function ProviderLogo({
  name,
  size = 16,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const id = providerOf(name);
  return (
    <span
      aria-hidden
      className={
        "inline-flex flex-none items-center justify-center text-muted-foreground " + className
      }
      style={{ width: size, height: size }}
    >
      {id ? (
        <svg width={size} height={size} focusable="false">
          <use href={`#p-${id}`} />
        </svg>
      ) : (
        <Sparkle
          size={Math.max(10, Math.round(size * 0.62))}
          className="text-muted-foreground/60"
        />
      )}
    </span>
  );
}
