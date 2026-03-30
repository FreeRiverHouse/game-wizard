'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EmilioCharacterProps {
  emotion: 'neutral' | 'excited' | 'thinking' | 'proud' | 'focused' | 'relaxed';
}

export default function EmilioCharacter({ emotion }: EmilioCharacterProps){
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (!groupRef.current) return;

    switch (emotion) {
      case 'neutral':
        groupRef.current.position.y = -0.1 + Math.sin(t * 1.2) * 0.015;
        break;
      case 'excited':
        groupRef.current.position.y = -0.1 + Math.abs(Math.sin(t * 3)) * 0.06;
        break;
      case 'thinking':
        if (headRef.current) {
          headRef.current.rotation.z = Math.sin(t * 0.8) * 0.18;
        }
        break;
      case 'proud':
        groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.25;
        break;
      case 'focused':
        groupRef.current.position.y = -0.1 + Math.sin(t * 0.7) * 0.008;
        break;
      case 'relaxed':
        groupRef.current.rotation.z = Math.sin(t * 0.4) * 0.05;
        break;
      default:
        break;
    }
  });

  return (
    <group ref={groupRef} position={[0.4, -0.1, 0.9]}>
      {/* Testa */}
      <mesh ref={headRef} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="#C8956C" />
      </mesh>

      {/* Occhi */}
      <mesh position={[-0.07, 0.6, 0.18]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial color="#1a0a00" />
      </mesh>
      <mesh position={[0.07, 0.6, 0.18]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial color="#1a0a00" />
      </mesh>

      {/* Naso */}
      <mesh position={[0, 0.53, 0.2]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color="#b07355" />
      </mesh>

      {/* Baffi */}
      <mesh position={[-0.045, 0.49, 0.19]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.1, 0.018, 0.02]} />
        <meshStandardMaterial color="#1a0800" />
      </mesh>
      <mesh position={[0.045, 0.49, 0.19]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.1, 0.018, 0.02]} />
        <meshStandardMaterial color="#1a0800" />
      </mesh>

      {/* Corpo */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.36, 0.44, 0.22]} />
        <meshStandardMaterial color="#CC2200" />
      </mesh>

      {/* Grembiule */}
      <mesh position={[0, 0.22, 0.12]}>
        <boxGeometry args={[0.28, 0.38, 0.04]} />
        <meshStandardMaterial color="#e8e0d0" />
      </mesh>

      {/* Cappello base */}
      <mesh position={[0, 0.77, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.06, 32]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>

      {/* Cappello top */}
      <mesh position={[0, 0.91, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.25, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Braccia */}
      <mesh position={[-0.23, 0.22, 0]}>
        <boxGeometry args={[0.1, 0.32, 0.1]} />
        <meshStandardMaterial color="#CC2200" />
      </mesh>
      <mesh position={[0.23, 0.22, 0]}>
        <boxGeometry args={[0.1, 0.32, 0.1]} />
        <meshStandardMaterial color="#CC2200" />
      </mesh>
    </group>
  );
}
