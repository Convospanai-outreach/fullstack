"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FlywheelCoreProps {
  progressRef: React.MutableRefObject<number>;
}

// Colour constants matching sceneConfig.ts
const CYAN    = 0x22d3ee;
const VIOLET  = 0x8b5cf6;
const MINT    = 0x10b981;
const CRYSTAL = 0x60a5fa;
const AMBER   = 0xfbbf24;
const SLATE   = 0x334155;

export default function FlywheelCore({ progressRef }: FlywheelCoreProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const innerRef   = useRef<THREE.Mesh>(null);   // radius 1.4
  const midRef     = useRef<THREE.Mesh>(null);   // radius 2.1
  const outerRef   = useRef<THREE.Mesh>(null);   // radius 2.9
  const hubRef     = useRef<THREE.Mesh>(null);

  // ── Spoke lines created ONCE via useMemo ───────────────────────────────────
  const spokeObjects = useMemo(() => {
    const spokes: THREE.Line[] = [];
    const count = 8;
    const mat = new THREE.LineBasicMaterial({
      color: SLATE,
      transparent: true,
      opacity: 0.08,
    });
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle) * 2.9, 0, Math.sin(angle) * 2.9),
      ]);
      // Each spoke gets its OWN material instance so opacity can be mutated
      spokes.push(new THREE.Line(geo, mat.clone()));
    }
    return spokes;
  }, []);

  const spokeRefs = useRef<THREE.Line[]>(spokeObjects);

  useFrame(({ clock }) => {
    const t        = clock.getElapsedTime();
    const progress = progressRef.current;

    // ── Compute active colour & target opacities per ring ─────────────────
    let innerColor  = SLATE,  innerOp  = 0.12;
    let midColor    = SLATE,  midOp    = 0.10;
    let outerColor  = SLATE,  outerOp  = 0.08;
    let hubColor    = SLATE,  hubOp    = 0.20;
    let spokeOp = 0.06 + progress * 0.22;

    if (progress >= 0.92) {
      innerColor = AMBER;  innerOp  = 0.80 + 0.20 * Math.sin(t * 3.0);
      midColor   = AMBER;  midOp    = 0.70 + 0.20 * Math.sin(t * 2.4 + 1);
      outerColor = AMBER;  outerOp  = 0.60 + 0.20 * Math.sin(t * 1.8 + 2);
      hubColor   = AMBER;  hubOp    = 0.90;
      spokeOp = 0.55 + 0.25 * Math.sin(t * 2.0);
    } else if (progress >= 0.82) {
      innerColor = CRYSTAL; innerOp  = 0.70 + 0.20 * Math.sin(t * 2.8);
      midColor   = CRYSTAL; midOp    = 0.60 + 0.20 * Math.sin(t * 2.1);
      outerColor = CRYSTAL; outerOp  = 0.50 + 0.20 * Math.sin(t * 1.6);
      hubColor   = CRYSTAL; hubOp    = 0.75;
    } else if (progress >= 0.68) {
      outerColor = MINT;   outerOp  = 0.55 + 0.20 * Math.sin(t * 1.8);
      midColor   = VIOLET; midOp    = 0.30;
      innerColor = CYAN;   innerOp  = 0.30;
      hubColor   = MINT;   hubOp    = 0.60;
    } else if (progress >= 0.54) {
      midColor   = VIOLET; midOp    = 0.50 + 0.20 * Math.sin(t * 2.2);
      innerColor = CYAN;   innerOp  = 0.30;
      outerColor = SLATE;  outerOp  = 0.08;
      hubColor   = VIOLET; hubOp    = 0.55;
    } else if (progress >= 0.40) {
      innerColor = CYAN;   innerOp  = 0.45 + 0.20 * Math.sin(t * 2.6);
      midColor   = SLATE;  midOp    = 0.10;
      outerColor = SLATE;  outerOp  = 0.08;
      hubColor   = CYAN;   hubOp    = 0.50;
    }

    // ── Apply rotation ─────────────────────────────────────────────────────
    if (innerRef.current) {
      innerRef.current.rotation.z = t * 0.9;
      const mat = innerRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(innerColor);
      mat.opacity = innerOp;
    }
    if (midRef.current) {
      midRef.current.rotation.z = -t * 0.55;
      const mat = midRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(midColor);
      mat.opacity = midOp;
    }
    if (outerRef.current) {
      outerRef.current.rotation.z = t * 0.3;
      const mat = outerRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(outerColor);
      mat.opacity = outerOp;
    }
    if (hubRef.current) {
      hubRef.current.rotation.y = t * 1.2;
      const mat = hubRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(hubColor);
      mat.opacity = hubOp;
    }

    // ── Spoke opacity ───────────────────────────────────────────────────────
    spokeRefs.current.forEach((spoke) => {
      const mat = spoke.material as THREE.LineBasicMaterial;
      mat.opacity = spokeOp;
      if (progress >= 0.92) mat.color.setHex(AMBER);
      else if (progress >= 0.82) mat.color.setHex(CRYSTAL);
      else mat.color.setHex(SLATE);
    });
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Hub */}
      <mesh ref={hubRef}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.2} />
      </mesh>

      {/* Inner ring — radius 1.4, fastest CW */}
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.035, 8, 64]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.12} />
      </mesh>

      {/* Middle ring — radius 2.1, CCW */}
      <mesh ref={midRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.035, 8, 64]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.10} />
      </mesh>

      {/* Outer ring — radius 2.9, slowest CW */}
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.9, 0.038, 8, 80]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.08} />
      </mesh>

      {/* 8 Radial spokes — created in useMemo, never inline */}
      {spokeObjects.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  );
}
