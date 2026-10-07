import { locale } from "@/lib/i18n";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionProps,
  type Variants,
} from "motion/react";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { useCalm } from "@/lib/calm";

/**
 * Shared motion vocabulary for Arena3.
 *
 * Motion has to say something: a state changed, a panel opened, a list arrived. Inside the
 * signed-in app (everything under `Shell`) the scroll reveals and cascades below render as plain
 * elements, because a till operator does not need the list they open fifty times a shift to fade
 * in. The public pages keep a short entrance. Every primitive degrades to a plain, fully-visible
 * element under reduced motion, so content never depends on an animation having run.
 */

export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Set by the app shell: scroll reveals and cascades render statically below it. */
const QuietCtx = createContext(false);

export function QuietMotion({ children }: { children: ReactNode }) {
  return <QuietCtx.Provider value>{children}</QuietCtx.Provider>;
}

function useStill() {
  const reduced = useReducedMotion();
  const quiet = useContext(QuietCtx);
  return Boolean(reduced || quiet);
}

/** Wrap a subtree so every nested transition shares the house easing. */
export function MotionProvider({ children }: { children: ReactNode }) {
  // "always" is what the pause button asks for; "user" leaves it to the device setting.
  const calm = useCalm();
  return (
    <MotionConfig reducedMotion={calm ? "always" : "user"} transition={{ duration: 0.3, ease: EASE_SMOOTH }}>
      {children}
    </MotionConfig>
  );
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Direction the element travels in from. */
  from?: "up" | "down" | "left" | "right" | "none";
  delay?: number;
  duration?: number;
  /** Travel distance in px. */
  distance?: number;
  /** Re-run the animation every time it scrolls back into view. */
  repeat?: boolean;
  as?: ElementType;
};

/** Fade an element in the first time it scrolls into view (public pages only). */
export function Reveal({
  children,
  className,
  from = "up",
  delay = 0,
  duration = 0.45,
  distance = 12,
  repeat = false,
  as = "div",
}: RevealProps) {
  const still = useStill();
  const Tag = motion[as as "div"] ?? motion.div;
  const offset =
    from === "up"
      ? { y: distance }
      : from === "down"
        ? { y: -distance }
        : from === "left"
          ? { x: -distance }
          : from === "right"
            ? { x: distance }
            : {};

  if (still) return <div className={className}>{children}</div>;

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: !repeat, amount: 0.15 }}
      transition={{ duration, delay: Math.min(delay, 0.15), ease: EASE_SMOOTH }}
    >
      {children}
    </Tag>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_SMOOTH } },
};

/**
 * Each item animates itself rather than waiting to be told to: variant propagation does not survive
 * a filter remounting the list (the replacements sat at `opacity: 0`). `Stagger` publishes only
 * whether the container has been seen and how long each item waits.
 */
const StaggerCtx = createContext<{ inView: boolean; delay: number }>({ inView: true, delay: 0 });

/** Parent for a list whose children should cascade in. Pair with `<StaggerItem>`. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.05,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  const still = useStill();
  const ref = useRef<HTMLDivElement>(null);
  const observed = useInView(ref, { once: true, amount: 0, margin: "0px 0px -40px 0px" });
  // The observer does not reliably fire for a container that mounts already on screen.
  const [onScreenAtMount, setOnScreenAtMount] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) setOnScreenAtMount(true);
  }, []);
  const inView = observed || onScreenAtMount;

  if (still) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) =>
        isValidElement(child) ? (
          <StaggerCtx.Provider value={{ inView, delay: delay + Math.min(i, 6) * Math.min(gap, 0.06) }}>
            {child}
          </StaggerCtx.Provider>
        ) : (
          child
        ),
      )}
    </div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & MotionProps) {
  const still = useStill();
  const { inView, delay } = useContext(StaggerCtx);
  if (still) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.4, ease: EASE_SMOOTH, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export { staggerParent, staggerChild };

/** Former parallax layer; renders its content in place. */
export function Parallax({ children, className }: { children: ReactNode; className?: string; speed?: number }) {
  return <div className={className}>{children}</div>;
}

/** A number, formatted. (It used to count up from zero, which made every figure wrong for a second.) */
export function CountUp({
  to,
  suffix = "",
  prefix = "",
  format,
  className,
}: {
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const shown = format ? format(to) : Math.round(to).toLocaleString(locale());
  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}

/** Former pointer tilt; renders its content in place. */
export function Tilt({ children, className }: { children: ReactNode; className?: string; max?: number }) {
  return <div className={className}>{children}</div>;
}

/** Former hover lift; cards show hover through their border instead. */
export function Lift({
  children,
  className,
}: { children: ReactNode; className?: string; amount?: number } & MotionProps) {
  return <div className={className}>{children}</div>;
}

/** Former word-by-word headline; renders the text. */
export function WordReveal({ text, className }: { text: string; className?: string; delay?: number; gap?: number }) {
  return <span className={className}>{text}</span>;
}

/** Former scroll progress bar. */
export function ScrollProgress(_: { className?: string }) {
  return null;
}

/** Route content fades in on mount: a short cue that the page changed. */
export function PageIn({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"div">) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: EASE_SMOOTH }}
    >
      {children}
    </motion.div>
  );
}

export {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useInView,
  useMotionValueEvent,
};
