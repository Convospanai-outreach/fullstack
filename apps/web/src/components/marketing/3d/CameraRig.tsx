"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraRigProps {
  progressRef: React.MutableRefObject<number>;
  reduceMotion?: boolean;
}

// Camera path — orbit gently down and inward as progress increases
const CAM_POSITIONS: [number, number, number][] = [
  [0,  14, 24],   // 0.0 — wide overview
  [4,  10, 22],   // 0.2
  [-3,  6, 20],   // 0.4
  [5,   2, 18],   // 0.6
  [-4, -3, 16],   // 0.8
  [0,  -7, 14],   // 1.0 — close to revenue throat
];

const CAM_TARGETS: [number, number, number][] = [
  [0,  6,  0],
  [0,  4,  0],
  [0,  2,  0],
  [0,  0,  0],
  [0, -2,  0],
  [0, -5,  0],
];

function lerpCameraPath(
  points: [number, number, number][],
  t: number,
): THREE.Vector3 {
  const clamped = Math.max(0, Math.min(1, t));
  const segmentCount = points.length - 1;
  const seg = Math.min(Math.floor(clamped * segmentCount), segmentCount - 1);
  const local = clamped * segmentCount - seg;
  const a = points[seg]!;
  const b = points[seg + 1]!;
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * local,
    a[1] + (b[1] - a[1]) * local,
    a[2] + (b[2] - a[2]) * local,
  );
}

export default function CameraRig({ progressRef, reduceMotion = false }: CameraRigProps) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 14, 24));
  const targetLook = useRef(new THREE.Vector3(0, 6, 0));

  useFrame(() => {
    if (reduceMotion) return;

    const p = progressRef.current;
    const desiredPos  = lerpCameraPath(CAM_POSITIONS, p);
    const desiredLook = lerpCameraPath(CAM_TARGETS, p);

    targetPos.current.lerp(desiredPos, 0.042);
    targetLook.current.lerp(desiredLook, 0.042);

    camera.position.copy(targetPos.current);
    camera.lookAt(targetLook.current);
  });

  return null;
}
