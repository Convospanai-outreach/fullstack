"use client";

import { Canvas } from "@react-three/fiber";
import { Sparkles, Float } from "@react-three/drei";

export default function HeroScene() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none fade-in-scale">
            <Canvas camera={{ position: [0, 0, 1] }} gl={{ alpha: true }} dpr={[1, 2]}>
                <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                    {/* Emerald Particles */}
                    <Sparkles
                        count={150}
                        scale={3}
                        size={2}
                        speed={0.4}
                        opacity={0.7}
                        color="#34d399"
                    />
                    {/* Cyan Particles */}
                    <Sparkles
                        count={100}
                        scale={4}
                        size={3}
                        speed={0.3}
                        opacity={0.5}
                        color="#22d3ee"
                    />
                    {/* Warm Dust */}
                    <Sparkles
                        count={100}
                        scale={5}
                        size={1}
                        speed={0.2}
                        opacity={0.3}
                        color="#fde68a"
                    />
                </Float>
            </Canvas>
        </div>
    );
}
