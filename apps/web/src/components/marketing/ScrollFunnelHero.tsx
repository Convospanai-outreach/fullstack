"use client";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ArrowDown, ArrowUpRight, Check, CalendarCheck, Radar, ShieldCheck } from "lucide-react";
import styles from "./ScrollFunnelHero.module.css";
import FunnelMesh, { Universe, radiusAt } from "./FunnelMesh";

// Five transitions and a final reading hold. Native document scrolling only.
const SCROLL = { stepVh: 65, holdVh: 35 };
const STAGES = [
  { id: "start", label: "Start", title: "Every signal.", accent: "A clear next move.", detail: "From buyer intent to a qualified meeting." },
  { id: "signal", label: "Signal", title: "Catch the signal.", accent: "Before the crowd.", detail: "Find a reason to start a relevant conversation." },
  { id: "qualify", label: "Qualify", title: "Find the fit.", accent: "Focus your effort.", detail: "Bring the right account into focus." },
  { id: "approve", label: "Approve", title: "AI prepares.", accent: "You approve.", detail: "Keep your judgment at the heart of every introduction." },
  { id: "follow-up", label: "Follow-up", title: "Keep the conversation", accent: "moving.", detail: "A clear owner. A human next step." },
  { id: "meeting", label: "Meeting", title: "A signal becomes", accent: "a meeting.", detail: "A qualified conversation. A new opportunity to explore." },
] as const;
const BANDS = ["Signals", "Relevant accounts", "Approved outreach", "Human follow-up", "Qualified meeting"];
const POSITIONS = [35, 116, 207, 298, 389, 506];
const LEGACY = [["act-intake", "act-leak", "act-shift"], ["act-signal"], [], ["act-outreach", "act-edge"], ["act-human"], ["act-revenue"]];
type Navigate = (event: MouseEvent<HTMLAnchorElement>, index: number) => void;

