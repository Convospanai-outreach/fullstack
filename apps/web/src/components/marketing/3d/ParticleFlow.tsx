"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT_DESKTOP = 420;
const PARTICLE_COUNT_MOBILE = 140;

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function getPrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface ParticleFlowProps {
  progressRef: React.MutableRefObject<number>;
  reduceMotion?: boolean;
}

export default function ParticleFlow({ progressRef, reduceMotion = false }: ParticleFlowProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.Points>(null);

  const count = useMemo(
    () => (reduceMotion ? 60 : isMobile() ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP),
    [reduceMotion],
  );

  // Base attributes
  const [positions, phases, speeds, radii, states] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const pha = new Float32Array(count);
    const spd = new Float32Array(count);
    const rad = new Float32Array(count);
    const sta = new Float32Array(count); // 0=external, 1=captured, 2=packet, 3=stalled, 4=edge, 5=revenue, 6=feedback

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4.5 + Math.random() * 3.5;
      const y = 4 + Math.random() * 8;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * r;
      pha[i] = Math.random() * Math.PI * 2;
      spd[i] = 0.4 + Math.random() * 0.6;
      rad[i] = 4.5 + Math.random() * 3.5;
      sta[i] = 0;
    }
    return [pos, pha, spd, rad, sta];
  }, [count]);

  const colors = useMemo(() => new Float32Array(count * 3), [count]);
  const sizes  = useMemo(() => new Float32Array(count).fill(2.0), [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    g.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, colors, sizes]);

  // Feedback trail (amber reverse loop)
  const trailGeo = useMemo(() => {
    const n = 40;
    const pos2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const angle = t * Math.PI * 2;
      const r = 6.5;
      pos2[i * 3]     = Math.cos(angle) * r;
      pos2[i * 3 + 1] = -9 + t * 18;
      pos2[i * 3 + 2] = Math.sin(angle) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos2, 3));
    return g;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const progress = progressRef.current;

    const posAttr  = geo.getAttribute("position") as THREE.BufferAttribute;
    const colAttr  = geo.getAttribute("color")    as THREE.BufferAttribute;
    const sizeAttr = geo.getAttribute("size")     as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      const phase = phases[i]!;
      const speed = speeds[i]!;
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);
      const r2 = Math.sqrt(x * x + z * z);

      // Determine state from progress
      let stateTarget = 0;
      if (progress > 0.92) stateTarget = 5;
      else if (progress > 0.82) stateTarget = 4;
      else if (progress > 0.68) stateTarget = 3;
      else if (progress > 0.54) stateTarget = 2;
      else if (progress > 0.4)  stateTarget = 1;

      // Gradually transition random subset of particles to new state
      if (Math.random() < 0.002) states[i] = stateTarget;
      const state = states[i]!;

      const dt = 0.016;

      // ── Flywheel churning integration ────────────────────────────────────
      const flywheelY = 9 - progress * 18;
      const distY = Math.abs(y - flywheelY);
      // Boost angular speed dynamically as particles approach the flywheel's Y
      const speedBoost = distY < 2.5 ? 1.5 + (2.5 - distY) * 1.8 : 1.0;

      if (state === 0) {
        // Market noise — drift outside
        const angle = Math.atan2(z, x) + dt * 0.08 * speed;
        const newR = r2 + Math.sin(t * speed + phase) * 0.012;
        x = Math.cos(angle) * newR;
        z = Math.sin(angle) * newR;
        y += (Math.sin(t * speed * 0.5 + phase) * 0.01 - 0.005);
        if (y < -10) y = 9 + Math.random() * 3;
        if (r2 > 10) {
          x *= 0.97;
          z *= 0.97;
        }
        setParticleColor(colAttr, sizeAttr, i, 0.18, 0.38, 0.52, 1.8);
      } else if (state === 1) {
        // Captured — spiral into funnel (churned by flywheel)
        const angle = Math.atan2(z, x) + dt * 0.35 * speed * speedBoost;
        const targetR = Math.max(0.4, r2 * 0.992 - 0.02);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 1.2 * speed;
        if (y < -9.5) { y = 8.5; x = (Math.random() - 0.5) * 10; z = (Math.random() - 0.5) * 10; states[i] = 0; }
        setParticleColor(colAttr, sizeAttr, i, 0.13, 0.83, 0.93, 2.6);
      } else if (state === 2) {
        // Outreach packet — violet spiral (churned by flywheel)
        const angle = Math.atan2(z, x) + dt * 0.5 * speed * speedBoost;
        const targetR = Math.max(0.3, r2 * 0.994 - 0.015);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        // Approval checkpoint pause
        if (y > 2.5 && y < 3.5) { y -= dt * 0.3 * speed; }
        else { y -= dt * 1.5 * speed; }
        if (y < -9.5) { y = 8.0; x = (Math.random() - 0.5) * 8; z = (Math.random() - 0.5) * 8; states[i] = 1; }
        setParticleColor(colAttr, sizeAttr, i, 0.55, 0.36, 0.96, 2.8);
      } else if (state === 3) {
        // Human rescue — mint loop (churned by flywheel)
        const angle = Math.atan2(z, x) + dt * 0.3 * speed * speedBoost;
        const wobble = Math.sin(t * 1.2 + phase) * 0.06;
        const targetR = Math.max(0.3, r2 * 0.995 + wobble);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 0.9 * speed;
        if (y < -9.5) { y = 7.5; states[i] = 2; }
        setParticleColor(colAttr, sizeAttr, i, 0.2, 0.83, 0.6, 3.0);
      } else if (state === 4) {
        // Edge secured — crystal tight spiral (churned by flywheel)
        const angle = Math.atan2(z, x) + dt * 0.6 * speed * speedBoost;
        const targetR = Math.max(0.2, r2 * 0.996 - 0.01);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 1.8 * speed;
        if (y < -9.5) { y = 7.0; states[i] = 3; }
        setParticleColor(colAttr, sizeAttr, i, 0.38, 0.65, 0.98, 2.4);
      } else {
        // Revenue output — amber convergence toward the chest at [0, -10.5, 0]
        const angle = Math.atan2(z, x) + dt * 0.9 * speed;
        x = Math.cos(angle) * Math.min(r2 + 0.04, 2.5);
        z = Math.sin(angle) * Math.min(r2 + 0.04, 2.5);
        y -= dt * 2.2 * speed;
        // Once past the funnel throat, spiral inward toward the chest centre
        if (y < -9.0) {
          x *= 0.93;
          z *= 0.93;
        }
        if (y < -11.5) {
          // Respawn above the funnel to keep the loop going
          y = -7 + Math.random() * 2;
          x = (Math.random() - 0.5) * 2;
          z = (Math.random() - 0.5) * 2;
        }
        setParticleColor(colAttr, sizeAttr, i, 0.98, 0.75, 0.14, 4.0);
      }

      posAttr.setXYZ(i, x, y, z);
    }

    posAttr.needsUpdate  = true;
    colAttr.needsUpdate  = true;
    sizeAttr.needsUpdate = true;

    // Feedback trail visibility
    if (trailRef.current) {
      const mat = trailRef.current.material as THREE.PointsMaterial;
      mat.opacity = progress > 0.92 ? 0.55 + 0.2 * Math.sin(t * 1.5) : 0;
    }
  });

  return (
    <>
      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.85}
          size={0.14}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Feedback loop trail */}
      <points ref={trailRef} geometry={trailGeo}>
        <pointsMaterial
          color={0xfbbf24}
          sizeAttenuation
          transparent
          opacity={0}
          size={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

function setParticleColor(
  colAttr: THREE.BufferAttribute,
  sizeAttr: THREE.BufferAttribute,
  i: number,
  r: number,
  g: number,
  b: number,
  size: number,
) {
  colAttr.setXYZ(i, r, g, b);
  sizeAttr.setX(i, size);
}
