"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BUDDY_NAME,
  CHEERS,
  ERROR_LINES,
  SAVING_LINE,
  STEP_TIPS,
  milestoneLine,
  pickLine,
  sandLevel,
  type BuddyMood,
} from "@/lib/setupBuddyTips";

const MIN_KEY = "cmf.setup.buddy.minimised";

type Props = {
  stepId: number;
  /** Overall setup completion, 0..100. */
  completion: number;
  /** How many visible steps are complete; a rise means the user just finished one. */
  completedCount: number;
  saving: boolean;
  errorMessage: string | null;
};

// Glass outline shared by the clip path and the frame: top bulb y 20..78, neck at 80, bottom bulb 82..140.
const GLASS = "M30 20 H90 C90 50 68 62 62 80 C68 98 90 110 90 140 H30 C30 110 52 98 58 80 C52 62 30 50 30 20 Z";

function Mouth({ mood }: { mood: BuddyMood }) {
  const common = { fill: "none", stroke: "#0f172a", strokeWidth: 2.4, strokeLinecap: "round" as const };
  if (mood === "cheer") return <path d="M50 56 Q60 70 70 56 Z" fill="#0f172a" stroke="#0f172a" strokeWidth={2} strokeLinejoin="round" />;
  if (mood === "happy") return <path d="M51 57 Q60 66 69 57" {...common} />;
  if (mood === "concerned") return <path d="M52 63 Q60 57 68 63" {...common} />;
  if (mood === "thinking") return <ellipse cx="60" cy="60" rx="3" ry="3.4" fill="#0f172a" />;
  return <path d="M53 59 Q60 63 67 59" {...common} />;
}