function Funnel({ stage, moving = false }: { stage: number; moving?: boolean }) {
  const id = moving ? "mesh-main" : "mesh-" + stage;
  const point = (row: number, angle: number) => {
    const radius = radiusAt(3.2 - row * 6.4) * 210 / 3.05;
    // Trigonometry can differ in the final bit between server and browser engines.
    return [275 + Math.cos(angle) * radius, 78 + row * 404 + Math.sin(angle) * radius * .24]
      .map(value => Math.round(value * 1000) / 1000);
  };
  const wires = Array.from({ length: 32 }, (_, column) =>
    Array.from({ length: 21 }, (_, row) => {
      const [x, y] = point(row / 20, column / 32 * Math.PI * 2);
      return (row === 0 ? "M" : "L") + x + " " + y;
    }).join(" "),
  ).join(" ");
  const diagonals = Array.from({ length: 20 }, (_, row) =>
    Array.from({ length: 32 }, (_, column) => {
      const a = point(row / 20, column / 32 * Math.PI * 2);
      const b = point((row + 1) / 20, (column + 1) / 32 * Math.PI * 2);
      return "M" + a.join(" ") + "L" + b.join(" ");
    }).join(" "),
  ).join(" ");
  return <svg className={styles["funnel"]} viewBox="0 0 650 560" role="img"
    aria-label={"Acme Logistics: " + STAGES[stage]!.label + ". One prospect moving through a five-band glass funnel into your pipeline."}>
    <defs>
      <linearGradient id={id}><stop stopColor="#83e6fa" stopOpacity=".3"/><stop offset=".4" stopColor="#60a5fa" stopOpacity=".05"/><stop offset=".75" stopColor="#a78bfa" stopOpacity=".16"/><stop offset="1" stopColor="#83e6fa" stopOpacity=".32"/></linearGradient>
      <filter id={id + "-glow"} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <g data-fallback-mesh>
      <path d={"M65 78 Q275 12 485 78 " + Array.from({ length: 20 }, (_, i) => "L" + point((i + 1) / 20, 0).join(" ")).join(" ") + "Q275 494 " + point(1, Math.PI).join(" ") + Array.from({ length: 20 }, (_, i) => "L" + point((19 - i) / 20, Math.PI).join(" ")).join(" ") + "Z"} fill={"url(#" + id + ")"} stroke="#70d9f4" strokeOpacity=".55"/>
      <path d={wires} fill="none" stroke="#47b9e1" strokeWidth=".65" opacity=".12"/>
      <path d={diagonals} fill="none" stroke="#389fc9" strokeWidth=".5" opacity=".07"/>
      {Array.from({ length: 11 }, (_, i) => <ellipse key={i} cx="275" cy={78 + i / 10 * 404} rx={radiusAt(3.2 - i / 10 * 6.4) * 210 / 3.05} ry={radiusAt(3.2 - i / 10 * 6.4) * 210 / 3.05 * .24} fill="none" stroke="#67dafa" strokeWidth=".65" opacity=".2"/>)}
      <ellipse cx="275" cy="78" rx="210" ry="50.4" fill="none" stroke="#8be8fa" strokeWidth="1.5"/>
      <g data-collector>
        <ellipse cx="275" cy="541" rx="66" ry="9" fill="#53cde9" opacity=".2" filter={"url(#" + id + "-glow)"}/>
        <path d="M221 510 Q275 532 329 510 L317 539 Q275 555 233 539 Z" fill={"url(#" + id + ")"} stroke={stage === 5 ? "#f9cb77" : "#72d7ec"} strokeOpacity=".75"/>
        <ellipse cx="275" cy="510" rx="54" ry="13" fill="#6dd9ef" fillOpacity=".04" stroke={stage === 5 ? "#f9cb77" : "#72d7ec"}/>
      </g>
    </g>
    {BANDS.map((band, i) => {
      const y = 78 + i / 5 * 404, next = y + 404 / 5;
      const radius = radiusAt(3.2 - i / 5 * 6.4) * 210 / 3.05;
      const nextRadius = radiusAt(3.2 - (i + 1) / 5 * 6.4) * 210 / 3.05;
      const left = 275 - radius, right = 275 + radius;
      const active = stage === i + 1, color = i === 2 ? "#b599ff" : "#67e8f9";
      return <g key={band} data-band={i + 1} data-active={active}>
        <g data-fallback-mesh>
          <path d={"M" + left + " " + y + "Q275 " + (y + radius * .48) + " " + right + " " + y + "L" + (275 + nextRadius) + " " + next + "Q275 " + (next + nextRadius * .48) + " " + (275 - nextRadius) + " " + next + "Z"} fill={color} opacity={active ? .16 : .018}/>
          <ellipse cx="275" cy={y} rx={radius} ry={radius * .24} fill="none" stroke={color} strokeWidth={active ? 1.8 : 1} opacity={active ? 1 : .45}/>
          {Array.from({ length: 12 }, (_, n) => {
            const [x, py] = point((i + .2) / 5, n / 12 * Math.PI * 2);
            return <g key={n}><circle cx={x} cy={py} r="5" fill={color} opacity={active ? .4 : .12} filter={"url(#" + id + "-glow)"}/><circle cx={x} cy={py} r={active ? 1.8 : 1.1} fill={color} opacity={active ? 1 : .45}/></g>;
          })}
        </g>
        <g data-band-label transform={"translate(" + (right - 18) + "," + (y + 42) + ")"}>
          <path d="M0 0 H20" stroke={color} opacity={active ? .9 : .3}/>
          <text x="26" y="4" fill={active ? "#ecfeff" : "#a5bfd6"} fontSize="16" fontWeight={active ? 600 : 400}>{band}</text>
        </g>
      </g>;
    })}
    <path data-fallback-mesh className={moving ? styles["trail"] : undefined} d={"M275 35 V" + POSITIONS[stage]} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 7" opacity=".45"/>
    {stage > 0 && <circle data-attachment cx={275 - radiusAt(3.2 - (Math.min(POSITIONS[stage]!, 466) - 78) / 404 * 6.4) * 210 / 3.05} cy={Math.min(POSITIONS[stage]!, 466)} r="2" fill="transparent"/>}
    <g style={{ transform: "translate(275px, " + POSITIONS[stage] + "px)" }} data-prospect="Acme Logistics">
      <circle r="22" fill="#fbbf24" opacity=".35" filter={"url(#" + id + "-glow)"}/><circle r="9" fill="none" stroke="#fbbf24" opacity=".65"/><circle r="4.5" fill="#fff4c1"/>
    </g>
  </svg>;
}

function Approval() {
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [draft, setDraft] = useState("Congratulations on your expansion. Could we discuss your new facility requirements?");
  return <>
    <p>A relevant introduction, ready for review.</p>
    {editing ? <label className={styles["editor"]}>Example introduction<textarea maxLength={180} autoFocus value={draft} onChange={e => { setDraft(e.target.value); setApproved(false); }}/></label> : <blockquote>{draft}</blockquote>}
    <div className={styles["actions"]}><button type="button" className={styles["primary"]} disabled={approved || !draft.trim()} onClick={() => { setApproved(true); setEditing(false); }}>{approved ? "Draft approved" : "Approve draft"}<Check size={16}/></button><button type="button" className={styles["secondary"]} onClick={() => { setEditing(!editing); setApproved(false); }}>{editing ? "Save example" : "Edit"}</button></div>
    <small role="status">{approved ? "Example approved locally. No message was sent." : "Nothing sends without approval."}</small>
  </>;
}

