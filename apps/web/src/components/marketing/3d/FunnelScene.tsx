"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import CameraRig from "./CameraRig";
import FunnelGeometry from "./FunnelGeometry";
import ParticleFlow from "./ParticleFlow";
import PillarNode from "./PillarNode";
import FlywheelCore from "./FlywheelCore";
import RevenueChest from "./RevenueChest";
import { PILLARS } from "./sceneConfig";

interface FunnelSceneProps {
  progressRef: React.MutableRefObject<number>;
  reduceMotion?: boolean;
  /** When false the canvas is hidden (not unmounted) so WebGL context is preserved */
  visible?: boolean;
}

export default function FunnelScene({
  progressRef,
  reduceMotion = false,
  visible = true,
}: FunnelSceneProps) {
  return (
    <Canvas
      className="!fixed !inset-0 !z-0"
      style={{ visibility: visible ? "visible" : "hidden", pointerEvents: "none" }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ fov: 52, near: 0.1, far: 200, position: [0, 14, 24] }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.FogExp2(0x040a14, 0.026);
        scene.background = new THREE.Color(0x020617);
      }}
    >
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 12, 0]} intensity={0.8} color={0x22d3ee} />
      <pointLight position={[0, -10, 0]} intensity={1.2} color={0xfbbf24} distance={18} />

      <CameraRig progressRef={progressRef} reduceMotion={reduceMotion} />
      <FunnelGeometry progressRef={progressRef} />
      {/* Flywheel sits at the funnel centre (y=0) */}
      <FlywheelCore progressRef={progressRef} />
      <ParticleFlow progressRef={progressRef} reduceMotion={reduceMotion} />
      {/* Revenue chest materialises at the spiral throat (y=-10.5) */}
      <RevenueChest progressRef={progressRef} />
      {PILLARS.map((pillar) => (
        <PillarNode key={pillar.id} pillar={pillar} progressRef={progressRef} />
      ))}
    </Canvas>
  );
}
