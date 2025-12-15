"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import { useMemo } from "react";

export interface ThreeAnalyticsProps {
    data: Array<{ date: string; sent: number; opened: number }>;
}

function Bar({ position, height, color, label }: any) {
    return (
        <group position={position}>
            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                <mesh position={[0, height / 2, 0]}>
                    <boxGeometry args={[0.5, height, 0.5]} />
                    <meshStandardMaterial color={color} opacity={0.9} transparent />
                </mesh>
                <Text
                    position={[0, height + 0.5, 0]}
                    fontSize={0.3}
                    color="black"
                    anchorX="center"
                    anchorY="middle"
                >
                    {label}
                </Text>
            </Float>
        </group>
    );
}

export default function ThreeAnalytics({ data }: ThreeAnalyticsProps) {
    // Normalize data for visualization height
    const maxVal = Math.max(...data.map(d => Math.max(d.sent, d.opened, 1)));
    const scale = 5 / maxVal;

    return (
        <div className="h-[400px] w-full bg-gray-50 rounded-lg cursor-grab active:cursor-grabbing">
            <Canvas camera={{ position: [5, 5, 10], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />

                <group position={[-data.length / 2, -2, 0]}>
                    {data.map((item, index) => (
                        <group key={index} position={[index * 1.5, 0, 0]}>
                            {/* Sent Bar */}
                            <Bar
                                position={[0, 0, 0.5]}
                                height={item.sent * scale}
                                color="#8884d8"
                                label={item.sent}
                            />
                            {/* Opened Bar */}
                            <Bar
                                position={[0.6, 0, -0.5]}
                                height={item.opened * scale}
                                color="#82ca9d"
                                label={item.opened}
                            />

                            {/* Date Label (Floor) */}
                            <Text
                                position={[0.3, -0.5, 0]}
                                rotation={[-Math.PI / 2, 0, 0]}
                                fontSize={0.25}
                                color="#666"
                            >
                                {item.date}
                            </Text>
                        </group>
                    ))}
                </group>

                <gridHelper args={[20, 20]} position={[0, -2, 0]} />
            </Canvas>
        </div>
    );
}