function Panel({ stage, navigate }: { stage: number; navigate: Navigate }) {
  if (stage === 0) return <a className={styles["primary"]} href="#journey-signal" onClick={e => navigate(e, 1)}>Explore the journey <ArrowDown size={18}/></a>;
  return <div key={stage} className={styles["panel"]} data-panel={stage}>
    <div className={styles["panelHeading"]}><span className={styles["icon"]}>{stage === 1 ? <Radar/> : stage === 5 ? <CalendarCheck/> : <Check/>}</span><div><span className={styles["kicker"]}>{["", "Buying signal", "Account fit", "Outreach approval", "Human follow-up", "Qualified meeting"][stage]}</span><h3>Acme Logistics</h3></div></div>
    {stage === 1 && <p>New location detected</p>}
    {stage === 2 && <ul>{["Relevant sector", "Target location", "Active requirement"].map(item => <li key={item}><Check size={15}/>{item}</li>)}</ul>}
    {stage === 3 && <Approval/>}
    {stage === 4 && <><p>Follow-up assigned <span className={styles["owner"]}>Owner: Priya</span></p><blockquote>“Let us discuss the requirement.”</blockquote></>}
    {stage === 5 && <a className={styles["primary"]} href="#pilot" onClick={e => { e.preventDefault(); const pilot = document.getElementById("pilot"); pilot?.scrollIntoView({ behavior: "instant" }); pilot?.focus({ preventScroll: true }); }}>Build your first funnel <ArrowUpRight size={18}/></a>}
  </div>;
}