export function HourglassBuddy({ stepId, completion, completedCount, saving, errorMessage }: Props) {
  const clipId = useId();
  const [minimised, setMinimised] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [blink, setBlink] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [spins, setSpins] = useState(0);
  const [burst, setBurst] = useState<{ mood: BuddyMood; line: string } | null>(null);
  const [announce, setAnnounce] = useState("");
  const previous = useRef({ completedCount, completion });
  const burstTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      setMinimised(window.localStorage.getItem(MIN_KEY) === "1");
    } catch {
      /* storage blocked: stay expanded */
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Blink every few seconds.
  useEffect(() => {
    if (reduceMotion || minimised) return;
    let open: number | undefined;
    let close: number | undefined;
    const schedule = () => {
      open = window.setTimeout(() => {
        setBlink(true);
        close = window.setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2800 + Math.random() * 2600);
    };
    schedule();
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(close);
    };
  }, [reduceMotion, minimised]);

  // A new step starts from its first tip.
  useEffect(() => setTipIndex(0), [stepId]);

  // React to progress: a finished step gets a cheer, crossing 50% or 100% gets a bigger one.
  useEffect(() => {
    const before = previous.current;
    previous.current = { completedCount, completion };
    if (completedCount <= before.completedCount) return;
    const milestone = milestoneLine(before.completion, completion);
    const line = milestone ?? pickLine(CHEERS, completedCount);
    setBurst({ mood: milestone ? "cheer" : "happy", line });
    setAnnounce(line);
    window.clearTimeout(burstTimer.current);
    burstTimer.current = window.setTimeout(() => setBurst(null), milestone ? 6500 : 4000);
  }, [completedCount, completion]);

  useEffect(() => () => window.clearTimeout(burstTimer.current), []);

  const tips = STEP_TIPS[stepId] ?? [];
  let mood: BuddyMood = "idle";
  let line = tips[tipIndex % Math.max(1, tips.length)] ?? `${BUDDY_NAME} is here if you need a hand.`;
  if (saving) {
    mood = "thinking";
    line = SAVING_LINE;
  } else if (errorMessage) {
    mood = "concerned";
    line = pickLine(ERROR_LINES, stepId);
  } else if (burst) {
    mood = burst.mood;
    line = burst.line;
  }

  const level = sandLevel(completion);
  // Sand heights inside the two bulbs (58 tall each). Keep a thin film so the glass never looks empty.
  const topHeight = 56 * (1 - level);
  const bottomHeight = 56 * level;
  const streaming = level > 0 && level < 1;

  function setMin(value: boolean) {
    setMinimised(value);
    try {
      window.localStorage.setItem(MIN_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function poke() {
    if (tips.length > 1) setTipIndex((i) => (i + 1) % tips.length);
    if (!reduceMotion) setSpins((n) => n + 1);
  }

  if (minimised) {
    return (
      <button
        type="button"
        onClick={() => setMin(false)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
        aria-label={`Show ${BUDDY_NAME}, your setup helper`}
      >
        <svg viewBox="0 0 120 160" className="h-5 w-4" aria-hidden="true">
          <path d={GLASS} fill="#22d3ee" fillOpacity={0.35} stroke="#94a3b8" strokeWidth={6} />
        </svg>
        Show {BUDDY_NAME}
      </button>
    );
  }

  return (
    <div className="mt-4 flex items-start gap-3" data-mood={mood}>
      <button
        type="button"
        onClick={poke}
        className="shrink-0 rounded-lg p-1 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan-400"
        aria-label={`${BUDDY_NAME}, your setup helper. Press for another tip.`}
      >
        <svg
          viewBox="0 0 120 160"
          className={`h-20 w-[3.75rem] lg:h-24 lg:w-[4.5rem] ${mood === "cheer" && !reduceMotion ? "animate-bounce" : ""}`}
          style={{
            transform: `rotate(${spins * 360}deg)`,
            transition: reduceMotion ? "none" : "transform 700ms cubic-bezier(.4,1.4,.6,1)",
          }}
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={GLASS} />
            </clipPath>
          </defs>
          <path d={GLASS} fill="#0f172a" fillOpacity={0.55} />
          <g clipPath={`url(#${clipId})`}>
            <rect
              x="20"
              width="80"
              fill="#22d3ee"
              y={78 - topHeight}
              height={topHeight}
              style={{ transition: reduceMotion ? "none" : "all 700ms ease" }}
            />
            <rect
              x="20"
              width="80"
              fill="#22d3ee"
              y={140 - bottomHeight}
              height={bottomHeight}
              style={{ transition: reduceMotion ? "none" : "all 700ms ease" }}
            />
            {(streaming || saving) && (
              <line
                x1="60"
                x2="60"
                y1="78"
                y2="130"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="3 5"
                className={reduceMotion ? "" : "buddy-stream"}
              />
            )}
          </g>
          <path d={GLASS} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
          <rect x="22" y="12" width="76" height="8" rx="4" fill="#94a3b8" />
          <rect x="22" y="140" width="76" height="8" rx="4" fill="#94a3b8" />
          {/* Face on the upper bulb: white eyes read on both sand and empty glass. */}
          <g>
            <ellipse cx="50" cy="42" rx="6" ry={blink || mood === "happy" ? 1.2 : 6.5} fill="#f8fafc" />
            <ellipse cx="70" cy="42" rx="6" ry={blink || mood === "happy" ? 1.2 : 6.5} fill="#f8fafc" />
            {!blink && mood !== "happy" && (
              <>
                <circle cx={mood === "thinking" ? 52 : 50} cy={mood === "thinking" ? 40 : 43} r="2.6" fill="#0f172a" />
                <circle cx={mood === "thinking" ? 72 : 70} cy={mood === "thinking" ? 40 : 43} r="2.6" fill="#0f172a" />
              </>
            )}
            {mood === "concerned" && (
              <>
                <path d="M43 32 L55 35" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M77 32 L65 35" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
              </>
            )}
            <Mouth mood={mood} />
          </g>
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">{BUDDY_NAME}</p>
          <button
            type="button"
            onClick={() => setMin(true)}
            className="rounded px-1 text-xs text-slate-400 transition hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label={`Hide ${BUDDY_NAME}`}
          >
            Hide
          </button>
        </div>
        <p className="mt-1 rounded-lg rounded-tl-none bg-slate-800/80 px-3 py-2 text-sm leading-snug text-slate-200">{line}</p>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      <style>{`
        @keyframes buddy-stream { to { stroke-dashoffset: -16; } }
        .buddy-stream { animation: buddy-stream 600ms linear infinite; }
      `}</style>
    </div>
  );
}
