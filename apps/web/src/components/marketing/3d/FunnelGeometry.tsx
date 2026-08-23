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

// Cybernetic Palette
const CYAN_BRIGHT = 0x38bdf8;
const CYAN_CORE = 0x06b6d4;
const INDIGO_VIOLET = 0x818cf8;
const EMERALD_MINT = 0x34d399;
const AMBER_GOLD = 0xfbbf24;
const SLATE_DARK = 0x334155;

export default function FunnelGeometry({ progressRef }: FunnelGeometryProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringMeshRefs = useRef<THREE.Mesh[]>([]);
  const innerRingMeshRefs = useRef<THREE.Mesh[]>([]);
  const photonPulseRefs = useRef<THREE.Mesh[]>([]);

  // ── 1. Top Opening Constellation (Input Signals) ───────────────────────────
  const openingLinks = useMemo(() => [
    { from: new THREE.Vector3(-8.2, 14.2, -2.0), to: new THREE.Vector3(-4.2, 12.8, -0.8), connectedAt: 0.02 },
    { from: new THREE.Vector3(7.4, 13.8, -2.4), to: new THREE.Vector3(3.6, 12.2, -0.7), connectedAt: 0.05 },
    { from: new THREE.Vector3(-6.0, 11.5, -2.8), to: new THREE.Vector3(-2.0, 11.4, -0.4), connectedAt: 0.09 },
    { from: new THREE.Vector3(6.2, 11.0, -3.0), to: new THREE.Vector3(1.8, 11.1, -0.4), connectedAt: 0.13 },
    { from: new THREE.Vector3(-3.0, 15.0, 1.5), to: new THREE.Vector3(0.0, 13.0, 0.0), connectedAt: 0.17 },
    { from: new THREE.Vector3(4.0, 14.5, 2.0), to: new THREE.Vector3(1.5, 12.6, 0.5), connectedAt: 0.20 },
  ], []);

  const openingLineObjects = useMemo(() => openingLinks.map((link) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([link.from, link.to]);
    const material = new THREE.LineBasicMaterial({ color: SLATE_DARK, transparent: true, opacity: 0.25 });
    return new THREE.Line(geometry, material);
  }), [openingLinks]);

  const openingNodeObjects = useMemo(() => {
    const points = openingLinks.flatMap((link) => [link.from, link.to]);
    return points.map((point, index) => {
      const geometry = new THREE.SphereGeometry(index % 2 === 0 ? 0.14 : 0.2, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? SLATE_DARK : CYAN_BRIGHT,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      return mesh;
    });
  }, [openingLinks]);

  // ── 2. Multi-tier Holographic Rings (Vortex Lattice) ───────────────────────
  const rings = useMemo(() => {
    const count = 28;
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const y = FUNNEL_TOP_Y - t * FUNNEL_HEIGHT;
      // Exponential inward funnel contour with slight organic flute
      const r = 5.8 - t * 4.4 + Math.sin(t * Math.PI) * 0.8;
      return { y, r, t };
    });
  }, []);

  // ── 3. Traveling Photon Pulses on Ring Nodes ───────────────────────────────
  const photonNodes = useMemo(() => {
    return [0, 4, 8, 12, 16, 20, 24].map((ringIdx) => ({
      ringIndex: ringIdx,
      speed: 1.2 + ringIdx * 0.1,
      radiusOffset: 0.05,
    }));
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const progress = progressRef.current;

    // Gentle global hover & gyroscopic tilt
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.04;
    }

    // Animate opening intake links
    openingLineObjects.forEach((line, index) => {
      const mat = line.material as THREE.LineBasicMaterial;
      const connected = progress >= openingLinks[index]!.connectedAt;
      mat.color.setHex(connected ? CYAN_BRIGHT : SLATE_DARK);
      mat.opacity = connected ? 0.65 + Math.sin(time * 2.5 + index) * 0.2 : 0.15;
    });

    openingNodeObjects.forEach((mesh, index) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const activated = progress > 0.05 || index % 2 === 1;
      mat.color.setHex(activated ? (index % 3 === 0 ? INDIGO_VIOLET : CYAN_BRIGHT) : SLATE_DARK);
      mat.opacity = activated ? 0.75 + Math.sin(time * 2.0 + index) * 0.2 : 0.25;
      mesh.scale.setScalar(activated ? 1.0 + Math.sin(time * 2.5 + index) * 0.18 : 0.75);
    });

    // Animate concentric glowing rings
    ringMeshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const ring = rings[i];
      if (!ring) return;

      const isPassed = ring.t <= progress;
      const wave = Math.sin(time * 2.2 - i * 0.35);
      const brightness = isPassed ? 0.7 + 0.3 * wave : 0.18;

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = brightness;

      // Vortex twist
      mesh.rotation.z = time * 0.12 * (isPassed ? 1.8 : 0.5) + i * 0.15;

      // Progressive Stage Color Grade
      if (ring.t > 0.85) {
        mat.color.setHex(AMBER_GOLD);
        mat.opacity = Math.min(1, brightness * 1.5);
      } else if (ring.t > 0.65) {
        mat.color.setHex(EMERALD_MINT);
      } else if (ring.t > 0.40) {
        mat.color.setHex(INDIGO_VIOLET);
      } else {
        mat.color.setHex(CYAN_BRIGHT);
      }
    });

    // Animate inner companion ring
    innerRingMeshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const ring = rings[i];
      if (!ring) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const isPassed = ring.t <= progress;
      mat.opacity = isPassed ? 0.35 + 0.15 * Math.sin(time * 3.0 + i) : 0.08;
      mesh.rotation.z = -time * 0.08 - i * 0.1;
    });

    // Animate photon orbit nodes
    photonPulseRefs.current.forEach((mesh, pIdx) => {
      if (!mesh) return;
      const cfg = photonNodes[pIdx]!;
      const ring = rings[cfg.ringIndex]!;
      const angle = time * cfg.speed + pIdx * (Math.PI / 3);
      mesh.position.set(
        Math.cos(angle) * (ring.r + 0.1),
        ring.y,
        Math.sin(angle) * (ring.r + 0.1)
      );
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const active = ring.t <= progress + 0.15;
      mat.opacity = active ? 0.9 + Math.sin(time * 4) * 0.1 : 0.2;
    });
  });

  return (
    <group ref={groupRef}>
      {/* 1. Inbound Signal Constellation */}
      {openingLineObjects.map((line, index) => <primitive key={`opening-line-${index}`} object={line} />)}
      {openingNodeObjects.map((node, index) => <primitive key={`opening-node-${index}`} object={node} />)}

      {/* 2. Concentric Holographic Rings (Dual Layer) */}
      {rings.map((ring, i) => (
        <group key={`ring-group-${i}`} position={[0, ring.y, 0]}>
          {/* Primary luminous torus */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            ref={(el) => { if (el) ringMeshRefs.current[i] = el; }}
          >
            <torusGeometry args={[ring.r, 0.045 + ring.t * 0.02, 10, 80]} />
            <meshBasicMaterial color={CYAN_BRIGHT} transparent opacity={0.25} side={THREE.DoubleSide} />
          </mesh>

          {/* Inner holographic accent ring */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            ref={(el) => { if (el) innerRingMeshRefs.current[i] = el; }}
          >
            <torusGeometry args={[ring.r * 0.96, 0.015, 6, 60]} />
            <meshBasicMaterial color={CYAN_CORE} transparent opacity={0.12} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* 3. Orbiting Photon Beacons on Rings */}
      {photonNodes.map((_, pIdx) => (
        <mesh
          key={`photon-${pIdx}`}
          ref={(el) => { if (el) photonPulseRefs.current[pIdx] = el; }}
        >
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0.8} />
        </mesh>
      ))}

      {/* 4. Fibonacci Spiral Energy Conduits (6 interweaving rails) */}
      {[0, 1, 2, 3, 4, 5].map((j) => (
        <SpiralRail
          key={`spiral-rail-${j}`}
          offsetAngle={(j / 6) * Math.PI * 2}
          progressRef={progressRef}
          colorHex={j % 2 === 0 ? CYAN_BRIGHT : INDIGO_VIOLET}
        />
      ))}

      {/* 5. Translucent Volumetric Funnel Shroud with Holographic Wire Grid */}
      <mesh position={[0, FUNNEL_CENTER_Y, 0]}>
        <cylinderGeometry args={[1.4, 5.8, FUNNEL_HEIGHT, 48, 12, true]} />
        <meshBasicMaterial
          color={0x0284c7}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          wireframe={true}
        />
      </mesh>
    </group>
  );
}

function SpiralRail({
  offsetAngle,
  progressRef,
  colorHex,
}: {
  offsetAngle: number;
  progressRef: React.MutableRefObject<number>;
  colorHex: number;
}) {
  const meshRef = useRef<THREE.Line>(null);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const steps = 260;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = offsetAngle + t * Math.PI * 8.6;
      const y = FUNNEL_TOP_Y - t * FUNNEL_HEIGHT;
      const r = 5.8 - t * 4.4 + Math.sin(t * Math.PI) * 0.8;
      pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
    }
    return pts;
  }, [offsetAngle]);

  const lineObject = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.55,
    });
    return new THREE.Line(geo, mat);
  }, [points, colorHex]);

  useFrame(() => {
    const progress = progressRef.current;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.45 + progress * 0.45;
    }
  });

  return <primitive object={lineObject} ref={meshRef} />;
}
