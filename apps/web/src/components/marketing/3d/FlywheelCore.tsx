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
  const innerRef   = useRef<THREE.Mesh>(null);   // radius 1.75
  const midRef     = useRef<THREE.Mesh>(null);   // radius 2.55
  const outerRef   = useRef<THREE.Mesh>(null);   // radius 3.45
  const hubRef     = useRef<THREE.Mesh>(null);

  // ── Spoke lines created ONCE via useMemo ───────────────────────────────────
  const spokeObjects = useMemo(() => {
    const spokes: THREE.Line[] = [];
    const count = 10;
    const mat = new THREE.LineBasicMaterial({
      color: SLATE,
      transparent: true,
      opacity: 0.18,
    });
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle) * 3.45, 0, Math.sin(angle) * 3.45),
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

    // ── Dynamic Position & Scale (Ride down and stay visually readable) ──────
    if (groupRef.current) {
      // Y now starts higher so the flywheel participates in the opening hero.
      const targetY = 12.2 - progress * 22.7;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.1);

      // Keep the flywheel significantly larger through the journey.
      const targetScale = Math.max(0.42, 1.45 - progress * 1.03);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.1));

      // Turn/point the flywheel towards the active text card (left or right)
      // NetJana (0.40) -> right (0 rad), CMF Core (0.54) -> left (PI rad),
      // Human (0.68) -> right (0 rad), EDGE (0.82) -> left (PI rad).
      let targetRotY = t * 0.15; // base spin
      if (progress >= 0.82 && progress < 0.92) {
        targetRotY = Math.PI; // EDGE (left)
      } else if (progress >= 0.68 && progress < 0.82) {
        targetRotY = 0; // Human Layer (right)
      } else if (progress >= 0.54 && progress < 0.68) {
        targetRotY = Math.PI; // CMF Core (left)
      } else if (progress >= 0.40 && progress < 0.54) {
        targetRotY = 0; // NetJana (right)
      }
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.08);
    }

    // ── Compute active colour & target opacities per ring ─────────────────
    let innerColor  = SLATE,  innerOp  = 0.28;
    let midColor    = SLATE,  midOp    = 0.22;
    let outerColor  = SLATE,  outerOp  = 0.18;
    let hubColor    = SLATE,  hubOp    = 0.38;
    let spokeOp = 0.18 + progress * 0.34;

    if (progress >= 0.92) {
      innerColor = AMBER;  innerOp  = 0.88 + 0.12 * Math.sin(t * 3.0);
      midColor   = AMBER;  midOp    = 0.78 + 0.18 * Math.sin(t * 2.4 + 1);
      outerColor = AMBER;  outerOp  = 0.68 + 0.18 * Math.sin(t * 1.8 + 2);
      hubColor   = AMBER;  hubOp    = 0.95;
      spokeOp = 0.65 + 0.25 * Math.sin(t * 2.0);
    } else if (progress >= 0.82) {
      innerColor = CRYSTAL; innerOp  = 0.78 + 0.18 * Math.sin(t * 2.8);
      midColor   = CRYSTAL; midOp    = 0.68 + 0.18 * Math.sin(t * 2.1);
      outerColor = CRYSTAL; outerOp  = 0.58 + 0.18 * Math.sin(t * 1.6);
      hubColor   = CRYSTAL; hubOp    = 0.82;
    } else if (progress >= 0.68) {
      outerColor = MINT;   outerOp  = 0.66 + 0.18 * Math.sin(t * 1.8);
      midColor   = VIOLET; midOp    = 0.44;
      innerColor = CYAN;   innerOp  = 0.44;
      hubColor   = MINT;   hubOp    = 0.70;
    } else if (progress >= 0.54) {
      midColor   = VIOLET; midOp    = 0.62 + 0.18 * Math.sin(t * 2.2);
      innerColor = CYAN;   innerOp  = 0.44;
      outerColor = SLATE;  outerOp  = 0.20;
      hubColor   = VIOLET; hubOp    = 0.66;
    } else if (progress >= 0.40) {
      innerColor = CYAN;   innerOp  = 0.58 + 0.20 * Math.sin(t * 2.6);
      midColor   = SLATE;  midOp    = 0.24;
      outerColor = SLATE;  outerOp  = 0.18;
      hubColor   = CYAN;   hubOp    = 0.62;
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
        <sphereGeometry args={[0.32, 20, 20]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.38} />
      </mesh>

      {/* Inner ring — radius 1.75, fastest CW */}
      <mesh ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.75, 0.055, 10, 80]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.28} />
      </mesh>

      {/* Middle ring — radius 2.55, CCW */}
      <mesh ref={midRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.55, 0.055, 10, 88]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.22} />
      </mesh>

      {/* Outer ring — radius 3.45, slowest CW */}
      <mesh ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.45, 0.06, 10, 96]} />
        <meshBasicMaterial color={SLATE} transparent opacity={0.18} />
      </mesh>

      {/* 10 Radial spokes — created in useMemo, never inline */}
      {spokeObjects.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  );
}
