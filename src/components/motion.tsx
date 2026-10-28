import { locale } from "@/lib/i18n";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionProps,
  type Transition,
  type Variants,
} from "motion/react";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
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
 * Two rules sit above everything here.
 *
 * 1. Content is visible at rest. The server renders it visible, and an entrance is something
 *    that happens *to* visible content after mount (a Web Animations run from a hidden pose to
 *    the resting one), never a hidden pose waiting for an animation frame to reveal it. If the
 *    tab is throttled, the script is slow or the observer never fires, the worst outcome is a
 *    missing flourish, not a missing heading. A timer clears any pose that is still hidden.
 * 2. Motion is a spring, not a duration. A spring starts from where the element is, keeps the
 *    velocity it was given and can be redirected at any instant (see SPRING).
 *
 * Every primitive degrades to a plain, fully-visible element when the visitor asks for reduced
 * motion. (`useCalm()` in `@/lib/calm` follows the same device setting live.)
 */

/**
 * The device's reduced-motion setting, but only once the component has mounted.
 *
 * The server cannot know the setting, so it always renders the moving version. If the first
 * client render already chose the still version (a plain `<div>` instead of a spotlight, whole
 * text instead of split words), hydration would not match the server's HTML and React would
 * throw the page away and rebuild it. Answering "no" until mounted keeps hydration exact; the
 * still version takes over one render later.
 */
export function useReducedMotionAfterMount(): boolean {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && !!reduced;
}

export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * The springs. Apple names a spring by its damping ratio and its response (seconds to reach the
 * target); Motion's `bounce` and `duration` are the same two dials, so:
 *
 * - `snappy`  damping 1.0, response 0.3: a press, a toggle, a tab indicator. No overshoot.
 * - `smooth`  damping 1.0, response 0.45: a page, a card, a reveal. The default.
 * - `gentle`  damping 1.0, response 0.7: something large settling (a hero, a sheet's backdrop).
 * - `bouncy`  damping 0.8, response 0.4: only where the gesture itself carried momentum, such as
 *   a sheet released with a flick. Overshoot on something that merely faded in feels wrong.
 */
export const SPRING = {
  snappy: { type: "spring", duration: 0.3, bounce: 0 },
  smooth: { type: "spring", duration: 0.45, bounce: 0 },
  gentle: { type: "spring", duration: 0.7, bounce: 0 },
  bouncy: { type: "spring", duration: 0.4, bounce: 0.2 },
} as const satisfies Record<string, Transition>;

/**
 * Where a drag released at `velocity` (px/s) would come to rest, were it a scroll with the
 * system's deceleration. A sheet snaps to the target nearest this, not nearest the finger, so a
 * short flick still throws it. (The form Apple ships: exponential decay, not v^2 / 2a.)
 */
export function project(velocity: number, deceleration = 0.998): number {
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/** Past an edge the content follows less and less, instead of stopping dead. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Wrap a subtree so every nested transition shares the house spring. */
export function MotionProvider({ children }: { children: ReactNode }) {
  // "always" once the device asks for reduced motion (read live by useCalm), "user" otherwise.
  // Slides become fades and nothing remounts, so the setting changing never costs typed text.
  const calm = useCalm();
  return (
    <MotionConfig reducedMotion={calm ? "always" : "user"} transition={SPRING.smooth}>
      {children}
    </MotionConfig>
  );
}

/* ── Arrivals ───────────────────────────────────────────────────────────────────────────── */

/**
 * True once the page has been up long enough that anything mounting now is news, rather than the
 * server's HTML being hydrated. A heading already painted by the server should not blink out and
 * rise again; a card that arrives with a fetch should.
 */
let booted = typeof window === "undefined";
if (typeof window !== "undefined") {
  const done = () => {
    booted = true;
  };
  if (document.readyState === "complete") setTimeout(done, 400);
  else window.addEventListener("load", () => setTimeout(done, 400), { once: true });
  // A page that never finishes loading (a stalled image) must not keep entrances switched off.
  setTimeout(done, 3000);
}

type Direction = "up" | "down" | "left" | "right" | "none";

function pose(from: Direction, distance: number) {
  return {
    x: from === "left" ? -distance : from === "right" ? distance : 0,
    y: from === "up" ? distance : from === "down" ? -distance : 0,
  };
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Play an arrival on a visible element: from a small offset and transparent to rest, on a
 * spring, once. Optionally wait until the element is actually on screen.
 *
 * Everything is imperative and happens before the browser paints the element hidden: the element
 * is posed in a layout effect, so a client-side navigation never shows the resting state for a
 * frame first, and the server's HTML is never hidden at all. `settle` is the net under the
 * trapeze: whatever happens to the animation, the inline pose is gone after a bounded time.
 */
function useArrival<T extends HTMLElement>({
  from = "up",
  distance = 16,
  delay = 0,
  watch = false,
  repeat = false,
  transition = SPRING.smooth,
}: {
  from?: Direction;
  distance?: number;
  delay?: number;
  /** Wait for the element to scroll into view before playing. */
  watch?: boolean;
  repeat?: boolean;
  transition?: Transition;
}) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    const start = pose(from, distance);
    const r = el.getBoundingClientRect();
    const onScreen = r.top < window.innerHeight && r.bottom > 0;
    // Painted by the server and still on screen: leave it be.
    if (!booted && onScreen) return;
    // Nothing to wait for and not on screen: there is no arrival to see.
    if (!watch && !onScreen) return;

    let controls: ReturnType<typeof animate> | null = null;
    let net = 0;
    let io: IntersectionObserver | null = null;
    const hide = () => {
      el.style.opacity = "0";
      el.style.transform = `translate3d(${start.x}px, ${start.y}px, 0)`;
    };
    const settle = () => {
      window.clearTimeout(net);
      controls?.stop();
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
    };
    const play = () => {
      settle();
      hide();
      controls = animate(
        el,
        { opacity: [0, 1], x: [start.x, 0], y: [start.y, 0] },
        { ...transition, delay },
      );
      // Net: after a bounded time the pose is cleared whatever the animation did.
      net = window.setTimeout(settle, (delay + 1.4) * 1000);
      void controls.then(settle, settle);
    };

    if (watch && !onScreen) {
      hide();
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              if (!repeat) io?.disconnect();
              play();
            } else if (repeat) {
              hide();
            }
          }
        },
        { rootMargin: "0px 0px -64px 0px", threshold: 0.12 },
      );
      io.observe(el);
      // An element that never meets the observer (a collapsed tab, a clipped box) is not lost.
      net = window.setTimeout(settle, 8000);
    } else {
      play();
    }
    return () => {
      io?.disconnect();
      settle();
    };
    // The pose is chosen once, when the element arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Direction the element travels in from. */
  from?: Direction;
  delay?: number;
  /** Kept for callers that tuned a duration; a spring's response is set by `SPRING`. */
  duration?: number;
  /** Travel distance in px. */
  distance?: number;
  /** Re-run the animation every time it scrolls back into view. */
  repeat?: boolean;
  as?: ElementType;
};

