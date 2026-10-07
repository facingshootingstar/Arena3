import { useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Arena3's former effect layer, now a set of quiet stand-ins.
 *
 * The app used to dress cards, headings and buttons in pointer spotlights, light sweeps, magnets,
 * shimmering text, orbiting borders, WebGL backgrounds and a spark on every click. None of it said
 * anything about a court, a booking or a payment, and together it kept a phone's CPU busy while
 * nobody touched the screen. The exports keep their old signatures so existing call sites still
 * compile, but each one now renders its content plainly. New code should not reach for these:
 * use a `Card`, a heading and a `Button` directly.
 */

export function SpotlightCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  strength?: number;
  size?: number;
  as?: ElementType;
}) {
  return <Tag className={className}>{children}</Tag>;
}

export function GlareHover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  angle?: number;
  duration?: number;
  opacity?: number;
}) {
  return <div className={cn("overflow-hidden", className)}>{children}</div>;
}

export function Magnet({
  children,
  className,
  wrapperClassName,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  pull?: number;
  wrapperClassName?: string;
}) {
  return (
    <span className={cn("inline-block", wrapperClassName)}>
      <span className={cn("inline-block", className)}>{children}</span>
    </span>
  );
}

export function ShinyText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
  disabled?: boolean;
}) {
  return <span className={className}>{children}</span>;
}

export function SplitText({
  text,
  className,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  splitBy?: "chars" | "words";
  stagger?: number;
  duration?: number;
  delay?: number;
  distance?: number;
  margin?: string;
  as?: ElementType;
}) {
  return <Tag className={className}>{text}</Tag>;
}

export function ScrollReveal({
  children,
  className,
}: {
  children: string;
  className?: string;
  blur?: number;
  baseOpacity?: number;
}) {
  return <p className={className}>{children}</p>;
}

export function DecryptedText({
  text,
  className,
}: {
  text: string;
  className?: string;
  speed?: number;
  charset?: string;
}) {
  return <span className={className}>{text}</span>;
}

/** A strip of items that wraps onto as many rows as it needs. */
export function ScrollVelocity({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  baseVelocity?: number;
  copies?: number;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4", className)}>
      <div className="flex flex-wrap items-center gap-y-3">{children}</div>
    </div>
  );
}

export function GradualBlur(_: {
  side?: "top" | "bottom";
  height?: string;
  strength?: number;
  position?: "absolute" | "fixed";
  className?: string;
}) {
  return null;
}

/** Shows one item at a time; the caller drives `index`. */
export function CardSwap({
  items,
  className,
  index,
}: {
  items: { key: string; node: ReactNode }[];
  className?: string;
  interval?: number;
  offset?: number;
  index?: number;
  onIndexChange?: (i: number) => void;
}) {
  const [own] = useState(0);
  const front = items[index ?? own] ?? items[0];
  return <div className={cn("relative", className)}>{front?.node}</div>;
}

export function StarBorder({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  speed?: number;
}) {
  return (
    <span className={cn("inline-flex", className)}>
      <span className={cn("contents", innerClassName)}>{children}</span>
    </span>
  );
}

export function ClickSpark(_: { color?: string; count?: number; length?: number; duration?: number }) {
  return null;
}

export type GLVariant = "aurora" | "silk" | "threads" | "dotgrid";

export function GLBackground(_: {
  variant: GLVariant;
  className?: string;
  fallback?: ReactNode;
  position?: "absolute" | "fixed";
  colors?: string[];
  color?: string;
  amplitude?: number;
  speed?: number;
  opacity?: number;
  scale?: number;
  gap?: number;
  dot?: number;
  radius?: number;
}) {
  return null;
}
