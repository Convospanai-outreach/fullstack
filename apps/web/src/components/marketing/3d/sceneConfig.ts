"use client";

export const SCENE_COLORS = {
  cyan: 0x22d3ee,
  cyanSoft: 0x7dd3fc,
  violet: 0x8b5cf6,
  violetBright: 0xa855f7,
  indigo: 0x6366f1,
  indigoSoft: 0x818cf8,
  mint: 0x10b981,
  mintSoft: 0x34d399,
  crystal: 0x60a5fa,
  amber: 0xfbbf24,
  base: 0x020617,
};

export type PillarMotif = "radar" | "outreach" | "human-loop" | "edge-shield";
export type ParticleMode = "capture" | "approve" | "rescue" | "secure";

export interface PillarDef {
  id: "netjana" | "cmf-core" | "human-layer" | "covospan-edge";
  index: number;
  name: string;
  category: string;
  tag: string;
  solves: string;
  motif: PillarMotif;
  particleMode: ParticleMode;
  position: [number, number, number];
  color: number;
  softColor: number;
  activeAt: number;
  headline: string;
  body: string;
}

export const PILLARS: PillarDef[] = [
  {
    id: "netjana",
    index: 1,
    name: "NetJana",
    category: "Buyer Signals",
    tag: "Signal",
    solves: "Who should I reach out to this week?",
    motif: "radar",
    particleMode: "capture",
    position: [7.0, 6.0, 1.6],
    color: SCENE_COLORS.cyan,
    softColor: SCENE_COLORS.cyanSoft,
    activeAt: 0.4,
    headline: "Be the first call. Never the second.",
    body: "Monitors hiring, expansion, tenders, and decision-maker movement so your team works active-market accounts, not cold lists.",
  },
  {
    id: "cmf-core",
    index: 2,
    name: "CMF Core",
    category: "AI Outreach SaaS",
    tag: "Outreach",
    solves: "How do I reach them, and how do I know it went well?",
    motif: "outreach",
    particleMode: "approve",
    position: [-7.2, 2.0, 1.6],
    color: SCENE_COLORS.violet,
    softColor: SCENE_COLORS.indigoSoft,
    activeAt: 0.54,
    headline: "AI drafts. Managers approve. Nothing goes out unchecked.",
    body: "Drafts outreach, prepares channel context, tracks every action, and keeps manager approval in the loop before anything goes out.",
  },
  {
    id: "human-layer",
    index: 3,
    name: "Human Layer",
    category: "Conversion Moat",
    tag: "Human",
    solves: "What happens when the digital channel is not enough?",
    motif: "human-loop",
    particleMode: "rescue",
    position: [7.0, -2.2, 1.6],
    color: SCENE_COLORS.mintSoft,
    softColor: SCENE_COLORS.mint,
    activeAt: 0.68,
    headline: "The deals email cannot close, your people can.",
    body: "Caller tasks, manual stage updates, and follow-up suggestions keep high-value leads moving between message and contract.",
  },
  {
    id: "covospan-edge",
    index: 4,
    name: "Covospan EDGE",
    category: "Sovereign Edge Node",
    tag: "Edge",
    solves: "How do I run this without putting sensitive client data in someone else's cloud?",
    motif: "edge-shield",
    particleMode: "secure",
    position: [-6.6, -5.6, 1.6],
    color: SCENE_COLORS.crystal,
    softColor: SCENE_COLORS.cyanSoft,
    activeAt: 0.82,
    headline: "Their trust is the contract. Keep it with you.",
    body: "Runs sensitive AI checks, memory logs, and outreach processing close to your own data with encrypted local storage and on-device audit logs.",
  },
];

export const SCROLL_ACTS = [
  { id: "intake",   label: "Market Noise",           shortLabel: "INTAKE",   progress: 0.0  },
  { id: "leak",     label: "Lost Speed",              shortLabel: "LEAK",     progress: 0.14 },
  { id: "shift",    label: "Governed Funnel",         shortLabel: "SHIFT",    progress: 0.28 },
  { id: "signal",   label: "NetJana Buyer Signals",   shortLabel: "SIGNAL",   progress: 0.4  },
  { id: "outreach", label: "CMF Core AI Outreach",    shortLabel: "OUTREACH", progress: 0.54 },
  { id: "human",    label: "Human Conversion Moat",   shortLabel: "HUMAN",    progress: 0.68 },
  { id: "edge",     label: "Covospan EDGE",           shortLabel: "EDGE",     progress: 0.82 },
  { id: "revenue",  label: "Qualified Revenue",       shortLabel: "REVENUE",  progress: 0.92 },
  { id: "launch",   label: "Pilot CTA",               shortLabel: "LAUNCH",   progress: 1.0  },
] as const;
