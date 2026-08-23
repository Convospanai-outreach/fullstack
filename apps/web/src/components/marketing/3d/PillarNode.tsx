"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PillarDef } from "./sceneConfig";

interface PillarNodeProps {
  pillar: PillarDef;
  progressRef: React.MutableRefObject<number>;
}

function funnelRadiusAtY(y: number): number {
  const t = Math.max(0, Math.min(1, (12.5 - y) / 23.0));
  return 5.8 - t * 4.4 + Math.sin(t * Math.PI) * 0.8;
}

export default function PillarNode({ pillar, progressRef }: PillarNodeProps) {
  const groupRef       = useRef<THREE.Group>(null);
  const coreRef        = useRef<THREE.Mesh>(null);
  const motifGroupRef  = useRef<THREE.Group>(null);
  const ring1Ref       = useRef<THREE.Mesh>(null);
  const ring2Ref       = useRef<THREE.Mesh>(null);
  const ring3Ref       = useRef<THREE.Mesh>(null);
  const spokeLineRef   = useRef<THREE.Line>(null);
  const spiralDotRef   = useRef<THREE.Mesh>(null);
  const dataPacketRef  = useRef<THREE.Mesh>(null);

  const [px, py, pz] = pillar.position;

  // ── 1. Spoke Geometry & Data Laser ─────────────────────────────────────────
  const { spokeObj, attachLocal } = useMemo(() => {
    const funnelR = funnelRadiusAtY(py);
    const angle   = Math.atan2(pz, px);

    const ax = Math.cos(angle) * funnelR;
    const az = Math.sin(angle) * funnelR;

    const localPillar = new THREE.Vector3(0, 0, 0);
    const localAttach = new THREE.Vector3(ax - px, 0, az - pz);

    const sg = new THREE.BufferGeometry().setFromPoints([localPillar, localAttach]);
    const pillarColor = new THREE.Color(pillar.color);

    const sObj = new THREE.Line(
      sg,
      new THREE.LineBasicMaterial({ color: pillarColor, transparent: true, opacity: 0, linewidth: 2 }),
    );

    return { spokeObj: sObj, attachLocal: localAttach };
  }, [px, py, pz, pillar.color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const progress = progressRef.current;
    const isActive = progress >= pillar.activeAt;
    const intensity = isActive
      ? Math.min(1, (progress - pillar.activeAt) / 0.12)
      : 0;

    // ── Floating Node Position ───────────────────────────────────────────────
    if (groupRef.current) {
      const scale = 0.45 + intensity * 0.55;
      groupRef.current.scale.setScalar(scale);
      groupRef.current.position.y = py + (1 - intensity) * 1.5 + Math.sin(t * 1.5 + pillar.index) * 0.15;
    }

    // ── Core Pulsing ─────────────────────────────────────────────────────────
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 0.65 + 0.35 * Math.sin(t * 3.0 + pillar.index);
      mat.opacity = (0.2 + intensity * 0.8) * pulse;
      coreRef.current.scale.setScalar(1 + (isActive ? Math.sin(t * 4) * 0.15 : 0));
    }

    // ── Motif-Specific Rotations & Animations ────────────────────────────────
    if (motifGroupRef.current) {
      if (pillar.motif === "radar") {
        motifGroupRef.current.rotation.z = t * 1.6;
      } else if (pillar.motif === "outreach") {
        motifGroupRef.current.rotation.x = t * 1.2;
        motifGroupRef.current.rotation.y = t * 0.8;
      } else if (pillar.motif === "human-loop") {
        motifGroupRef.current.rotation.y = -t * 1.4;
        motifGroupRef.current.rotation.z = Math.sin(t * 2) * 0.4;
      } else if (pillar.motif === "edge-shield") {
        motifGroupRef.current.rotation.x = t * 0.9;
        motifGroupRef.current.rotation.y = t * 0.9;
      }
    }

    // ── Radar Expanding Scan Rings ───────────────────────────────────────────
    if (ring1Ref.current && ring2Ref.current && ring3Ref.current) {
      if (pillar.motif === "radar") {
        const p1 = (t * 0.6) % 1;
        const p2 = ((t * 0.6) + 0.33) % 1;
        const p3 = ((t * 0.6) + 0.66) % 1;

        ring1Ref.current.scale.setScalar(1 + p1 * 1.6);
        (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = intensity * (1 - p1) * 0.7;

        ring2Ref.current.scale.setScalar(1 + p2 * 1.6);
        (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = intensity * (1 - p2) * 0.7;

        ring3Ref.current.scale.setScalar(1 + p3 * 1.6);
        (ring3Ref.current.material as THREE.MeshBasicMaterial).opacity = intensity * (1 - p3) * 0.7;
      }
    }

    // ── Spoke Brightness & Laser Pulse ───────────────────────────────────────
    if (spokeLineRef.current) {
      const mat = spokeLineRef.current.material as THREE.LineBasicMaterial;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 2.5 + pillar.index));
      mat.opacity = intensity * pulse;
    }

    // Traveling Data Packet along Spoke
    if (dataPacketRef.current) {
      const mat = dataPacketRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = intensity > 0.1 ? 0.9 : 0;
      const lerpVal = (t * 1.5 + pillar.index * 0.25) % 1;
      dataPacketRef.current.position.set(
        attachLocal.x * lerpVal,
        0,
        attachLocal.z * lerpVal
      );
    }

    // Spiral-attachment dot
    if (spiralDotRef.current) {
      const mat = spiralDotRef.current.material as THREE.MeshBasicMaterial;
      const glow = 0.5 + 0.5 * Math.sin(t * 3.2 + pillar.index);
      mat.opacity = intensity * glow;
      spiralDotRef.current.scale.setScalar(1 + glow * 0.4);
    }
  });

  const color = new THREE.Color(pillar.color);

  return (
    <group ref={groupRef} position={[px, py, pz]}>
      {/* 1. Core Energy Sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* 2. Motif Specific 3D Mesh Geometry */}
      <group ref={motifGroupRef}>
        {pillar.motif === "radar" && (
          <>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.2, 0.75, 24]} />
              <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.2]} rotation={[0, 0, 0]}>
              <coneGeometry args={[0.25, 0.6, 12, 1, true]} />
              <meshBasicMaterial color={color} transparent opacity={0.4} wireframe={true} />
            </mesh>
          </>
        )}

        {pillar.motif === "outreach" && (
          <>
            {/* Dual interlocking approval gimbals */}
            <mesh rotation={[0, 0, 0]}>
              <torusGeometry args={[0.65, 0.035, 8, 36]} />
              <meshBasicMaterial color={color} transparent opacity={0.5} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.65, 0.035, 8, 36]} />
              <meshBasicMaterial color={color} transparent opacity={0.5} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <octahedronGeometry args={[0.28, 0]} />
              <meshBasicMaterial color={0xffffff} transparent opacity={0.8} />
            </mesh>
          </>
        )}

        {pillar.motif === "human-loop" && (
          <>
            {/* Double infinity loop helix */}
            <mesh rotation={[Math.PI / 4, 0, 0]}>
              <torusGeometry args={[0.68, 0.04, 8, 36]} />
              <meshBasicMaterial color={color} transparent opacity={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 4, 0, 0]}>
              <torusGeometry args={[0.68, 0.04, 8, 36]} />
              <meshBasicMaterial color={color} transparent opacity={0.6} />
            </mesh>
          </>
        )}

        {pillar.motif === "edge-shield" && (
          <>
            {/* Cryptographic icosahedron containment */}
            <mesh>
              <icosahedronGeometry args={[0.72, 0]} />
              <meshBasicMaterial color={color} transparent opacity={0.35} wireframe={true} />
            </mesh>
            <mesh>
              <dodecahedronGeometry args={[0.42, 0]} />
              <meshBasicMaterial color={0xffffff} transparent opacity={0.7} />
            </mesh>
          </>
        )}
      </group>

      {/* 3. Outer Aura Halo */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.02, 6, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>

      {/* 4. Radar Expanding Rings */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.025, 6, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.025, 6, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.025, 6, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>

      {/* 5. Laser Spoke Conduit */}
      <primitive object={spokeObj} ref={spokeLineRef} />

      {/* 6. High-Velocity Data Packet (traveling photon) */}
      <mesh ref={dataPacketRef}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color={0xffffff} transparent opacity={0} />
      </mesh>

      {/* 7. Funnel Spiral Surface Landing Node */}
      <mesh ref={spiralDotRef} position={[attachLocal.x, 0, attachLocal.z]}>
        <sphereGeometry args={[0.15, 14, 14]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
      </mesh>
    </group>
  );
}
