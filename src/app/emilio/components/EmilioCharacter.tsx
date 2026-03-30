'use client'

import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface EmilioCharacterProps {
  emotion: 'neutral' | 'excited' | 'thinking' | 'proud' | 'focused' | 'relaxed' | 'happy'
}

export default function EmilioCharacter({ emotion }: EmilioCharacterProps) {
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const chestRef = useRef<THREE.Mesh>(null)
  const mustacheLRef = useRef<THREE.Mesh>(null)
  const mustacheRRef = useRef<THREE.Mesh>(null)

  // Cleanup materials
  useEffect(() => {
    return () => {
      // Materials will be garbage collected with meshes
    }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (!groupRef.current) return

    // Reset transforms
    groupRef.current.position.y = -0.1
    groupRef.current.rotation.set(0, 0, 0)

    if (chestRef.current) {
      chestRef.current.scale.set(1, 1, 1)
    }
    if (headRef.current) {
      headRef.current.rotation.set(0, 0, 0)
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.set(0, 0, 0)
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.set(0, 0, 0)
    }
    if (mustacheLRef.current && mustacheRRef.current) {
      mustacheLRef.current.scale.set(1, 1, 1)
      mustacheRRef.current.scale.set(1, 1, 1)
    }

    switch (emotion) {
      case 'neutral':
        // Idle breathing
        groupRef.current.position.y = -0.1 + Math.sin(t * 1.5) * 0.015
        if (chestRef.current) {
          chestRef.current.scale.y = 0.98 + Math.sin(t * 2) * 0.02
        }
        break

      case 'excited':
        // Fast bob + arms raised
        groupRef.current.position.y = -0.15 + Math.abs(Math.sin(t * 4)) * 0.12
        if (leftArmRef.current) {
          leftArmRef.current.rotation.z = 0.8 + Math.sin(t * 6) * 0.2
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.z = -0.8 - Math.sin(t * 6) * 0.2
        }
        break

      case 'happy':
        // Lean forward + mustache scale up
        groupRef.current.rotation.x = 0.15
        groupRef.current.position.y = -0.1 + Math.sin(t * 2) * 0.03
        if (mustacheLRef.current && mustacheRRef.current) {
          const mustacheScale = 1 + Math.sin(t * 1.5) * 0.1
          mustacheLRef.current.scale.y = mustacheScale
          mustacheRRef.current.scale.y = mustacheScale
        }
        break

      case 'thinking':
        // Head tilt + right arm to face
        groupRef.current.position.y = -0.1 + Math.sin(t * 0.8) * 0.01
        if (headRef.current) {
          headRef.current.rotation.z = Math.sin(t * 0.5) * 0.15
          headRef.current.rotation.y = Math.sin(t * 0.3) * 0.1
        }
        if (rightArmRef.current) {
          rightArmRef.current.rotation.z = -1.2 + Math.sin(t) * 0.1
          rightArmRef.current.position.y = 0.4
        }
        break

      case 'proud':
        // Slow rotation sway
        groupRef.current.position.y = -0.08 + Math.sin(t * 0.6) * 0.02
        groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.2
        break

      case 'focused':
        // Minimal movement
        groupRef.current.position.y = -0.1 + Math.sin(t * 0.3) * 0.005
        break

      case 'relaxed':
        // Gentle sway
        groupRef.current.position.y = -0.12 + Math.sin(t * 0.8) * 0.02
        groupRef.current.rotation.z = Math.sin(t * 0.4) * 0.04
        break

      default:
        break
    }
  })

  return (
    <group ref={groupRef} position={[0.4, -0.1, 0.9]}>
      {/* Head */}
      <mesh ref={headRef} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshToonMaterial color="#c68642" />
      </mesh>

      {/* Eyes - black */}
      <mesh position={[-0.07, 0.6, 0.18]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color="#1a0a00" />
      </mesh>
      <mesh position={[0.07, 0.6, 0.18]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color="#1a0a00" />
      </mesh>

      {/* Eye highlights */}
      <mesh position={[-0.06, 0.61, 0.2]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.08, 0.61, 0.2]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Nose */}
      <mesh position={[0, 0.53, 0.2]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshToonMaterial color="#b07355" />
      </mesh>

      {/* Mustache left */}
      <mesh ref={mustacheLRef} position={[-0.055, 0.49, 0.19]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.1, 0.018, 0.02]} />
        <meshToonMaterial color="#3d1f00" />
      </mesh>

      {/* Mustache right */}
      <mesh ref={mustacheRRef} position={[0.055, 0.49, 0.19]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.1, 0.018, 0.02]} />
        <meshToonMaterial color="#3d1f00" />
      </mesh>

      {/* Body/chest */}
      <mesh ref={chestRef} position={[0, 0.22, 0]}>
        <boxGeometry args={[0.36, 0.44, 0.22]} />
        <meshToonMaterial color="#cc2200" />
      </mesh>

      {/* Apron */}
      <mesh position={[0, 0.22, 0.12]}>
        <boxGeometry args={[0.28, 0.38, 0.04]} />
        <meshToonMaterial color="#e8e0d0" />
      </mesh>

      {/* Apron buttons */}
      <mesh position={[-0.05, 0.35, 0.141]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.05, 0.25, 0.141]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Chef hat - base */}
      <mesh position={[0, 0.77, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 32]} />
        <meshToonMaterial color="#f5f5f5" />
      </mesh>

      {/* Chef hat - band black */}
      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.04, 32]} />
        <meshToonMaterial color="#1a1a1a" />
      </mesh>

      {/* Chef hat - top */}
      <mesh position={[0, 0.91, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.25, 32]} />
        <meshToonMaterial color="#ffffff" />
      </mesh>

      {/* Left arm */}
      <mesh ref={leftArmRef} position={[-0.23, 0.22, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 16]} />
        <meshToonMaterial color="#cc2200" />
      </mesh>

      {/* Right arm */}
      <mesh ref={rightArmRef} position={[0.23, 0.22, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 16]} />
        <meshToonMaterial color="#cc2200" />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.28, 0.05, 0]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshToonMaterial color="#c68642" />
      </mesh>
      <mesh position={[0.28, 0.05, 0]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshToonMaterial color="#c68642" />
      </mesh>

      {/* Shadow */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}
