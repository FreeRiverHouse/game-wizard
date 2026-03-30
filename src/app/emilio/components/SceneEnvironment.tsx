'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function SceneEnvironment(){
  const cloudGroupRef = useRef<THREE.Group>(null);
  const initialX = useRef([-4, 0, 4]).current;

  useFrame((state) => {
    if (cloudGroupRef.current) {
      cloudGroupRef.current.children.forEach((c, i) => {
        c.position.x = initialX[i] + Math.sin(state.clock.elapsedTime * 0.05 + i) * 1.5;
      });
    }
  });

  const skyVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const skyFragmentShader = `
    varying vec2 vUv;
    void main() {
      vec3 topColor = vec3(0.176, 0.031, 0.271);
      vec3 midColor = vec3(0.780, 0.294, 0.102);
      vec3 bottomColor = vec3(1.0, 0.898, 0.4);
      vec3 color;
      float y = vUv.y;
      if (y > 0.5) {
        color = mix(midColor, topColor, (y - 0.5) * 2.0);
      } else {
        color = mix(bottomColor, midColor, y * 2.0);
      }
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <>
      {/* Sky gradient */}
      <mesh position={[0, 1.5, -5]}>
        <planeGeometry args={[20, 12]} />
        <shaderMaterial
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
        />
      </mesh>

      {/* Sun */}
      <mesh position={[-2.5, 3.2, -4.5]}>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="#FFE566" />
      </mesh>
      <pointLight position={[-2.5, 3.2, -4.5]} color="#FF8C00" intensity={3} distance={20} />

      {/* Clouds */}
      <group ref={cloudGroupRef}>
        <mesh position={[-4, 4.5, -3.5]}>
          <boxGeometry args={[2.5, 0.4, 0.1]} />
          <meshBasicMaterial color="rgba(255,255,255,0.6)" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, 5, -3.8]}>
          <boxGeometry args={[2.5, 0.4, 0.1]} />
          <meshBasicMaterial color="rgba(255,255,255,0.6)" transparent opacity={0.6} />
        </mesh>
        <mesh position={[4, 4.2, -3.2]}>
          <boxGeometry args={[2.5, 0.4, 0.1]} />
          <meshBasicMaterial color="rgba(255,255,255,0.6)" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Dock */}
      <mesh position={[0.4, -0.35, 0.6]}>
        <boxGeometry args={[3, 0.12, 0.8]} />
        <meshStandardMaterial color="#7a4f2a" />
      </mesh>
      <mesh position={[-1, 0, 0.6]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 16]} />
        <meshStandardMaterial color="#5a3f1a" />
      </mesh>
      <mesh position={[1.8, 0, 0.6]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 16]} />
        <meshStandardMaterial color="#5a3f1a" />
      </mesh>

      {/* Lights */}
      <ambientLight intensity={0.5} color="#4a3060" />
      <directionalLight position={[3, 5, 2]} intensity={1.2} color="#fff4e0" />
    </>
  );
}
