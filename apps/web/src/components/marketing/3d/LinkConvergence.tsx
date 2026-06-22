"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface LinkConvergenceProps {
  progressRef: React.MutableRefObject<number>;
}

const CYAN = 0x22d3ee;
const VIOLET = 0x8b5cf6;
const SLATE = 0x64748b;

type LinkNode = {
  from: THREE.Vector3;
  to: THREE.Vector3;
  connectedAt: number;
};

export default function LinkConvergence({ progressRef }: LinkConvergenceProps) {
  const groupRef = useRef<THREE.Group>(null);

  const links = useMemo<LinkNode[]>(() => [
    { from: new THREE.Vector3(-7.6, 13.8, -1.8), to: new THREE.Vector3(-3.8, 12.8, -0.8), connectedAt: 0.04 },
    { from: new THREE.Vector3(6.8, 13.2, -2.2), to: new THREE.Vector3(3.2, 12.2, -0.7), connectedAt: 0.08 },
    { from: new THREE.Vector3(-5.4, 11.1, -2.5), to: new THREE.Vector3(-1.8, 11.4, -0.4), connectedAt: 0.12 },
    { from: new THREE.Vector3(5.6, 10.7, -2.8), to: new THREE.Vector3(1.6, 11.1, -0.4), connectedAt: 0.16 },
  ], []);

  const lineObjects = useMemo(() => links.map((link) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([link.from, link.to]);
    const material = new THREE.LineBasicMaterial({ color: SLATE, transparent: true, opacity: 0.16 });
    return new THREE.Line(geometry, material);
  }), [links]);

  const nodeObjects = useMemo(() => {
    const points = links.flatMap((link) => [link.from, link.to]);
    return points.map((point, index) => {
      const geometry = new THREE.SphereGeometry(index % 2 === 0 ? 0.12 : 0.16, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? SLATE : CYAN, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      return mesh;
    });
  }, [links]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const progress = progressRef.current;

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.18) * 0.08;
      groupRef.current.position.y = Math.sin(elapsed * 0.35) * 0.18;
    }

    lineObjects.forEach((line, index) => {
      const material = line.material as THREE.LineBasicMaterial;
      const connected = progress >= links[index]!.connectedAt;
      material.color.setHex(connected ? CYAN : SLATE);
      material.opacity = connected ? 0.56 + Math.sin(elapsed * 2.1 + index) * 0.12 : 0.12;
    });

    nodeObjects.forEach((mesh, index) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      const activated = progress > 0.06 || index % 2 === 1;
      material.color.setHex(activated ? (index % 3 === 0 ? VIOLET : CYAN) : SLATE);
      material.opacity = activated ? 0.55 + Math.sin(elapsed * 1.8 + index) * 0.12 : 0.26;
      const scale = activated ? 1.0 + Math.sin(elapsed * 2 + index) * 0.12 : 0.8;
      mesh.scale.setScalar(scale);
    });
  });

  return (
    <group ref={groupRef}>
      {lineObjects.map((line, index) => <primitive key={`line-${index}`} object={line} />)}
      {nodeObjects.map((node, index) => <primitive key={`node-${index}`} object={node} />)}
    </group>
  );
}
