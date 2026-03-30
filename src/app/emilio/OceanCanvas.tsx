'use client';

import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import OceanMesh from './components/OceanMesh';
import SceneEnvironment from './components/SceneEnvironment';
import EmilioCharacter from './components/EmilioCharacter';

interface OceanCanvasProps {
  emotion: string;
}

export default function OceanCanvas({ emotion }: OceanCanvasProps) {
  const safeEmotion = (['neutral','excited','thinking','proud','focused','relaxed'].includes(emotion) ? emotion : 'neutral') as 'neutral' | 'excited' | 'thinking' | 'proud' | 'focused' | 'relaxed';

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: '#02020c' }}
      gl={{ antialias: true, alpha: false }}
    >
      <OrthographicCamera makeDefault zoom={90} position={[0, 1, 5]} />
      <SceneEnvironment />
      <OceanMesh />
      <EmilioCharacter emotion={safeEmotion} />
      <fog attach="fog" args={['#0a0420', 8, 20]} />
    </Canvas>
  );
}
