"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PillarDef } from "./sceneConfig";

interface PillarNodeProps {
  pillar: PillarDef;
  progressRef: React.MutableRefObject<number>;
}

/**
 * Returns the radius of the funnel at a given world-space Y coordinate.
 * Mirrors the geometry in FunnelGeometry.tsx exactly so spokes land on
 * the visible spiral rail.
 *
 *   Funnel top:    y = +9   (t = 0)  → r ≈ 5.2
 *   Funnel bottom: y = -9   (t = 1)  → r ≈ 1.4
 */
function funnelRadiusAtY(y: number): number {
  const t = Math.max(0, Math.min(1, (9 - y) / 18));
  return 5.2 - t * 3.8 + Math.sin(t * Math.PI) * 0.6;
}

export default function PillarNode({ pillar, progressRef }: PillarNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef  = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  // Spoke refs: main spoke + a short connector from spiral surface to core
  const spokeLineRef    = useRef<THREE.Line>(null);
  const connectorRef    = useRef<THREE.Line>(null);
  const spiralDotRef    = useRef<THREE.Mesh>(null);

  const [px, py, pz] = pillar.position;

  // ── Spoke geometry ────────────────────────────────────────────────────────
  // Attachment point: the funnel spiral surface at the pillar's y-level,
  // at the same radial angle as the pillar so the spoke is perpendicular
  // to the funnel axis and clearly connects to the ring.
  const { spokeGeo, connectorGeo, spokeObj, connectorObj, attachPt } = useMemo(() => {
    const funnelR = funnelRadiusAtY(py);
    const angle   = Math.atan2(pz, px);   // radial angle of pillar

    // Point on the funnel surface at same height & angle
    const ax = Math.cos(angle) * funnelR;
    const az = Math.sin(angle) * funnelR;
    const attach = new THREE.Vector3(ax, py, az);

    // Pillar node is at local (0,0,0) because the group is translated to [px,py,pz]
    const localPillar  = new THREE.Vector3(0, 0, 0);
    const localAttach  = new THREE.Vector3(ax - px, 0, az - pz);

    const sg = new THREE.BufferGeometry().setFromPoints([localPillar, localAttach]);

    // Short connector dot-line on the spiral side: spiral surface → slightly inward
    const innerPt = new THREE.Vector3(
      ax - px + Math.cos(angle) * 0.4,
      0,
      az - pz + Math.sin(angle) * 0.4,
    );
    const cg = new THREE.BufferGeometry().setFromPoints([localAttach, innerPt]);

    // Create the Line objects once here — NOT inline in JSX (breaks R3F scene tracking)
    const pillarColor = new THREE.Color(pillar.color);
    const sObj = new THREE.Line(
      sg,
      new THREE.LineBasicMaterial({ color: pillarColor, transparent: true, opacity: 0, linewidth: 1 }),
    );
    const cObj = new THREE.Line(
      cg,
      new THREE.LineBasicMaterial({ color: pillarColor, transparent: true, opacity: 0 }),
    );

    return { spokeGeo: sg, connectorGeo: cg, spokeObj: sObj, connectorObj: cObj, attachPt: attach };
  }, [px, py, pz, pillar.color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const progress = progressRef.current;
    const isActive = progress >= pillar.activeAt;
    const intensity = isActive
      ? Math.min(1, (progress - pillar.activeAt) / 0.14)
      : 0;

    // ── Group position (appear from slightly above) ──────────────────────
    if (groupRef.current) {
      const scale = 0.35 + intensity * 0.65;
      groupRef.current.scale.setScalar(scale);
      groupRef.current.position.y = py + (1 - intensity) * 1.8;
    }

    // ── Core pulse + motif rotation ──────────────────────────────────────
    if (coreRef.current) {
      const mat  = coreRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + pillar.index);
      mat.opacity = intensity * pulse;

      if (pillar.motif === "radar") {
        coreRef.current.rotation.z = t * 1.2;
      } else if (pillar.motif === "human-loop") {
        coreRef.current.rotation.z = -t * 0.8;
      } else if (pillar.motif === "edge-shield") {
        coreRef.current.rotation.x = t * 0.6;
        coreRef.current.rotation.y = t * 0.6;
      }
    }

    // ── Spoke brightness (travelling-pulse effect) ───────────────────────
    if (spokeLineRef.current) {
      const mat = spokeLineRef.current.material as THREE.LineBasicMaterial;
      const pulse = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.8 + pillar.index * 0.9));
      mat.opacity = intensity * pulse;
    }

    if (connectorRef.current) {
      const mat = connectorRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = intensity * 0.55;
    }

    // Spiral-attachment dot
    if (spiralDotRef.current) {
      const mat = spiralDotRef.current.material as THREE.MeshBasicMaterial;
      const glow = 0.5 + 0.5 * Math.sin(t * 2.6 + pillar.index);
      mat.opacity = intensity * glow;
      spiralDotRef.current.rotation.y = t * 0.4;
    }

    // ── Expanding scan rings (radar only) ────────────────────────────────
    if (ring1Ref.current && ring2Ref.current) {
      if (pillar.motif === "radar") {
        const p1 = (t * 0.5) % 1;
        ring1Ref.current.scale.setScalar(1 + p1 * 1.4);
        (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity =
          intensity * (1 - p1) * 0.55;

        const p2 = ((t * 0.5) + 0.5) % 1;
        ring2Ref.current.scale.setScalar(1 + p2 * 1.4);
        (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity =
          intensity * (1 - p2) * 0.55;
      } else {
        (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
        (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  const color     = new THREE.Color(pillar.color);
  const attachLocal = new THREE.Vector3(
    attachPt.x - px,
    0,
    attachPt.z - pz,
  );

  return (
    <group ref={groupRef} position={[px, py, pz]}>

      {/* ── Core node sphere ─────────────────────────────────────────── */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.38, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>

      {/* ── Outer glow ring ──────────────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.045, 8, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* ── Radar scan rings ─────────────────────────────────────────── */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.025, 6, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.7, 0.025, 6, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>

      {/* ── Spoke: pillar → funnel spiral surface ────────────────────── */}
      <primitive
        object={spokeObj}
        ref={spokeLineRef}
      />

      {/* ── Short connector tick at the spiral attachment point ───────── */}
      <primitive
        object={connectorObj}
        ref={connectorRef}
      />

      {/* ── Glowing dot at the spiral surface attachment point ────────── */}
      <mesh
        ref={spiralDotRef}
        position={[attachLocal.x, 0, attachLocal.z]}
      >
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
    </group>
  );
}
