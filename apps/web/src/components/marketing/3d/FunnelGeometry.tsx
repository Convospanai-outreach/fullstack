"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FunnelGeometryProps {
  progressRef: React.MutableRefObject<number>;
}

const FUNNEL_TOP_Y = 12.5;
const FUNNEL_BOTTOM_Y = -10.5;
const FUNNEL_HEIGHT = FUNNEL_TOP_Y - FUNNEL_BOTTOM_Y;
const FUNNEL_CENTER_Y = (FUNNEL_TOP_Y + FUNNEL_BOTTOM_Y) / 2;

export default function FunnelGeometry({ progressRef }: FunnelGeometryProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);

  const rings = useMemo(() => {
    const count = 22;
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const y = FUNNEL_TOP_Y - t * FUNNEL_HEIGHT;
      const r = 5.6 - t * 4.15 + Math.sin(t * Math.PI) * 0.7;
      return { y, r, t };
    });
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const progress = progressRef.current;

    ringRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const ring = rings[i];
      if (!ring) return;
      const isActive = ring.t <= progress;
      const brightness = isActive ? 0.6 + 0.35 * Math.sin(time * 1.8 + i * 0.4) : 0.16;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = brightness;
      // Slight vortex twist
      mesh.rotation.z = time * 0.08 * (isActive ? 1.6 : 0.4) + i * 0.12;
      // Revenue brightening
      if (ring.t > 0.78 && progress > 0.78) {
        mat.color.setHex(0xfbbf24);
        mat.opacity = Math.min(1, brightness * 1.6);
      } else if (ring.t < 0.5) {
        mat.color.setHex(0x22d3ee);
      } else {
        mat.color.setHex(0x8b5cf6);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Funnel torus rings */}
      {rings.map((ring, i) => (
        <mesh
          key={i}
          position={[0, ring.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          ref={(el) => { if (el) ringRefs.current[i] = el; }}
        >
          <torusGeometry args={[ring.r, 0.05 + ring.t * 0.025, 8, 72]} />
          <meshBasicMaterial
            color={0x22d3ee}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Spiral guide rails */}
      {[0, 1, 2].map((j) => (
        <SpiralRail key={j} offsetAngle={(j / 3) * Math.PI * 2} progressRef={progressRef} />
      ))}

      {/* Funnel shell — wide-mouth transparent cone */}
      <mesh position={[0, FUNNEL_CENTER_Y, 0]}>
        <coneGeometry args={[5.6, FUNNEL_HEIGHT, 64, 1, true]} />
        <meshBasicMaterial
          color={0x22d3ee}
          transparent
          opacity={0.035}
          side={THREE.DoubleSide}
          wireframe={false}
        />
      </mesh>
    </group>
  );
}

function SpiralRail({
  offsetAngle,
  progressRef,
}: {
  offsetAngle: number;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Line>(null);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = offsetAngle + t * Math.PI * 7.4;
      const y = FUNNEL_TOP_Y - t * FUNNEL_HEIGHT;
      const r = 5.6 - t * 4.15 + Math.sin(t * Math.PI) * 0.7;
      pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    return pts;
  }, [offsetAngle]);

  // Create the Three.js line object ONCE — not inline in JSX.
  // Inline `new THREE.Line(...)` inside JSX re-creates a new object every render
  // which breaks React Three Fiber's scene graph tracking in production.
  const lineObject = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.48,
    });
    return new THREE.Line(geo, mat);
  }, [points]);

  useFrame(() => {
    const progress = progressRef.current;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.LineBasicMaterial;
      // Base opacity starts stronger so the spiral supports the opening story.
      mat.opacity = 0.48 + progress * 0.34;
    }
  });

  return <primitive object={lineObject} ref={meshRef} />;
}