export default function ScrollFunnelHero() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const scene = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const root = section.current!, visual = scene.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, current = -1;
    const update = () => {
      frame = 0;
      const top = root.getBoundingClientRect().top;
      const step = root.querySelector<HTMLElement>("#journey-signal")!.getBoundingClientRect().top - top;
      let position = Math.max(0, Math.min(5, -top / Math.max(1, step)));
      // scrollIntoView rounds to physical pixels; keep chapter boundaries exact.
      if (Math.abs(position - Math.round(position)) * step < 1) position = Math.round(position);
      const next = Math.min(5, Math.floor(position + .002));
      progress.current = reduced.matches ? next : position;
      if (next !== current) { current = next; setStage(next); }
      visual.style.setProperty("--copy-shift", reduced.matches ? "0px" : (position * 12 - 30) + "px");
      visual.style.setProperty("--panel-shift", reduced.matches ? "0px" : (position * 6) + "px");
      const fraction = reduced.matches ? 0 : Math.max(0, position - next);
      const y = POSITIONS[next]! + ((POSITIONS[Math.min(5, next + 1)]! - POSITIONS[next]!) * fraction);
      if (!visual.querySelector("[data-mesh-ready]")) {
        visual.querySelector<SVGGElement>("[data-prospect]")?.style.setProperty("transform", `translate(275px, ${y}px)`);
        visual.querySelectorAll<SVGGElement>("[data-band-label]").forEach((label, i) => label.setAttribute("transform", `translate(${257 + radiusAt(3.2 - i / 5 * 6.4) * 210 / 3.05},${120 + i / 5 * 404})`));
        const attachment = visual.querySelector<SVGCircleElement>("[data-attachment]");
        const anchorY = Math.min(POSITIONS[next]!, 466);
        attachment?.setAttribute("cx", String(275 - radiusAt(3.2 - (anchorY - 78) / 404 * 6.4) * 210 / 3.05));
        attachment?.setAttribute("cy", String(anchorY));
        const collectorLabel = visual.querySelector<HTMLElement>("[data-collector-label]");
        collectorLabel?.style.setProperty("left", "42.31%");
        collectorLabel?.style.setProperty("top", "101%");
      }
      visual.querySelector<SVGPathElement>("." + styles["trail"])?.setAttribute("d", "M275 35 V" + y);
      visual.dispatchEvent(new Event("journeyprogress"));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const followHash = () => {
      const hash = window.location.hash.slice(1);
      const index = STAGES.findIndex((item, i) => hash === "journey-" + item.id || LEGACY[i]!.includes(hash));
      if (index >= 0) document.getElementById("journey-" + STAGES[index]!.id)?.scrollIntoView({ behavior: "instant" });
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(root); resize.observe(visual);
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule); window.addEventListener("hashchange", followHash);
    reduced.addEventListener("change", schedule);
    visual.addEventListener("funnelfallback", schedule);
    followHash();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); window.removeEventListener("hashchange", followHash); reduced.removeEventListener("change", schedule); visual.removeEventListener("funnelfallback", schedule); };
  }, []);
  useEffect(() => {
    const visual = scene.current!;
    const line = visual.querySelector<SVGPathElement>("[data-connector]");
    let frame = 0;
    const draw = () => {
      const panel = visual.querySelector<HTMLElement>("[data-panel]");
      const point = visual.querySelector<SVGCircleElement>("[data-attachment]");
      const overlay = line?.ownerSVGElement;
      if (!line || !panel || !point || !overlay) { line?.setAttribute("d", ""); return; }
      const p = panel.getBoundingClientRect(), q = point.getBoundingClientRect(), box = overlay.getBoundingClientRect();
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const x = (mobile ? p.right - 35 : p.right) - box.left, y = p.top + (mobile ? 0 : 36) - box.top, endX = q.x + q.width / 2 - box.left, endY = q.y + q.height / 2 - box.top;
      const middle = x + (endX - x) / 2;
      line.setAttribute("d", `M${x} ${y} C${middle} ${y}, ${middle} ${endY}, ${endX} ${endY}`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(schedule);
    observer.observe(visual);
    visual.addEventListener("funnelprojection", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    const panel = visual.querySelector("[data-panel]");
    if (panel) observer.observe(panel);
    visual.dispatchEvent(new Event("journeyprogress"));
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); visual.removeEventListener("funnelprojection", schedule); window.removeEventListener("scroll", schedule); };
  }, [stage]);
  function navigate(event: MouseEvent<HTMLAnchorElement>, index: number) {
    event.preventDefault();
    document.getElementById("journey-" + STAGES[index]!.id)?.scrollIntoView({ behavior: "instant", block: "start" });
    window.history.replaceState(null, "", "#journey-" + STAGES[index]!.id);
  }
  function skip(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault(); const target = document.getElementById("workflow");
    target?.scrollIntoView({ behavior: "instant" }); target?.focus({ preventScroll: true });
  }
  const chapters = <nav className={styles["chapters"]} aria-label="Funnel chapters">{STAGES.map((item, i) => <a key={item.id} href={"#journey-" + item.id} onClick={e => navigate(e, i)} aria-current={stage === i ? "step" : undefined}><span>0{i}</span>{item.label}</a>)}</nav>;
  return <section id="platform" ref={section} className={styles["hero"]} style={{ "--journey-travel": (SCROLL.stepVh * 5 + SCROLL.holdVh) + "svh" } as CSSProperties} aria-label="From signal to meeting: an illustrative prospect journey">
    <div className={styles["scene"]} ref={scene} data-stage={stage}>
      <div className={styles["universe"]}><Universe progress={progress}/></div>
      <div className={styles["topline"]}><span>CRAFT YOUR NEXT OPPORTUNITY</span><a href="#workflow" onClick={skip}>Skip walkthrough <ArrowDown size={14}/></a></div>
      <div className={styles["composition"]}>
        <svg className={styles["connection"]} aria-hidden="true"><path data-connector fill="none" stroke={stage === 3 ? "#b599ff" : "#67e8f9"} strokeWidth="1.2"/></svg>
        <div className={styles["story"]}>
          <div className={styles["copy"]} key={stage}><p className={styles["kicker"]}>0{stage} / {STAGES[stage]!.label}</p><h1>{STAGES[stage]!.title} <em>{STAGES[stage]!.accent}</em></h1><p className={styles["detail"]}>{STAGES[stage]!.detail}</p></div>
          <div className={styles["panelZone"]}><Panel stage={stage} navigate={navigate}/></div>
        </div>
        <div className={styles["visual"]}><Funnel stage={stage} moving/><FunnelMesh progress={progress}/><span className={styles["collectorLabel"]} data-collector-label>Your pipeline</span></div>
      </div>
      <div className={styles["bottom"]}>{chapters}</div>
      <p className={styles["disclaimer"]}><span>Illustrative prospect journey · Example data and controls</span><span className={styles["trust"]}><ShieldCheck size={16}/> Human approval · Covospan EDGE</span></p>
    </div>
    {STAGES.map((item, i) => <span key={item.id} id={"journey-" + item.id} style={{ top: i * SCROLL.stepVh + "svh" }} className={styles["anchor"]} aria-hidden="true">{LEGACY[i]!.map(id => <span key={id} id={id}/>)}</span>)}
  </section>;
}
