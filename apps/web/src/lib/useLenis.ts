"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface UseLenisOptions {
  enabled?: boolean;
  duration?: number;
  smoothWheel?: boolean;
  wheelMultiplier?: number;
  touchMultiplier?: number;
}

let gsapRegistered = false;
let activeLenis: Lenis | null = null;
let activeMounts = 0;
let activeTicker: ((time: number) => void) | null = null;

function ensureGsapRegistered() {
  if (gsapRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  gsapRegistered = true;
}

function getPrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Creates one shared Lenis instance and drives it from GSAP's ticker so
 * ScrollTrigger reads the same smoothed scroll position as the user sees.
 *
 * The singleton/ref-count pattern prevents duplicate Lenis instances when a
 * layout and page component both call this hook during development or route
 * transitions. Reduced-motion users get native scroll with ScrollTrigger only.
 */
export function useLenis(options: boolean | UseLenisOptions = true) {
  useEffect(() => {
    const normalized: UseLenisOptions =
      typeof options === "boolean" ? { enabled: options } : { enabled: true, ...options };

    if (!normalized.enabled) return;
    if (typeof window === "undefined") return;

    ensureGsapRegistered();

    const reduceMotion = getPrefersReducedMotion();
    if (reduceMotion) {
      ScrollTrigger.refresh();
      return;
    }

    activeMounts += 1;

    if (!activeLenis) {
      activeLenis = new Lenis({
        duration: normalized.duration ?? 1.15,
        easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        smoothWheel: normalized.smoothWheel ?? true,
        wheelMultiplier: normalized.wheelMultiplier ?? 1,
        touchMultiplier: normalized.touchMultiplier ?? 1.4,
      });

      activeLenis.on("scroll", ScrollTrigger.update);

      activeTicker = (time: number) => {
        activeLenis?.raf(time * 1000);
      };

      gsap.ticker.add(activeTicker);
      gsap.ticker.lagSmoothing(0);
      ScrollTrigger.refresh();
    }

    const onResize = () => {
      activeLenis?.resize();
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      activeMounts = Math.max(0, activeMounts - 1);

      if (activeMounts === 0) {
        if (activeTicker) {
          gsap.ticker.remove(activeTicker);
          activeTicker = null;
        }
        activeLenis?.destroy();
        activeLenis = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function getActiveLenis() {
  return activeLenis;
}
