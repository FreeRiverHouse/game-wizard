'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function SceneEnvironment() {
  const skyGroupRef = useRef<THREE.Group>(null);
  const islandGroupRef = useRef<THREE.Group>(null);
  const lighthouseGroupRef = useRef<THREE.Group>(null);
  const cloudsGroupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Sky gradient shader
  const skyUniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  const skyVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const skyFragmentShader = `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec3 topColor = vec3(0.18, 0.08, 0.35);
      vec3 midColor = vec3(0.78, 0.45, 0.22);
      vec3 bottomColor = vec3(1.0, 0.97, 0.4);
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

  // Stars geometry
  const starsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (let i = 0; i < 12; i++) {
      positions.push(
        (Math.random() - 0.5) * 3,
        0.6 + Math.random() * 0.3,
        0
      );
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, []);

  // Island silhouette with custom shape
  const islandShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.5, 0);
    shape.bezierCurveTo(-2, 0.8, -1, 1.2, 0, 1.0);
    shape.bezierCurveTo(1, 0.9, 2, 1.3, 2.5, 0.6);
    shape.bezierCurveTo(2.2, 0.2, 1.5, 0, 0.5, -0.2);
    shape.bezierCurveTo(-0.5, -0.3, -1.8, -0.1, -2.5, 0);
    return shape;
  }, []);

  const islandGeometry = useMemo(() => {
    return new THREE.ShapeGeometry(islandShape);
  }, [islandShape]);

  // Lighthouse geometries
  const lighthouseBaseGeom = useMemo(() => new THREE.BoxGeometry(0.3, 0.4, 0.3), []);
  const lighthouseMidGeom = useMemo(() => new THREE.BoxGeometry(0.22, 0.5, 0.22), []);
  const lighthouseTopGeom = useMemo(() => new THREE.BoxGeometry(0.15, 0.3, 0.15), []);
  const lighthouseRoomGeom = useMemo(() => new THREE.BoxGeometry(0.25, 0.2, 0.25), []);

  // Cloud shapes
  const cloudShapes = useMemo(() => {
    return [
      { x: -3, y: 2.8, z: -2, scale: 1.2, speed: 0.02 },
      { x: 0, y: 3.2, z: -2.5, scale: 0.9, speed: 0.015 },
      { x: 3, y: 2.5, z: -1.5, scale: 1.1, speed: 0.018 }
    ];
  }, []);

  const Cloud = ({ x, y, z }: { x: number; y: number; z: number }) => {
    const spheres = useMemo(() => [
      { px: 0,     py: 0,    r: 0.12 },
      { px: -0.14, py: -0.02, r: 0.09 },
      { px:  0.15, py: -0.01, r: 0.10 },
      { px: -0.07, py:  0.07, r: 0.08 },
      { px:  0.08, py:  0.08, r: 0.07 },
    ], []);
    return (
      <group position={[x, y, z]}>
        {spheres.map((s, i) => (
          <mesh key={i} position={[s.px, s.py, 0]}>
            <sphereGeometry args={[s.r, 8, 6]} />
            <meshToonMaterial color="#ffffff" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
    );
  };

  // Dock geometries
  const plankGeometries = useMemo(() => {
    const geoms: THREE.BoxGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      geoms.push(new THREE.BoxGeometry(2.8, 0.04, 0.12));
    }
    return geoms;
  }, []);

  const postGeometries = useMemo(() => {
    const geoms: THREE.CylinderGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      geoms.push(new THREE.CylinderGeometry(0.04, 0.04, 0.8));
    }
    return geoms;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      starsGeometry.dispose();
      islandGeometry.dispose();
      lighthouseBaseGeom.dispose();
      lighthouseMidGeom.dispose();
      lighthouseTopGeom.dispose();
      lighthouseRoomGeom.dispose();
      plankGeometries.forEach(g => g.dispose());
      postGeometries.forEach(g => g.dispose());
    };
  }, [starsGeometry, islandGeometry, lighthouseBaseGeom, lighthouseMidGeom, lighthouseTopGeom, lighthouseRoomGeom, plankGeometries, postGeometries]);

  // Animation
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    
    // Parallax drift
    if (skyGroupRef.current) {
      skyGroupRef.current.position.x = Math.sin(t * 0.02) * 0.3;
    }
    if (islandGroupRef.current) {
      islandGroupRef.current.position.x = Math.sin(t * 0.03) * 0.5;
    }
    if (lighthouseGroupRef.current) {
      lighthouseGroupRef.current.position.x = Math.sin(t * 0.04) * 0.7;
    }
    if (cloudsGroupRef.current) {
      cloudsGroupRef.current.children.forEach((child, i) => {
        child.position.x = cloudShapes[i].x + Math.sin(t * cloudShapes[i].speed) * 0.3;
      });
    }

    // Lighthouse light oscillation
    if (lightRef.current) {
      lightRef.current.intensity = 0.8 + Math.sin(t * 1.5) * 0.3;
    }
  });

  return (
    <>
      {/* Layer 1: Sky background with stars */}
      <group ref={skyGroupRef} position={[0, 1.5, -8]}>
        <mesh>
          <planeGeometry args={[20, 12]} />
          <shaderMaterial
            vertexShader={skyVertexShader}
            fragmentShader={skyFragmentShader}
            uniforms={skyUniforms}
          />
        </mesh>
        {/* Stars */}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 8,
              4 + Math.random() * 1.5,
              0.1
            ]}
          >
            <circleGeometry args={[0.015 + Math.random() * 0.02, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7 + Math.random() * 0.3} />
          </mesh>
        ))}
      </group>

      {/* Layer 2: Island silhouette */}
      <group ref={islandGroupRef} position={[0, -1.5, -5]}>
        <mesh geometry={islandGeometry} position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <meshBasicMaterial color="#0d0a1a" />
        </mesh>
      </group>

      {/* Layer 3: Lighthouse */}
      <group ref={lighthouseGroupRef} position={[1.5, -0.8, -3]}>
        {/* Base */}
        <mesh geometry={lighthouseBaseGeom} position={[0, 0.2, 0]}>
          <meshBasicMaterial color="#e8e0d8" />
        </mesh>
        {/* Middle */}
        <mesh geometry={lighthouseMidGeom} position={[0, 0.65, 0]}>
          <meshBasicMaterial color="#f5f0eb" />
        </mesh>
        {/* Top */}
        <mesh geometry={lighthouseTopGeom} position={[0, 1.15, 0]}>
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Light room */}
        <mesh geometry={lighthouseRoomGeom} position={[0, 1.45, 0]}>
          <meshBasicMaterial color="#ffdd88" transparent opacity={0.9} />
        </mesh>
        {/* Light point */}
        <pointLight
          ref={lightRef}
          position={[0, 1.5, 0.2]}
          color="#ffdd88"
          intensity={1.1}
          distance={15}
          decay={2}
        />
      </group>

      {/* Layer 4: Detailed dock */}
      <group position={[0.4, -0.35, -1]}>
        {/* Planks */}
        {plankGeometries.map((geom, i) => (
          <mesh key={i} geometry={geom} position={[0, i * 0.11, 0]}>
            <meshStandardMaterial color="#5a4030" />
          </mesh>
        ))}
        {/* Side edges */}
        <mesh position={[-1.45, 0.33, 0]}>
          <boxGeometry args={[0.08, 0.72, 0.15]} />
          <meshStandardMaterial color="#4a3528" />
        </mesh>
        <mesh position={[1.45, 0.33, 0]}>
          <boxGeometry args={[0.08, 0.72, 0.15]} />
          <meshStandardMaterial color="#4a3528" />
        </mesh>
        {/* Posts */}
        {postGeometries.map((geom, i) => {
          const x = i < 2 ? -1.4 : 1.4;
          const z = i % 2 === 0 ? -0.3 : 0.3;
          return (
            <mesh key={i} geometry={geom} position={[x, 0, z]}>
              <meshStandardMaterial color="#3d2a1a" />
            </mesh>
          );
        })}
      </group>

      {/* Sun */}
      <mesh position={[-2.5, 1.8, -7]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color="#FFD166" />
      </mesh>
      <pointLight position={[-2.5, 1.8, -5]} color="#FF9944" intensity={1.5} />

      {/* Clouds layer */}
      <group ref={cloudsGroupRef}>
        {cloudShapes.map((cloud, i) => (
          <Cloud key={i} x={cloud.x} y={cloud.y} z={cloud.z} />
        ))}
      </group>

      {/* Ambient lighting */}
      <ambientLight intensity={0.5} color="#4a3060" />
      <directionalLight position={[3, 5, 2]} intensity={1.2} color="#fff4e0" />
    </>
  );
}