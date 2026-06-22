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
  const boxRef   = useRef<THREE.Mesh>(null);

  // ── Geometry created ONCE via useMemo ─────────────────────────────────────
  const boxGeo = useMemo(() => new THREE.BoxGeometry(3.2, 2.0, 1.2), []);

  const edgesObject = useMemo(() => {
    const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.2, 2.0, 1.2));
    const mat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
    });
    return new THREE.LineSegments(edgesGeo, mat);
  }, []);

  // Inner glow — slightly smaller box for depth
  const innerGlowObj = useMemo(() => {
    const geo = new THREE.BoxGeometry(2.8, 1.6, 0.8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
    });
    return new THREE.Mesh(geo, mat);
  }, []);

  useFrame(({ clock }) => {
    const t        = clock.getElapsedTime();
    const progress = progressRef.current;

    // Fade in between progress 0.85 and 0.95
    const opacity = Math.max(0, Math.min(1, (progress - 0.85) / 0.10));

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.12;
    }

    if (boxRef.current) {
      const mat = boxRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity * 0.14;
    }

    const edgeMat = edgesObject.material as THREE.LineBasicMaterial;
    edgeMat.opacity = opacity * 0.90 + 0.10 * Math.sin(t * 2.4) * opacity;

    const innerMat = innerGlowObj.material as THREE.MeshBasicMaterial;
    innerMat.opacity = opacity * 0.08;
  });

  return (
    <group ref={groupRef} position={[0, -10.5, 0]}>
      {/* Main box shell */}
      <mesh ref={boxRef} geometry={boxGeo}>
        <meshBasicMaterial color={0xfbbf24} transparent opacity={0} />
      </mesh>

      {/* Glowing edges — created via useMemo */}
      <primitive object={edgesObject} />

      {/* Inner glow shell */}
      <primitive object={innerGlowObj} />

      {/* Metric labels via R3F Html portal */}
      <Html center position={[0, 0, 0.65]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            textAlign: "center",
            fontFamily: "'Courier New', monospace",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          <p style={{ color: "#fbbf24", fontSize: "10px", margin: "0 0 2px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold" }}>
            Measurable Results & ROI
          </p>
          <p style={{ color: "#ffffff", fontSize: "12px", fontWeight: 600, margin: "0 0 4px", letterSpacing: "0.06em" }}>
            47 Qualified Leads
          </p>
          <p style={{ color: "#fbbf24", fontSize: "15px", fontWeight: 700, margin: "0 0 4px" }}>
            12 Meetings Booked
          </p>
          <p style={{ color: "#34d399", fontSize: "19px", fontWeight: 900, margin: 0 }}>
            3.4× ROI
          </p>
        </div>
      </Html>
    </group>
  );
}
