/* eslint-disable react-hooks/set-state-in-effect */
"use client";

/**
 * Isolated 3D core for the "Drogas apreendidas" podium.
 *
 * Lives in its own file so the rest of the dashboard never imports
 * the Three.js bundle. The component assumes:
 *   - It is rendered inside an Error Boundary (errors fall back to CSS)
 *   - WebGL has been pre-checked by the caller
 *   - Bloom + particle knobs are pre-resolved from
 *     `drug-hud-3d-config.ts` (no runtime env lookup happens here)
 *
 * The scene reuses the existing podium artwork from the previous
 * monolithic implementation, plus a Bloom pass for the neon glow that
 * makes the "uau" effect land on stage.
 */

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

import {
  drugHudBloomIntensity,
  drugHudCameraDistance,
  drugHudParticleCount,
} from "./drug-hud-3d-config";

export interface HudCoreSegment {
  label: string;
  percent: number;
  tone: string;
}

export interface HudCoreProps {
  segments: HudCoreSegment[];
  totalLabel: string;
  unit: string;
  categoryCount: number;
  loading?: boolean;
  totalCaption?: string;
  size?: number;
  categoriesCaption?: string;
  coreRef?: (node: HTMLElement | null) => void;
}

function InteractiveCamera({ distance }: { distance: number }) {
  useFrame((state) => {
    const px = state.pointer.x;
    const py = state.pointer.y;
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      px * 0.4,
      0.05,
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      py * 0.3 + 0.1,
      0.05,
    );
    state.camera.position.z = THREE.MathUtils.lerp(
      state.camera.position.z,
      distance,
      0.05,
    );
    state.camera.lookAt(0, 0.1, 0);
  });
  return null;
}

function HolographicPlatform() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.1;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.15;
  });

  return (
    <group position={[0, -1.2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.3, 0.08, 32]} />
        <meshStandardMaterial
          color="#030c17"
          metalness={0.8}
          opacity={0.8}
          roughness={0.6}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.7, 1.8, 0.06, 32]} />
        <meshStandardMaterial
          color="#051b30"
          metalness={0.9}
          opacity={0.9}
          roughness={0.4}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.25, 0.04, 32]} />
        <meshStandardMaterial
          color="#082d4d"
          metalness={0.95}
          opacity={0.95}
          roughness={0.2}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.13, 64]} />
        <meshBasicMaterial color="#00ffff" opacity={0.6} side={THREE.DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.63, 64]} />
        <meshBasicMaterial color="#8A2BE2" opacity={0.5} side={THREE.DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.12, 64]} />
        <meshBasicMaterial color="#00ffff" opacity={0.8} side={THREE.DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.41, 64]} />
        <meshBasicMaterial color="#00ffff" opacity={0.2} transparent />
      </mesh>
    </group>
  );
}

function VerticalLightBeam() {
  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.7, 1.3, 2.4, 32, 1, true]} />
        <meshBasicMaterial
          color="#00ffff"
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.15}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.3, 0.9, 2.4, 32, 1, true]} />
        <meshBasicMaterial
          color="#00ffff"
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.08}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function HologramRings() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 0.25;
      ring1Ref.current.rotation.y = t * 0.15;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = t * 0.2;
      ring2Ref.current.rotation.z = t * 0.35;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = t * 0.15;
      ring3Ref.current.rotation.x = t * 0.25;
    }
  });

  return (
    <group position={[0, 0.1, 0]}>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.8, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#00FFFF"
          emissive="#00FFFF"
          emissiveIntensity={2.5}
          opacity={0.4}
          transparent
          wireframe
        />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1.35, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#8A2BE2"
          emissive="#8A2BE2"
          emissiveIntensity={2.5}
          opacity={0.4}
          transparent
          wireframe
        />
      </mesh>
      <mesh ref={ring3Ref}>
        <torusGeometry args={[0.9, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#00FFFF"
          emissive="#8A2BE2"
          emissiveIntensity={2.0}
          opacity={0.4}
          transparent
          wireframe
        />
      </mesh>
    </group>
  );
}

export interface DashboardHudCore3DProps extends HudCoreProps {
  /** Master intensity (0..1.5) forwarded from the config. */
  intensity?: number;
}

export function DashboardHudCore3D({
  _segments,
  totalLabel,
  unit,
  categoryCount,
  loading = false,
  totalCaption = "TOTAL APREENDIDO",
  size = 288,
  categoriesCaption,
  coreRef,
  intensity,
}: DashboardHudCore3DProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const caption = categoriesCaption ?? `${categoryCount} categorias`;
  const bloom = drugHudBloomIntensity(intensity);
  const particles = drugHudParticleCount(intensity);
  const distance = drugHudCameraDistance(intensity);

  // Ssr/initial paint: show the same fallback so the layout doesn't jump
  if (!mounted) {
    return (
      <div
        ref={coreRef}
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="p-4 rounded-full bg-slate-900/60 backdrop-blur-md flex flex-col items-center shadow-[0_0_15px_rgba(0,255,255,0.2)] pointer-events-none text-center select-none whitespace-nowrap">
          <span className="text-[9px] font-bold uppercase tracking-widest text-cyan-200/70">
            {totalCaption}
          </span>
          <span className="mt-2 font-mono text-[40px] font-extrabold leading-none text-white">
            --
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={coreRef}
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      <Canvas
        camera={{ position: [0, 0, distance], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={1.5} />
        <pointLight intensity={1.5} position={[10, 10, 10]} />

        <InteractiveCamera distance={distance} />
        <HolographicPlatform />
        <VerticalLightBeam />
        <HologramRings />

        <Sparkles count={Math.round(particles * 0.6)} scale={2.5} size={2} speed={0.6} color="#00FFFF" />
        <Sparkles count={Math.round(particles * 0.4)} scale={2.0} size={1.5} speed={0.4} color="#8A2BE2" />

        <EffectComposer>
          <Bloom
            intensity={bloom}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.6}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* Central Glass Card Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div
          className="relative w-[170px] h-[122px]"
          style={{
            filter: "drop-shadow(0 0 18px rgba(34,211,238,0.3))",
          }}
        >
          {/* Bevel Border */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: "rgba(34,211,238,0.45)",
              clipPath: "polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px))",
            }}
          />
          {/* Bevel Content */}
          <div
            className="absolute inset-[1px] bg-[#021020]/90 flex flex-col items-center justify-center p-4 text-center"
            style={{
              clipPath: "polygon(0 11px, 11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px))",
            }}
          >
            <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-cyan-200/70 font-sans">
              {totalCaption}
            </span>
            <span
              className="mt-1.5 font-mono text-[30px] font-extrabold leading-none text-white"
              style={{
                textShadow: "0 0 12px rgba(34,211,238,0.6)",
              }}
            >
              {loading ? "--" : totalLabel}
            </span>
            {unit && !loading && (
              <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-200/60 font-sans font-mono">
                {unit}
              </span>
            )}
            <span className="mt-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300 font-sans">
              {caption}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
