import { useEffect, useRef, useState } from "react";
import { gsap, useScene } from "@/lib/gsap";
import { canShuttle3D, createShuttle3D, type Shuttle3D } from "./shuttle3d-gl";
import { drawScene, newSceneState } from "./shuttle3d-scene";

/** Flag on <html> while the 3D scene is drawing, so the hero can drop its 2D shuttle. */
export const SHUTTLE_ON_CLASS = "shuttle-on";

/**
 * The landing's 3D scene: a shuttlecock served in the hero, hit by a racket.
 * Raw WebGL2 on one fixed, click-through
 * canvas. It has to sit outside `#smooth-content` (a transformed ancestor would break `fixed`),
 * so it is mounted next to the header.
 *
 * `glow` is how much of the court is free today; it warms the feathers' lime rim light.
 * Under reduced motion it draws one still pose. Without WebGL2 it renders nothing and the hero
 * keeps its SVG serve.
 */
export function ShuttleScene({ glow = 0.8 }: { glow?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState(false);
  const glowRef = useRef(glow);
  glowRef.current = glow;

  // Probe after mount so the server and the first client render match.
  useEffect(() => setSupported(canShuttle3D()), []);

  useScene(
    wrap,
    ({ motion }) => {
      const cv = canvas.current;
      if (!supported || !cv) return;
      const L: Shuttle3D | null = createShuttle3D(cv);
      if (!L) return;
      const S = newSceneState();
      const root = document.documentElement;
      let hidden = document.hidden;
      let clock = 0;
      const frame = () => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const slot = document.querySelector<HTMLElement>("[data-shuttle-stage]");
        const bounds = slot?.getBoundingClientRect();
        // Keep decorative art inside its reserved hero stage, including while scrolling.
        if (!bounds || bounds.bottom <= 0 || bounds.top >= vh || bounds.width <= 0 || bounds.height <= 0) {
          cv.style.visibility = "hidden";
          return;
        }
        cv.style.visibility = "visible";
        cv.style.clipPath = `inset(${Math.max(0, bounds.top)}px ${Math.max(0, vw - bounds.right)}px ${Math.max(0, vh - bounds.bottom)}px ${Math.max(0, bounds.left)}px)`;
        const ok = drawScene(L, S, { time: clock, motion, glow: glowRef.current, hand: 0,
          anchor: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } });
        root.classList.toggle(SHUTTLE_ON_CLASS, ok);
      };

      if (!motion) {
        // One still pose, redrawn when the page scrolls or resizes. No loop.
        const still = () => { frame(); };
        L.onRestore = still;
        still();
        window.addEventListener("scroll", still, { passive: true });
        window.addEventListener("resize", still);
        return () => {
          window.removeEventListener("scroll", still);
          window.removeEventListener("resize", still);
          root.classList.remove(SHUTTLE_ON_CLASS);
          L.dispose();
        };
      }

      const ptr = { x: 0, y: 0, has: false };
      const onMove = (e: PointerEvent) => {
        ptr.x = e.clientX / window.innerWidth - 0.5;
        ptr.y = e.clientY / window.innerHeight - 0.5;
        ptr.has = true;
      };
      const onVis = () => { hidden = document.hidden; };
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("visibilitychange", onVis);
      const tick = (_t: number, dtMs: number) => {
        if (hidden) return;
        const dt = Math.min(dtMs, 64) / 1000 * 60;
        clock += dtMs / 1000;
        const k = 1 - Math.pow(0.93, dt);
        S.ry += ((ptr.has ? ptr.x * 0.9 : 0) - S.ry) * k;
        S.rx += ((ptr.has ? ptr.y * 0.6 : 0) - S.rx) * k;
        S.yaw += 0.009 * dt;
        frame();
      };
      gsap.ticker.add(tick);
      return () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVis);
        root.classList.remove(SHUTTLE_ON_CLASS);
        L.dispose();
      };
    },
    [supported],
  );

  return (
    <div ref={wrap} aria-hidden className="pointer-events-none fixed inset-0 z-[5]">
      {supported && <canvas ref={canvas} className="block h-full w-full" />}
    </div>
  );
}
