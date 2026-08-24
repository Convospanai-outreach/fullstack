"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT_DESKTOP = 600;
const PARTICLE_COUNT_MOBILE  = 200;

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

interface ParticleFlowProps {
  progressRef: React.MutableRefObject<number>;
  reduceMotion?: boolean;
}

export default function ParticleFlow({ progressRef, reduceMotion = false }: ParticleFlowProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);

  const count = useMemo(
    () => (reduceMotion ? 80 : isMobile() ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP),
    [reduceMotion],
  );

  // ── 1. Base Stream Attributes ──────────────────────────────────────────────
  const [positions, phases, speeds, radii, states] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const pha = new Float32Array(count);
    const spd = new Float32Array(count);
    const rad = new Float32Array(count);
    const sta = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4.8 + Math.random() * 4.0;
      const y = 4 + Math.random() * 9;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * r;
      pha[i] = Math.random() * Math.PI * 2;
      spd[i] = 0.5 + Math.random() * 0.7;
      rad[i] = 4.8 + Math.random() * 4.0;
      sta[i] = 0;
    }
    return [pos, pha, spd, rad, sta];
  }, [count]);

  const colors = useMemo(() => new Float32Array(count * 3), [count]);
  const sizes  = useMemo(() => new Float32Array(count).fill(2.5), [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    g.setAttribute("size",     new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, colors, sizes]);

  // ── 2. Gold Revenue Fountain Sparks ────────────────────────────────────────
  const sparkCount = 80;
  const [sparkPos, sparkVelo] = useMemo(() => {
    const sp = new Float32Array(sparkCount * 3);
    const sv = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      sp[i * 3]     = (Math.random() - 0.5) * 1.5;
      sp[i * 3 + 1] = -10.5 + Math.random() * 2;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      sv[i * 3]     = (Math.random() - 0.5) * 0.08;
      sv[i * 3 + 1] = 0.08 + Math.random() * 0.12; // burst upward
      sv[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    }
    return [sp, sv];
  }, [sparkCount]);

  const sparkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    return g;
  }, [sparkPos]);

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

      // State Assignment based on scroll progression
      let stateTarget = 0;
      if (progress > 0.90) stateTarget = 5;
      else if (progress > 0.80) stateTarget = 4;
      else if (progress > 0.65) stateTarget = 3;
      else if (progress > 0.50) stateTarget = 2;
      else if (progress > 0.35) stateTarget = 1;

      if (Math.random() < 0.003) states[i] = stateTarget;
      const state = states[i]!;

      const dt = 0.016;
      const flywheelY = 12.2 - progress * 22.7;
      const distY = Math.abs(y - flywheelY);
      const speedBoost = distY < 3.0 ? 1.6 + (3.0 - distY) * 1.5 : 1.0;

      if (state === 0) {
        // Market Ambient Cloud
        const angle = Math.atan2(z, x) + dt * 0.12 * speed;
        const newR = r2 + Math.sin(t * speed + phase) * 0.015;
        x = Math.cos(angle) * newR;
        z = Math.sin(angle) * newR;
        y += (Math.sin(t * speed * 0.5 + phase) * 0.01 - 0.006);
        if (y < -11) y = 10 + Math.random() * 4;
        setParticleColor(colAttr, sizeAttr, i, 0.22, 0.45, 0.65, 2.2);
      } else if (state === 1) {
        // Signal Ingestion (Cyan Vortex)
        const angle = Math.atan2(z, x) + dt * 0.45 * speed * speedBoost;
        const targetR = Math.max(0.4, r2 * 0.991 - 0.025);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 1.4 * speed;
        if (y < -10.5) { y = 9.5; x = (Math.random() - 0.5) * 11; z = (Math.random() - 0.5) * 11; states[i] = 0; }
        setParticleColor(colAttr, sizeAttr, i, 0.22, 0.85, 0.97, 3.2);
      } else if (state === 2) {
        // AI Outreach Packet (Indigo/Violet Acceleration)
        const angle = Math.atan2(z, x) + dt * 0.65 * speed * speedBoost;
        const targetR = Math.max(0.3, r2 * 0.993 - 0.02);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 1.8 * speed;
        if (y < -10.5) { y = 9.0; x = (Math.random() - 0.5) * 9; z = (Math.random() - 0.5) * 9; states[i] = 1; }
        setParticleColor(colAttr, sizeAttr, i, 0.58, 0.42, 0.98, 3.5);
      } else if (state === 3) {
        // Human Loop Rescue (Emerald Mint)
        const angle = Math.atan2(z, x) + dt * 0.45 * speed * speedBoost;
        const wobble = Math.sin(t * 1.6 + phase) * 0.08;
        const targetR = Math.max(0.3, r2 * 0.994 + wobble);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 1.2 * speed;
        if (y < -10.5) { y = 8.5; states[i] = 2; }
        setParticleColor(colAttr, sizeAttr, i, 0.25, 0.92, 0.65, 3.4);
      } else if (state === 4) {
        // EDGE Sovereign Stream (Sapphire Blue)
        const angle = Math.atan2(z, x) + dt * 0.85 * speed * speedBoost;
        const targetR = Math.max(0.2, r2 * 0.995 - 0.015);
        x = Math.cos(angle) * targetR;
        z = Math.sin(angle) * targetR;
        y -= dt * 2.2 * speed;
        if (y < -10.5) { y = 8.0; states[i] = 3; }
        setParticleColor(colAttr, sizeAttr, i, 0.38, 0.75, 1.0, 3.2);
      } else {
        // Revenue Output (Amber Gold Vortex into Chest)
        const angle = Math.atan2(z, x) + dt * 1.1 * speed;
        x = Math.cos(angle) * Math.min(r2 + 0.05, 2.8);
        z = Math.sin(angle) * Math.min(r2 + 0.05, 2.8);
        y -= dt * 2.6 * speed;
        if (y < -9.5) {
          x *= 0.92;
          z *= 0.92;
        }
        if (y < -11.8) {
          y = -6 + Math.random() * 2;
          x = (Math.random() - 0.5) * 2;
          z = (Math.random() - 0.5) * 2;
        }
        setParticleColor(colAttr, sizeAttr, i, 0.98, 0.80, 0.18, 4.8);
      }

      posAttr.setXYZ(i, x, y, z);
    }

    posAttr.needsUpdate  = true;
    colAttr.needsUpdate  = true;
    sizeAttr.needsUpdate = true;

    // ── Animate Gold Revenue Sparks Fountain ─────────────────────────────────
    if (sparkPointsRef.current) {
      const spAttr = sparkGeo.getAttribute("position") as THREE.BufferAttribute;
      const activeSparks = progress > 0.88;
      const mat = sparkPointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = activeSparks ? 0.9 : 0;

      if (activeSparks) {
        for (let i = 0; i < sparkCount; i++) {
          let sx = spAttr.getX(i);
          let sy = spAttr.getY(i);
          let sz = spAttr.getZ(i);

          sx += sparkVelo[i * 3]!;
          sy += sparkVelo[i * 3 + 1]!;
          sz += sparkVelo[i * 3 + 2]!;

          // Decay & Loop
          if (sy > -4.0) {
            sx = (Math.random() - 0.5) * 1.2;
            sy = -10.5;
            sz = (Math.random() - 0.5) * 1.2;
          }
          spAttr.setXYZ(i, sx, sy, sz);
        }
        spAttr.needsUpdate = true;
      }
    }
  });

  return (
    <>
      {/* Primary Vortex Particle Nebula */}
      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.92}
          size={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Upward Amber Revenue Sparks Fountain */}
      <points ref={sparkPointsRef} geometry={sparkGeo}>
        <pointsMaterial
          color={0xfbbf24}
          sizeAttenuation
          transparent
          opacity={0}
          size={0.18}
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
