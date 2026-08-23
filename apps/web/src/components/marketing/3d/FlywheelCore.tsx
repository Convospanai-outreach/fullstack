"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FlywheelCoreProps {
  progressRef: React.MutableRefObject<number>;
}

// Cybernetic Palette
const CYAN_BRIGHT   = 0x38bdf8;
const CYAN_CORE     = 0x06b6d4;
const INDIGO_VIOLET = 0x818cf8;
const EMERALD_MINT  = 0x34d399;
const CRYSTAL_BLUE  = 0x60a5fa;
const AMBER_GOLD    = 0xfbbf24;
const SLATE_DARK    = 0x334155;

export default function FlywheelCore({ progressRef }: FlywheelCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const plasmaCoreRef = useRef<THREE.Mesh>(null);
  const plasmaAuraRef = useRef<THREE.Mesh>(null);
  const innerRingRef  = useRef<THREE.Mesh>(null); // r = 1.6
  const midRingRef    = useRef<THREE.Mesh>(null); // r = 2.6
  const outerRingRef  = useRef<THREE.Mesh>(null); // r = 3.6
  const gimbalXRef    = useRef<THREE.Mesh>(null);
  const gimbalYRef    = useRef<THREE.Mesh>(null);

  // ── 1. Laser Spokes & Notches ──────────────────────────────────────────────
  const { spokeObjects, notchObjects } = useMemo(() => {
    const spokes: THREE.Line[] = [];
    const count = 12;
    const baseMat = new THREE.LineBasicMaterial({
      color: SLATE_DARK,
      transparent: true,
      opacity: 0.3,
    });

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle) * 3.6, 0, Math.sin(angle) * 3.6),
      ]);
      spokes.push(new THREE.Line(geo, baseMat.clone()));
    }

    // Outer telemetry notches (small tick marks)
    const notches: THREE.Line[] = [];
    const notchCount = 36;
    for (let i = 0; i < notchCount; i++) {
      const angle = (i / notchCount) * Math.PI * 2;
      const rInner = 3.55;
      const rOuter = i % 3 === 0 ? 3.75 : 3.65;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(angle) * rInner, 0, Math.sin(angle) * rInner),
        new THREE.Vector3(Math.cos(angle) * rOuter, 0, Math.sin(angle) * rOuter),
      ]);
      notches.push(new THREE.Line(geo, baseMat.clone()));
    }

    return { spokeObjects: spokes, notchObjects: notches };
  }, []);

  const spokeRefs = useRef<THREE.Line[]>(spokeObjects);
  const notchRefs = useRef<THREE.Line[]>(notchObjects);

  useFrame(({ clock }) => {
    const t        = clock.getElapsedTime();
    const progress = progressRef.current;

    // ── Dynamic Ride Position & Pacing ───────────────────────────────────────
    if (groupRef.current) {
      const targetY = 12.2 - progress * 22.7;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.1);

      const targetScale = Math.max(0.5, 1.5 - progress * 0.95);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.1));

      // Directional Gyro Orientation facing active narrative card
      let targetRotY = t * 0.2;
      if (progress >= 0.82 && progress < 0.92) {
        targetRotY = Math.PI * 0.95; // EDGE (left)
      } else if (progress >= 0.68 && progress < 0.82) {
        targetRotY = 0.05; // Human Layer (right)
      } else if (progress >= 0.54 && progress < 0.68) {
        targetRotY = Math.PI * 0.95; // CMF Core (left)
      } else if (progress >= 0.40 && progress < 0.54) {
        targetRotY = 0.05; // NetJana (right)
      }
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.08);
      groupRef.current.rotation.x = Math.sin(t * 0.8) * 0.1;
      groupRef.current.rotation.z = Math.cos(t * 0.7) * 0.08;
    }

    // ── Active Chromatic Theme ───────────────────────────────────────────────
    let coreColor   = CYAN_CORE;
    let auraColor   = CYAN_BRIGHT;
    let coreGlow    = 0.75 + 0.25 * Math.sin(t * 3.5);
    let spokeColor  = SLATE_DARK;
    let spokeOp     = 0.25 + progress * 0.4;

    if (progress >= 0.92) {
      coreColor  = AMBER_GOLD;
      auraColor  = AMBER_GOLD;
      coreGlow   = 0.95 + 0.05 * Math.sin(t * 4);
      spokeColor = AMBER_GOLD;
      spokeOp    = 0.85;
    } else if (progress >= 0.82) {
      coreColor  = CRYSTAL_BLUE;
      auraColor  = CYAN_BRIGHT;
      spokeColor = CRYSTAL_BLUE;
    } else if (progress >= 0.68) {
      coreColor  = EMERALD_MINT;
      auraColor  = EMERALD_MINT;
      spokeColor = EMERALD_MINT;
    } else if (progress >= 0.54) {
      coreColor  = INDIGO_VIOLET;
      auraColor  = INDIGO_VIOLET;
      spokeColor = INDIGO_VIOLET;
    } else if (progress >= 0.40) {
      coreColor  = CYAN_BRIGHT;
      auraColor  = CYAN_CORE;
      spokeColor = CYAN_BRIGHT;
    }

    // ── Plasma Core Orb ──────────────────────────────────────────────────────
    if (plasmaCoreRef.current) {
      const mat = plasmaCoreRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(coreColor);
      mat.opacity = coreGlow;
      plasmaCoreRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
    }

    if (plasmaAuraRef.current) {
      const mat = plasmaAuraRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(auraColor);
      mat.opacity = 0.35 + 0.15 * Math.sin(t * 2.5);
      plasmaAuraRef.current.scale.setScalar(1.4 + Math.cos(t * 3) * 0.15);
    }

    // ── Concentric Gyroscopic Rings ──────────────────────────────────────────
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = t * 1.4;
      const mat = innerRingRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(coreColor);
      mat.opacity = 0.65 + 0.25 * Math.sin(t * 2.8);
    }

    if (midRingRef.current) {
      midRingRef.current.rotation.z = -t * 0.9;
      const mat = midRingRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(auraColor);
      mat.opacity = 0.55 + 0.25 * Math.sin(t * 2.2 + 1);
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = t * 0.5;
      const mat = outerRingRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(coreColor);
      mat.opacity = 0.45 + 0.2 * Math.sin(t * 1.8 + 2);
    }

    // ── Spherical Gimbal Cages ───────────────────────────────────────────────
    if (gimbalXRef.current) {
      gimbalXRef.current.rotation.x = t * 0.8;
      const mat = gimbalXRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(auraColor);
      mat.opacity = 0.25 + 0.1 * Math.sin(t * 2);
    }

    if (gimbalYRef.current) {
      gimbalYRef.current.rotation.y = -t * 0.7;
      const mat = gimbalYRef.current.material as THREE.MeshBasicMaterial;
      mat.color.setHex(coreColor);
      mat.opacity = 0.22 + 0.1 * Math.cos(t * 2);
    }

    // ── Spoke Conduits & Telemetry Notches ────────────────────────────────────
    spokeRefs.current.forEach((spoke, idx) => {
      const mat = spoke.material as THREE.LineBasicMaterial;
      mat.opacity = spokeOp;
      mat.color.setHex(spokeColor);
      spoke.rotation.y = t * 0.15;
    });

    notchRefs.current.forEach((notch) => {
      const mat = notch.material as THREE.LineBasicMaterial;
      mat.opacity = spokeOp * 0.8;
      mat.color.setHex(spokeColor);
      notch.rotation.y = -t * 0.1;
    });
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 1. Plasma Core Energy Orb */}
      <mesh ref={plasmaCoreRef}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color={CYAN_CORE} transparent opacity={0.8} />
      </mesh>

      {/* 2. Plasma Corona Aura */}
      <mesh ref={plasmaAuraRef}>
        <sphereGeometry args={[0.62, 18, 18]} />
        <meshBasicMaterial color={CYAN_BRIGHT} transparent opacity={0.3} wireframe={true} />
      </mesh>

      {/* 3. High-Velocity Inner Ring */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.6, 0.05, 10, 80]} />
        <meshBasicMaterial color={CYAN_BRIGHT} transparent opacity={0.5} />
      </mesh>

      {/* 4. Interlocking Mid Ring */}
      <mesh ref={midRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.6, 0.055, 10, 90]} />
        <meshBasicMaterial color={INDIGO_VIOLET} transparent opacity={0.4} />
      </mesh>

      {/* 5. Outer Beveled Stator Ring */}
      <mesh ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.6, 0.065, 10, 100]} />
        <meshBasicMaterial color={CYAN_CORE} transparent opacity={0.35} />
      </mesh>

      {/* 6. Vertical 3D Gimbal Cages */}
      <mesh ref={gimbalXRef}>
        <torusGeometry args={[2.2, 0.025, 8, 70]} />
        <meshBasicMaterial color={CYAN_BRIGHT} transparent opacity={0.2} />
      </mesh>

      <mesh ref={gimbalYRef} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[3.1, 0.025, 8, 70]} />
        <meshBasicMaterial color={INDIGO_VIOLET} transparent opacity={0.18} />
      </mesh>

      {/* 7. Laser Spokes & Telemetry Ticks */}
      {spokeObjects.map((obj, i) => (
        <primitive key={`spoke-${i}`} object={obj} />
      ))}
      {notchObjects.map((obj, i) => (
        <primitive key={`notch-${i}`} object={obj} />
      ))}
    </group>
  );
}
