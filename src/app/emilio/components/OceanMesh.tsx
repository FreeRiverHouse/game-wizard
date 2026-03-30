'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OCEAN_VERT, OCEAN_FRAG } from '../shaders/ocean';

interface OceanMeshProps {
  width?: number;
  height?: number;
  segments?: number;
}

export default function OceanMesh({
  width = 14,
  height = 10,
  segments = 64
}: OceanMeshProps){
  const meshRef = useRef<THREE.Mesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = {
    uTime: { value: 0 },
    uWaveHeight: { value: 0.15 },
    uWaveFreq: { value: 2.5 },
    uShallowColor: { value: new THREE.Color('#1a6b8a') },
    uDeepColor: { value: new THREE.Color('#072940') },
    uFoamColor: { value: new THREE.Color('#a8e0f0') }
  };

  useFrame((state, delta) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
    >
      <planeGeometry args={[width, height, segments, segments]} />
      <shaderMaterial
        ref={shaderRef}
        vertexShader={OCEAN_VERT}
        fragmentShader={OCEAN_FRAG}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}
