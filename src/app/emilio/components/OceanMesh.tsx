'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OCEAN_VERT, OCEAN_FRAG } from '../shaders/ocean';

interface OceanMeshProps {
  width?: number;
  height?: number;
}

export default function OceanMesh({ width = 20, height = 20 }: OceanMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const secondMeshRef = useRef<THREE.Mesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const secondShaderRef = useRef<THREE.ShaderMaterial>(null);

  const uniformsRef = useRef({
    uTime: { value: 0 },
    uWaveHeight: { value: 0.15 },
    uWaveFreq: { value: 2.5 },
    uSunPos: { value: new THREE.Vector2(0.3, 0.8) }
  });

  const secondUniformsRef = useRef({
    uTime: { value: 0 },
    uWaveHeight: { value: 0.12 },
    uWaveFreq: { value: 2.2 },
    uSunPos: { value: new THREE.Vector2(0.3, 0.8) }
  });

  useFrame((state, delta) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value += delta;
    }
    if (secondShaderRef.current) {
      secondShaderRef.current.uniforms.uTime.value += delta * 0.8;
    }
  });

  useEffect(() => {
    return () => {
      shaderRef.current?.dispose();
      secondShaderRef.current?.dispose();
    };
  }, []);

  return (
    <>
      {/* Primary ocean layer */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.5, 0]}
      >
        <planeGeometry args={[width, height, 128, 64]} />
        <shaderMaterial
          ref={shaderRef}
          vertexShader={OCEAN_VERT}
          fragmentShader={OCEAN_FRAG}
          uniforms={uniformsRef.current}
          transparent
        />
      </mesh>

      {/* Second layer for depth */}
      <mesh
        ref={secondMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0.3, -0.5, -0.5]}
      >
        <planeGeometry args={[width, height, 128, 64]} />
        <shaderMaterial
          ref={secondShaderRef}
          vertexShader={OCEAN_VERT}
          fragmentShader={OCEAN_FRAG}
          uniforms={secondUniformsRef.current}
          transparent
          opacity={0.6}
        />
      </mesh>
    </>
  );
}
