'use client'

import { useRef, useEffect } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface EmilioCharacterProps {
  emotion?: 'neutral' | 'excited' | 'thinking' | 'proud' | 'focused' | 'relaxed' | 'happy'
  onSpeaking?: boolean
}

export default function EmilioCharacter({ emotion = 'neutral', onSpeaking: _onSpeaking = false }: EmilioCharacterProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/models/emilio.glb')
  const { actions, mixer } = useAnimations(animations, group)

  useEffect(() => {
    const firstKey = Object.keys(actions)[0]
    const idleAction = actions['idle'] ?? actions['Idle'] ?? (firstKey ? actions[firstKey] : null)
    if (idleAction) {
      idleAction.reset().fadeIn(0.3).play()
    }

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        mesh.material = new THREE.MeshToonMaterial({
          map: mat.map ?? null,
          color: mat.color ?? new THREE.Color('#cc8844'),
        })
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })

    return () => { mixer.stopAllAction() }
  }, [actions, mixer, scene])

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    switch (emotion) {
      case 'excited':
        group.current.position.y = -0.8 + Math.sin(t * 6) * 0.05
        group.current.rotation.z = Math.sin(t * 4) * 0.03
        break
      case 'thinking':
        group.current.rotation.y = Math.sin(t * 0.8) * 0.2
        group.current.position.y = -0.8 + Math.sin(t * 1.5) * 0.01
        break
      case 'happy':
        group.current.position.y = -0.8 + Math.abs(Math.sin(t * 3)) * 0.05
        group.current.rotation.z = Math.sin(t * 2) * 0.04
        break
      case 'proud':
        group.current.rotation.y = Math.sin(t * 0.5) * 0.3
        group.current.position.y = -0.8
        break
      default:
        group.current.position.y = -0.8 + Math.sin(t * 1.2) * 0.008
        group.current.rotation.z = Math.sin(t * 0.8) * 0.004
    }
  })

  return (
    <group ref={group} scale={[2.2, 2.2, 2.2]} position={[0, -0.8, 0]}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/emilio.glb')
