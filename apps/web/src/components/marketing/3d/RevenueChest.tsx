"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface RevenueChestProps {
  progressRef: React.MutableRefObject<number>;
}

export default function RevenueChest({ progressRef }: RevenueChestProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreVaultRef = useRef<THREE.Mesh>(null);
  const floorGridRef = useRef<THREE.Mesh>(null);
  const shardGroupRef = useRef<THREE.Group>(null);

  // ── 1. Geometric Vault Structure ───────────────────────────────────────────
  const boxGeo = useMemo(() => new THREE.BoxGeometry(3.4, 2.2, 1.4), []);

  const edgesObject = useMemo(() => {
    const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 2.2, 1.4));
    const mat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      linewidth: 2,
    });
    return new THREE.LineSegments(edgesGeo, mat);
  }, []);

  // Inner Core Prism
  const innerCoreObj = useMemo(() => {
    const geo = new THREE.OctahedronGeometry(0.8, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      wireframe: true,
    });
    return new THREE.Mesh(geo, mat);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const progress = progressRef.current;

    // Smooth entry between progress 0.85 and 0.95
    const opacity = Math.max(0, Math.min(1, (progress - 0.84) / 0.11));

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.15;
      groupRef.current.position.y = -10.5 + Math.sin(t * 1.5) * 0.1;
      groupRef.current.scale.setScalar(0.7 + opacity * 0.3);
    }

    if (coreVaultRef.current) {
      const mat = coreVaultRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity * 0.18;
    }

    const edgeMat = edgesObject.material as THREE.LineBasicMaterial;
    edgeMat.opacity = opacity * (0.85 + 0.15 * Math.sin(t * 3.0));

    const innerMat = innerCoreObj.material as THREE.MeshBasicMaterial;
    innerMat.opacity = opacity * 0.7;
    innerCoreObj.rotation.x = t * 0.8;
    innerCoreObj.rotation.y = t * 1.2;

    if (floorGridRef.current) {
      const mat = floorGridRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity * 0.45;
      floorGridRef.current.rotation.z = -t * 0.1;
    }

    if (shardGroupRef.current) {
      shardGroupRef.current.rotation.y = -t * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={[0, -10.5, 0]}>
      {/* 1. Main Quantum Vault Body */}
      <mesh ref={coreVaultRef} geometry={boxGeo}>
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0} />
      </mesh>

      {/* 2. Glowing Laser Bevel Edges */}
      <primitive object={edgesObject} />

      {/* 3. Floating Inner Kinetic Core */}
      <primitive object={innerCoreObj} />

      {/* 4. Floor Projection Laser Disc */}
      <mesh ref={floorGridRef} position={[0, -1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 3.2, 32]} />
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* 5. Floating Orbital Shards */}
      <group ref={shardGroupRef}>
        {[0, 1, 2, 3].map((idx) => {
          const angle = (idx / 4) * Math.PI * 2;
          return (
            <mesh
              key={`shard-${idx}`}
              position={[Math.cos(angle) * 2.2, Math.sin(idx) * 0.4, Math.sin(angle) * 2.2]}
            >
              <octahedronGeometry args={[0.15, 0]} />
              <meshBasicMaterial color={0xfbbf24} transparent opacity={0.8} />
            </mesh>
          );
        })}
      </group>

      {/* 6. Ultra-Crisp Metric Telemetry Card */}
      <Html center position={[0, 0, 0.75]} style={{ pointerEvents: "none" }}>
        <div className="rounded-2xl border border-amber-400/50 bg-slate-950/85 p-3.5 shadow-[0_0_30px_rgba(251,191,36,0.3)] backdrop-blur-xl text-center whitespace-nowrap min-w-[200px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-amber-300 font-bold">
            Output Node {"//"} Active Pipeline
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-3">
            <div>
              <p className="font-sans text-lg font-black text-white">47</p>
              <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400">Qualified Leads</p>
            </div>
            <div className="h-6 w-px bg-white/15" />
            <div>
              <p className="font-sans text-lg font-black text-amber-300">12</p>
              <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400">Meetings Booked</p>
            </div>
            <div className="h-6 w-px bg-white/15" />
            <div>
              <p className="font-sans text-lg font-black text-emerald-400">3.4×</p>
              <p className="font-mono text-[8px] uppercase tracking-wider text-slate-400">Pipeline Velocity</p>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
