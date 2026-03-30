'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ChatPanel from './components/ChatPanel';
import SpeechBubble from './components/SpeechBubble';
import { useOceanAudio } from './hooks/useOceanAudio';
import { useVoiceInput } from './hooks/useVoiceInput';

const OceanCanvas = dynamic(() => import('./OceanCanvas'), { ssr: false });

type Message = {
  role: 'user' | 'shopkeeper' | 'system' | 'bot';
  content: string;
  emotion?: string
};
type OndeFlowMode = 'EMILIO_ACTIVE' | 'CODER_ACTIVE' | 'IDLE';
type EmilioBackend = 'opus-distill' | 'sonnet' | 'coder';

const GP_SCRIPT = [
  'Hey Emilio! What projects do we have going on right now?',
  "Give me the status of game-studio — where are we at?",
  'I want to add an achievements system to the game',
  "What about book-wizard? How's the EPUB pipeline coming along?",
  "Ok, let's focus on game-studio for now",
  "Perfect Emilio, send the Coder to work on game-studio with the tasks you have in mind"
];

export default function EmilioPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role:'shopkeeper', content:"Hey! I'm Emilio, your Onde-Flow concierge. What are we working on today?", emotion:'excited' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [ondeFlowMode, setOndeFlowMode] = useState<OndeFlowMode>('IDLE');
  const [lastEmotion, setLastEmotion] = useState('excited');

  const [currentBackend, setCurrentBackend] = useState<EmilioBackend>('sonnet');
  const [isSwitchingBackend, setIsSwitchingBackend] = useState(false);
  const [isGPRunning, setIsGPRunning] = useState(false);
  const [gpStep, setGPStep] = useState(0);
  const gpAbortRef = useRef(false);
  const currentAudioRef = useRef<AudioBufferSourceNode | null>(null);
  const currentAudioCtxRef = useRef<AudioContext | null>(null);
  const [startMode, setStartMode] = useState<'user' | 'bot' | null>(null);

  useEffect(() => {
    if (startMode === 'bot') {
      const timer = setTimeout(() => runGPTest(), 1500);
      return () => clearTimeout(timer);
    }
  }, [startMode]);

  const { enabled, toggle: toggleAudio } = useOceanAudio();
  const { isRecording: isVoiceRecording, isProcessing: isVoiceProcessing, toggleRecording } = useVoiceInput(
    (text) => { void sendToEmilio(text); }
  );

  const speakFallback = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'en-US'; utt.rate = 1.05; utt.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang === 'en-US' && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural')));
      if (preferred) utt.voice = preferred;
      utt.onend = () => resolve(); utt.onerror = () => resolve();
      window.speechSynthesis.speak(utt);
    });
  }

  const stopCurrentAudio = () => {
    try { currentAudioRef.current?.stop(); } catch {}
    try { currentAudioCtxRef.current?.close(); } catch {}
    currentAudioRef.current = null;
    currentAudioCtxRef.current = null;
    window.speechSynthesis?.cancel();
  }

  const playTTS = async (text: string): Promise<void> => {
    stopCurrentAudio();
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) { await speakFallback(text); return; }
      const audioData = await res.arrayBuffer()
      const audioCtx = new AudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(audioData)
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)
      currentAudioRef.current = source;
      currentAudioCtxRef.current = audioCtx;
      await new Promise<void>((resolve) => {
        source.onended = () => { audioCtx.close(); currentAudioRef.current = null; resolve(); }
        source.start()
      })
    } catch {
      await speakFallback(text);
    }
  }

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

  async function handleSwitchBackend(b: EmilioBackend) {
    setIsSwitchingBackend(true);
    try {
      await fetch('/api/emilio/switch-backend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend: b })
      });
      setCurrentBackend(b);
    } catch { /* ignora */ }
    setIsSwitchingBackend(false);
  }

  async function runGPTest() {
    gpAbortRef.current = false;
    setIsGPRunning(true);
    setGPStep(0);
    await fetch('/api/shop/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__reset__' })
    });
    setMessages([{ role: 'system', content: '🐹 Guinea Pig started — ' + GP_SCRIPT.length + ' messages queued' }]);
    for (let i = 0; i < GP_SCRIPT.length; i++) {
      if (gpAbortRef.current) break;
      setGPStep(i + 1);
      let botMsg: string
      let fromLocal = false
      try {
        const history = messages
          .filter(m => m.role === 'bot' || m.role === 'shopkeeper')
          .map(m => m.content)
          .slice(-6)
        const gpRes = await fetch('/api/emilio/gp-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: i + 1,
            totalSteps: GP_SCRIPT.length,
            history,
            context: 'User testing Onde-Flow creative OS with Emilio the concierge'
          })
        })
        const gpData = await gpRes.json() as { message: string; fromLocal: boolean }
        botMsg = gpData.message
        fromLocal = gpData.fromLocal
      } catch {
        botMsg = GP_SCRIPT[i]
      }
      const prefix = fromLocal ? '🤖 ' : '🐹 '
      setMessages(prev => [...prev, { role: 'bot', content: prefix + botMsg }])
      void playTTS(botMsg);
      if (gpAbortRef.current) break;
      setIsLoading(true);
      try {
        const res = await fetch('/api/shop/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: botMsg, clientAudio: true })
        });
        const data = await res.json();
        const emilioReply: string = data.reply || '...';
        setMessages(prev => [...prev, { role: 'shopkeeper', content: emilioReply, emotion: data.emotion }]);
        setLastEmotion(data.emotion || 'neutral');
        void playTTS(emilioReply);
        if (data.action === 'start_coder' && data.coderPayload) {
          await fetch('/api/onde-flow/state', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startCoder: data.coderPayload })
          });
          setOndeFlowMode('CODER_ACTIVE');
          setMessages(prev => [...prev, { role: 'system', content: '⚡ Coder started by GP test' }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: 'system', content: 'Error step ' + (i + 1) }]);
      }
      setIsLoading(false);
      await new Promise(r => setTimeout(r, 500));
    }
    setIsGPRunning(false);
    setMessages(prev => [...prev, { role: 'system', content: '🐹 GP Test complete!' }]);
  }

  function stopGPTest() { gpAbortRef.current = true; stopCurrentAudio(); }

  const sendToEmilio = async (userMsg: string) => {
    if (!userMsg.trim() || isLoading) return;
    setMessages(prev => [...prev, { role:'user', content:userMsg }]);
    setIsLoading(true);
    try {
      if (ondeFlowMode === 'CODER_ACTIVE') {
        await fetch('/api/onde-flow/state', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ mode:'EMILIO_ACTIVE' }) });
        await fetch('/api/loop/stop', { method:'POST' });
        setOndeFlowMode('EMILIO_ACTIVE');
      }
      const res = await fetch('/api/shop/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message:userMsg, clientAudio:true }) });
      const data = await res.json();
      const emilioReply: string = data.reply || '...';
      setMessages(prev => [...prev, { role:'shopkeeper', content:emilioReply, emotion:data.emotion }]);
      setLastEmotion(data.emotion || 'neutral');
      void playTTS(emilioReply);
      if (data.action === 'start_coder' && data.coderPayload) {
        await fetch('/api/onde-flow/state', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ startCoder: data.coderPayload }) });
        await fetch('/api/graph/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ objective: data.coderPayload.plan, gameId:'pgr', autonomous:false, maxIterations:1 }) });
        setOndeFlowMode('CODER_ACTIVE');
        setMessages(prev => [...prev, { role:'system', content:'⚡ Coder started — working...' }]);
      } else if (data.action === 'switch_app' && data.switchApp) {
        await fetch('/api/onde-flow/state', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ activeApp: data.switchApp }) });
        setActiveApp(data.switchApp);
      }
    } catch {
      setMessages(prev => [...prev, { role:'system', content:'Errore connessione Emilio' }]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = inputValue.trim();
    if (!msg) return;
    setInputValue('');
    await sendToEmilio(msg);
  };

  const handleReset = async () => {
    try {
      await fetch('/api/shop/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ message:'__reset__' })
      });
      setMessages([{ role:'shopkeeper', content:'Conversation reset. Ready!', emotion:'neutral' }]);
    } catch {
      setMessages(prev => [...prev, { role:'system', content:'Errore durante il reset' }]);
    }
  };

  if (startMode === null) {
    return (
      <main style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100vw', height:'100vh', background:'#02020c', fontFamily:'monospace' }}>
        <div style={{ color:'rgba(0,212,255,0.5)', fontSize:11, letterSpacing:4, marginBottom:8 }}>ONDE-FLOW // CREATIVE OS</div>
        <div style={{ color:'#00d4ff', fontSize:22, letterSpacing:3, marginBottom:48, fontWeight:700 }}>SELECT MODE</div>
        <div style={{ display:'flex', gap:24 }}>
          <button
            onClick={() => setStartMode('user')}
            style={{ background:'rgba(0,212,255,0.05)', border:'1px solid #00d4ff', borderRadius:8, padding:'28px 40px', cursor:'pointer', color:'#00d4ff', fontFamily:'monospace', textAlign:'center', transition:'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.05)')}
          >
            <div style={{ fontSize:32, marginBottom:12 }}>🎙</div>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:2 }}>TALK TO EMILIO</div>
            <div style={{ fontSize:10, marginTop:6, color:'rgba(0,212,255,0.5)' }}>I control the conversation</div>
          </button>
          <button
            onClick={() => setStartMode('bot')}
            style={{ background:'rgba(168,85,247,0.05)', border:'1px solid #a855f7', borderRadius:8, padding:'28px 40px', cursor:'pointer', color:'#a855f7', fontFamily:'monospace', textAlign:'center', transition:'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.05)')}
          >
            <div style={{ fontSize:32, marginBottom:12 }}>🤖</div>
            <div style={{ fontSize:14, fontWeight:700, letterSpacing:2 }}>WATCH THE BOT</div>
            <div style={{ fontSize:10, marginTop:6, color:'rgba(168,85,247,0.5)' }}>Kimi talks to Emilio live</div>
          </button>
        </div>
      </main>
    );
  }

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
        currentBackend={currentBackend}
        onSwitchBackend={handleSwitchBackend}
        isSwitchingBackend={isSwitchingBackend}
        isGPRunning={isGPRunning}
        gpStep={gpStep}
        gpTotal={GP_SCRIPT.length}
        onRunGP={runGPTest}
        onStopGP={stopGPTest}
        isVoiceRecording={isVoiceRecording}
        isVoiceProcessing={isVoiceProcessing}
        onToggleVoice={toggleRecording}
      />
    </main>
  );
}
