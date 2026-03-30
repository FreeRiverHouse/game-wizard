'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import OceanMesh from './components/OceanMesh';
import SceneEnvironment from './components/SceneEnvironment';
import EmilioCharacter from './components/EmilioCharacter';

interface OceanCanvasProps {
  emotion: string;
}

export default function OceanCanvas({ emotion }: OceanCanvasProps) {
  const safeEmotion = (
    ['neutral', 'excited', 'thinking', 'proud', 'focused', 'relaxed', 'happy'].includes(emotion)
      ? emotion
      : 'neutral'
  ) as 'neutral' | 'excited' | 'thinking' | 'proud' | 'focused' | 'relaxed' | 'happy';

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: '#02020c' }}
      gl={{ antialias: true, alpha: false }}
    >
      <fog attach="fog" args={['#ff6633', 8, 25]} />
      <ambientLight intensity={0.4} color="#ff9966" />
      <pointLight position={[-3, 3, 2]} intensity={1.2} color="#ffcc44" />
      <pointLight position={[2, -1, 1]} intensity={0.3} color="#4488ff" />
      <OrthographicCamera makeDefault zoom={90} position={[0, 1, 5]} />
      <SceneEnvironment />
      <OceanMesh />
      <Suspense fallback={null}>
        <EmilioCharacter emotion={safeEmotion} />
      </Suspense>
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.4} />
        <Vignette eskil={false} offset={0.15} darkness={0.6} />
        <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0005, 0.0005]} />
      </EffectComposer>
    </Canvas>
  );
}
