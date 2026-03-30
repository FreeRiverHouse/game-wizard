'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ChatPanel from './components/ChatPanel';
import SpeechBubble from './components/SpeechBubble';
import { useOceanAudio } from './hooks/useOceanAudio';

const OceanCanvas = dynamic(() => import('./OceanCanvas'), { ssr: false });

type Message = {
  role: 'user' | 'shopkeeper' | 'system';
  content: string;
  emotion?: string
};
type OndeFlowMode = 'EMILIO_ACTIVE' | 'CODER_ACTIVE' | 'IDLE';

export default function EmilioPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role:'shopkeeper', content:'Benvenuto! Sono Emilio, il concierge di Onde-Flow. Di cosa vuoi parlare oggi?', emotion:'excited' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [ondeFlowMode, setOndeFlowMode] = useState<OndeFlowMode>('IDLE');
  const [lastEmotion, setLastEmotion] = useState('excited');

  const { enabled, toggle: toggleAudio } = useOceanAudio();

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/onde-flow/state');
        const data = await res.json();
        setActiveApp(data.activeApp);
        setOndeFlowMode(data.mode);
      } catch (error) {
        console.error('Failed to fetch state:', error);
      }
    };
    fetchState();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role:'user', content:userMsg }]);
    setIsLoading(true);

    try {
      if (ondeFlowMode === 'CODER_ACTIVE') {
        await fetch('/api/onde-flow/state', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ mode:'EMILIO_ACTIVE' })
        });
        await fetch('/api/loop/stop', { method:'POST' });
        setOndeFlowMode('EMILIO_ACTIVE');
      }

      const res = await fetch('/api/shop/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ message:userMsg })
      });
      const data = await res.json();

      setMessages(prev => [...prev, { role:'shopkeeper', content:data.reply || '...', emotion:data.emotion }]);
      setLastEmotion(data.emotion || 'neutral');

      if (data.action === 'start_coder' && data.coderPayload) {
        await fetch('/api/onde-flow/state', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ startCoder: data.coderPayload })
        });
        await fetch('/api/graph/run', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ objective: data.coderPayload.plan, gameId:'pgr', autonomous:false, maxIterations:1 })
        });
        setOndeFlowMode('CODER_ACTIVE');
        setMessages(prev => [...prev, { role:'system', content:'⚡ Coder avviato — lavoro in corso...' }]);
      } else if (data.action === 'switch_app' && data.switchApp) {
        await fetch('/api/onde-flow/state', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ activeApp: data.switchApp })
        });
        setActiveApp(data.switchApp);
      }

      setIsLoading(false);
    } catch {
      setMessages(prev => [...prev, { role:'system', content:'Errore connessione Emilio' }]);
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/shop/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ message:'__reset__' })
      });
      setMessages([{ role:'shopkeeper', content:'Conversazione resettata. Sono qui!', emotion:'neutral' }]);
    } catch {
      setMessages(prev => [...prev, { role:'system', content:'Errore durante il reset' }]);
    }
  };

  return (
    <main style={{ display:'flex', width:'100vw', height:'100vh', overflow:'hidden', background:'#02020c' }}>
      <div style={{ position:'relative', width:'60%', height:'100%' }}>
        <OceanCanvas emotion={lastEmotion} />
        <SpeechBubble
          message={messages[messages.length-1]?.role==='shopkeeper' ? messages[messages.length-1].content : ''}
          emotion={lastEmotion}
          isLoading={isLoading}
        />
        <button
          onClick={toggleAudio}
          style={{
            position:'absolute', top:12, right:12,
            background:'rgba(0,0,0,0.5)', border:'1px solid rgba(0,212,255,0.3)',
            color:enabled?'#00d4ff':'#666', borderRadius:6,
            padding:'6px 10px', fontSize:11, cursor:'pointer', fontFamily:'monospace'
          }}
        >
          {enabled ? '🔊' : '🔇'}
        </button>
      </div>
      <ChatPanel
        messages={messages}
        isLoading={isLoading}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
        onReset={handleReset}
        activeApp={activeApp}
        ondeFlowMode={ondeFlowMode}
      />
    </main>
  );
}