/** Fade and rise an element in the first time it scrolls into view. Visible if nothing runs. */
export function Reveal({
  children,
  className,
  from = "up",
  delay = 0,
  distance = 18,
  repeat = false,
  as: Tag = "div",
}: RevealProps) {
  const ref = useArrival<HTMLElement>({ from, distance, delay, watch: true, repeat });
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.075, delayChildren: 0.05 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/**
 * Each item arrives by itself rather than waiting to be told to.
 *
 * Variant propagation was the obvious way to build this and it does not survive contact with a
 * filter: swapping the sport on Classes remounts the whole list, and a parent that has already
 * finished its cascade has no label change left to broadcast, so every replacement card sat at
 * `opacity: 0` and the list looked wiped. So `Stagger` publishes only how long an item should
 * wait, and the item plays its own arrival whenever it mounts.
 */
const StaggerCtx = createContext<{ delay: number }>({ delay: 0 });

/** Parent for a list whose children should cascade in. Pair with `<StaggerItem>`. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.06,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) =>
        isValidElement(child) ? (
          // Capped so a long list does not leave its tail waiting: past a dozen items the
          // offsets are indistinguishable.
          <StaggerCtx.Provider value={{ delay: delay + Math.min(i, 12) * gap }}>{child}</StaggerCtx.Provider>
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
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"div">) {
  const { delay } = useContext(StaggerCtx);
  const ref = useArrival<HTMLDivElement>({ from: "up", distance: 14, delay, watch: true });
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}

export { staggerParent, staggerChild };

/**
 * A number that counts up when it first scrolls into view.
 *
 * It rests on the real value. The count is a flourish played over a number that is already right:
 * if the tab is throttled, the element never intersects or the frame loop stalls, a timer puts the
 * true value back, so a figure is never left reading 0.
 */
export function CountUp({
  to,
  duration = 1.1,
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
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  const shownTo = useRef(to);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A changed figure follows its new value; only the first arrival counts from zero.
    if (shownTo.current !== to) {
      shownTo.current = to;
      setValue(to);
      return;
    }
    if (prefersReduced() || !booted || to === 0) {
      setValue(to);
      return;
    }
    let raf = 0;
    let io: IntersectionObserver | null = null;
    const net = window.setTimeout(() => setValue(to), (duration + 2) * 1000);
    const run = () => {
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / (duration * 1000));
        // Ease-out with a long tail: the last digits settle like a spring, not like a clock.
        setValue(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(step);
        else window.clearTimeout(net);
      };
      raf = requestAnimationFrame(step);
    };
    setValue(0);
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) run();
    else {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io?.disconnect();
          run();
        }
      });
      io.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(net);
      io?.disconnect();
    };
  }, [to, duration]);

  const shown = format ? format(value) : Math.round(value).toLocaleString(locale());
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}

/** Subtle 3D tilt toward the pointer. Pointer-only; never fires on touch. */
export function Tilt({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionAfterMount();
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={cn("[transform-style:preserve-3d]", className)}
      style={{ rotateX: rx, rotateY: ry, perspective: 800 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry.set(px * max * 2);
        rx.set(-py * max * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Lift-on-hover wrapper for cards and tiles. No whileTap here on purpose: Motion makes any
 * element with a press gesture keyboard-focusable (tabindex=0), which turned every card into
 * a nameless Tab stop.
 */
export function Lift({
  children,
  className,
  amount = -3,
  ...rest
}: { children: ReactNode; className?: string; amount?: number } & MotionProps) {
  const reduced = useReducedMotionAfterMount();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} whileHover={{ y: amount }} transition={SPRING.snappy} {...rest}>
      {children}
    </motion.div>
  );
}

/** Rise route content in on mount. Used by the app shells; visible without it. */
export function PageIn({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"div">) {
  const ref = useArrival<HTMLDivElement>({ from: "up", distance: 8, transition: SPRING.snappy });
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}

export {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useInView,
  useMotionValueEvent,
};
