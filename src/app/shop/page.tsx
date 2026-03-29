'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const BOT_SCRIPT = [
  'Ciao Gino! Cosa vendi qui?',
  'Voglio creare un gioco platform 2D con un gatto astronauta',
  'Il protagonista si chiama Cosmo e raccoglie stelle nello spazio',
  'Aggiungi un boss finale gigante: un buco nero con faccia arrabbiata',
  'Perfetto! Crea questo gioco adesso!',
];

export default function ShopPage() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; emotion?: string }>>([
    { role: 'shopkeeper', content: "Benvenuto! I am Gino. Tell me — what kind of game lives in your imagination?", emotion: 'excited' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const router = useRouter();
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botStep, setBotStep] = useState(0);
  const botAbortRef = useRef<boolean>(false);
  const [pipeline, setPipeline] = useState<null | {
    gino: string; planner: string; coder: string; vision: string; detail: string; loopState: string;
  }>(null);
  const pipelineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'it-IT'; // Italian-friendly
    r.onresult = (e: any) => {
      setInputValue(e.results[0][0].transcript);
      setIsRecording(false);
    };
    r.onerror = () => setIsRecording(false);
    r.onend = () => setIsRecording(false);
    recognitionRef.current = r;
    return () => r.abort();
  }, []);

  const handleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setInputValue('');
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const playTTS = async (text: string) => {
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      // TTS is optional — silently ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = inputValue.trim();
    if (!msg || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInputValue('');
    setIsLoading(true);
    try {
      const resp = await fetch('/api/shop/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await resp.json();
      const reply = data.reply || data.response || 'Mamma mia…';
      setMessages(prev => [...prev, { role: 'shopkeeper', content: reply, emotion: data.emotion }]);
      if (ttsEnabled) playTTS(reply);
      if (data.action === 'create_game' && data.gameDescription) {
        setMessages(prev => [...prev, { role: 'system', content: '🎮 GIOCO CREATO: ' + data.gameDescription }]);
        await triggerGameCreation(data.gameDescription);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'shopkeeper', content: 'Mamma mia, un momento...', emotion: 'thinking' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startPipelinePolling = () => {
    if (pipelineTimerRef.current) clearInterval(pipelineTimerRef.current);
    const poll = async () => {
      try {
        const r = await fetch('/api/orchestrator/status');
        const d = await r.json();
        setPipeline({
          gino:      'ready',
          planner:   d.pipeline?.planner?.status ?? d.orchestrator?.pipeline?.planner ?? 'idle',
          coder:     d.pipeline?.coder?.status   ?? d.orchestrator?.pipeline?.coder   ?? 'idle',
          vision:    d.pipeline?.vision?.status  ?? d.orchestrator?.pipeline?.vision  ?? 'idle',
          detail:    d.detail ?? d.orchestrator?.detail ?? '',
          loopState: d.loop?.state ?? 'idle',
        });
        // Stop polling when loop goes back to idle after running
        if (d.loop?.state === 'idle' && d.orchestrator?.loadedModel === null) {
          clearInterval(pipelineTimerRef.current!);
          pipelineTimerRef.current = null;
        }
      } catch { /* ignore */ }
    };
    poll();
    pipelineTimerRef.current = setInterval(poll, 2000);
  };

  const triggerGameCreation = async (gameDescription: string) => {
    setPipeline({ gino: 'ready', planner: 'idle', coder: 'idle', vision: 'idle', detail: 'Starting...', loopState: 'starting' });
    startPipelinePolling();
    try {
      await fetch('/api/loop/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: gameDescription,
          maxIterations: 3,
          continuous: false,
          autoCommit: false,
        })
      });
    } catch (e) {
      console.error('Failed to start loop:', e);
    }
  };

  const resetChat = async () => {
    botAbortRef.current = true;
    setIsBotRunning(false);
    setBotStep(0);
    await fetch('/api/shop/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '__reset__' }) });
    setMessages([{ role: 'shopkeeper', content: "Benvenuto! I am Gino. Tell me — what kind of game lives in your imagination?", emotion: 'excited' }]);
  };

  const runBotTest = async () => {
    if (isBotRunning) { botAbortRef.current = true; setIsBotRunning(false); return; }
    botAbortRef.current = false;
    setIsBotRunning(true);
    setBotStep(0);
    await fetch('/api/shop/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '__reset__' }) });
    setMessages([{ role: 'shopkeeper', content: "Benvenuto! I am Gino. Tell me — what kind of game lives in your imagination?", emotion: 'excited' }]);
    for (let i = 0; i < BOT_SCRIPT.length; i++) {
      if (botAbortRef.current) break;
      await new Promise(r => setTimeout(r, 1500));
      if (botAbortRef.current) break;
      const msg = BOT_SCRIPT[i];
      setBotStep(i + 1);
      setMessages(prev => [...prev, { role: 'bot', content: msg }]);
      setIsLoading(true);
      try {
        const resp = await fetch('/api/shop/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
        const data = await resp.json();
        const reply = data.reply || 'Mamma mia...';
        setMessages(prev => [...prev, { role: 'shopkeeper', content: reply, emotion: data.emotion }]);
        if (ttsEnabled) playTTS(reply);
        if (data.action === 'create_game' && data.gameDescription) {
          setMessages(prev => [...prev, { role: 'system', content: '🎮 GIOCO CREATO: ' + data.gameDescription }]);
          await triggerGameCreation(data.gameDescription);
        }
      } catch { setMessages(prev => [...prev, { role: 'shopkeeper', content: 'Mamma mia!', emotion: 'thinking' }]); }
      finally { setIsLoading(false); }
      await new Promise(r => setTimeout(r, 600));
    }
    setIsBotRunning(false); setBotStep(0);
  };

  const lastMsg = messages[messages.length - 1];

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', fontFamily: 'monospace', overflow: 'hidden' }}>

      {/* ── SCENE (60%) ── */}
      <div style={{ width: '60%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(180deg, #FF8C42 0%, #FF5733 45%, #2d0845 100%)' }}>

        {/* Neon shop sign */}
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', color: '#00eeff', fontWeight: 900, fontSize: 22, letterSpacing: 3,
          textShadow: '0 0 10px #00eeff, 0 0 30px #00eeff, 0 0 60px #00eeff',
          whiteSpace: 'nowrap' }}>
          🎮 GINO&apos;S GAME SHOP 🎮
        </div>

        {/* Sunset sun */}
        <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          width: 80, height: 80, borderRadius: '50%',
          background: 'radial-gradient(circle, #FFE566 0%, #FF8C00 60%, transparent 100%)',
          boxShadow: '0 0 40px #FF8C00, 0 0 80px #FF5733' }} />

        {/* Left palm tree */}
        <svg style={{ position: 'absolute', bottom: 0, left: 20, width: 90, height: 220 }} viewBox="0 0 90 220">
          {/* trunk */}
          <rect x="38" y="80" width="14" height="140" rx="4" fill="#1a0a2e"/>
          {/* leaves */}
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(-25 45 70)"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(15 45 70)"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(55 45 70)"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(-60 45 70)"/>
        </svg>

        {/* Right palm tree */}
        <svg style={{ position: 'absolute', bottom: 0, right: 20, width: 90, height: 180 }} viewBox="0 0 90 220">
          <rect x="38" y="80" width="14" height="140" rx="4" fill="#1a0a2e"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(-25 45 70)"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(15 45 70)"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(55 45 70)"/>
          <ellipse cx="45" cy="70" rx="38" ry="14" fill="#0d1a0a" transform="rotate(-60 45 70)"/>
        </svg>

        {/* Shop backdrop / wall */}
        <div style={{ position: 'absolute', bottom: 0, left: '15%', right: '15%', height: '55%',
          background: '#180530', borderRadius: '12px 12px 0 0',
          border: '2px solid #3d1060', borderBottom: 'none' }}>

          {/* Shelves with game boxes */}
          <div style={{ position: 'absolute', top: 20, left: 20, right: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
            {[
              { bg: '#FF5E62', label: 'PIZZA\nGELATO' },
              { bg: '#00C9FF', label: 'SPACE\nRAIDER' },
              { bg: '#834d9b', label: 'DUNGEON\nQUEST' },
              { bg: '#f5a623', label: 'TURBO\nKART' },
            ].map((box, i) => (
              <div key={i} style={{ width: 52, height: 68, borderRadius: 4, background: box.bg,
                border: '2px solid rgba(255,255,255,0.3)',
                boxShadow: `0 0 8px ${box.bg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', fontSize: 8, color: '#fff', fontWeight: 700,
                padding: 4, lineHeight: 1.2, whiteSpace: 'pre-wrap' }}>
                {box.label}
              </div>
            ))}
          </div>

          {/* Shelf plank */}
          <div style={{ position: 'absolute', top: 92, left: 10, right: 10, height: 6,
            background: '#8B5A2B', borderRadius: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}/>

          {/* Counter / wooden bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 56,
            background: 'linear-gradient(180deg, #A0652A 0%, #7A4A1E 100%)',
            borderRadius: '0 0 10px 10px',
            borderTop: '3px solid #C48A3A',
            boxShadow: 'inset 0 2px 6px rgba(255,200,100,0.15)' }} />

          {/* ── GINO ── */}
          <div style={{ position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)' }}>

            {/* BODY (behind counter) */}
            <div style={{ position: 'relative', width: 70 }}>

              {/* Shirt (red, just the top visible) */}
              <div style={{ width: 70, height: 50, background: '#CC2200',
                borderRadius: '8px 8px 0 0', position: 'relative', margin: '0 auto' }}>
                {/* Apron front */}
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 38, height: 50, background: '#EEE',
                  borderRadius: '0 0 6px 6px' }} />
                {/* Arms */}
                <div style={{ position: 'absolute', top: 8, left: -14, width: 18, height: 36,
                  background: '#CC2200', borderRadius: 6 }} />
                <div style={{ position: 'absolute', top: 8, right: -14, width: 18, height: 36,
                  background: '#CC2200', borderRadius: 6 }} />
                {/* Hands */}
                <div style={{ position: 'absolute', top: 36, left: -20, width: 16, height: 16,
                  background: '#C8956C', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: 36, right: -20, width: 16, height: 16,
                  background: '#C8956C', borderRadius: '50%' }} />
              </div>

              {/* HEAD */}
              <div style={{ width: 68, height: 72, background: '#C8956C',
                borderRadius: '50%', position: 'absolute', top: -72, left: '50%', transform: 'translateX(-50%)',
                border: '2px solid #A0724E' }}>

                {/* Dark hair top */}
                <div style={{ position: 'absolute', top: -2, left: 6, right: 6, height: 22,
                  background: '#3B1F0E', borderRadius: '50% 50% 0 0' }} />
                {/* Sideburns */}
                <div style={{ position: 'absolute', top: 10, left: 0, width: 10, height: 20,
                  background: '#3B1F0E', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', top: 10, right: 0, width: 10, height: 20,
                  background: '#3B1F0E', borderRadius: '50%' }} />

                {/* Left eye */}
                <div style={{ position: 'absolute', top: 26, left: 14, width: 14, height: 14,
                  background: '#111', borderRadius: '50%' }}>
                  <div style={{ position: 'absolute', top: 2, left: 2, width: 5, height: 5,
                    background: '#fff', borderRadius: '50%' }} />
                </div>
                {/* Right eye */}
                <div style={{ position: 'absolute', top: 26, right: 14, width: 14, height: 14,
                  background: '#111', borderRadius: '50%' }}>
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5,
                    background: '#fff', borderRadius: '50%' }} />
                </div>

                {/* Thick eyebrows */}
                <div style={{ position: 'absolute', top: 20, left: 12, width: 16, height: 5,
                  background: '#1a0a00', borderRadius: 3, transform: 'rotate(-5deg)' }} />
                <div style={{ position: 'absolute', top: 20, right: 12, width: 16, height: 5,
                  background: '#1a0a00', borderRadius: 3, transform: 'rotate(5deg)' }} />

                {/* Big mustache */}
                <div style={{ position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)',
                  width: 42, height: 12, background: '#1a0800', borderRadius: '50% 50% 0 0' }}>
                  {/* Mustache curls */}
                  <div style={{ position: 'absolute', top: 4, left: -2, width: 14, height: 8,
                    background: '#1a0800', borderRadius: '50%', transform: 'rotate(-20deg)' }} />
                  <div style={{ position: 'absolute', top: 4, right: -2, width: 14, height: 8,
                    background: '#1a0800', borderRadius: '50%', transform: 'rotate(20deg)' }} />
                </div>

                {/* Smile */}
                <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)',
                  width: 22, height: 10, borderBottom: '3px solid #8B4513', borderRadius: '0 0 50% 50%' }} />
              </div>

              {/* Speech bubble */}
              <div style={{
                position: 'absolute', top: -165, left: '50%', transform: 'translateX(-50%)',
                width: 190, minHeight: 50, maxHeight: 80,
                background: '#0f0c29', border: '2px solid #7c3aed',
                borderRadius: 12, padding: '8px 10px',
                boxShadow: '0 0 12px rgba(124,58,237,0.6)',
                overflow: 'hidden'
              }}>
                <div style={{ color: '#e2d9f3', fontSize: 11, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden' }}>
                  {lastMsg?.content}
                </div>
                {/* Bubble tail */}
                <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  width: 0, height: 0,
                  borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
                  borderTop: '10px solid #7c3aed' }} />
              </div>

              {/* Emotion indicator */}
              {lastMsg?.emotion === 'excited' && (
                <div style={{ position: 'absolute', top: -178, right: -8,
                  animation: 'pulse 1s infinite', fontSize: 16 }}>✨</div>
              )}
              {lastMsg?.emotion === 'thinking' && (
                <div style={{ position: 'absolute', top: -178, right: -8, fontSize: 16 }}>💭</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHAT PANEL (40%) ── */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column',
        background: '#0d0520', borderLeft: '2px solid #3d1060' }}>

        {/* Pipeline status bar */}
        {pipeline && (() => {
          const s = (v: string) => v === 'running' ? '🟢' : v === 'loading' ? '🟡' : v === 'ready' ? '🟢' : '⚪';
          const stages = [
            { key: 'gino',    label: 'Gino',    model: 'Sonnet',    val: pipeline.gino },
            { key: 'planner', label: 'Planner', model: 'Qwen3.5',   val: pipeline.planner },
            { key: 'coder',   label: 'Coder',   model: 'Qwen-Code', val: pipeline.coder },
            { key: 'vision',  label: 'Vision',  model: 'VL-7B',     val: pipeline.vision },
          ];
          return (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e0a3a', background: '#0a0118',
              display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {stages.map((st, i) => (
                  <span key={st.key} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span>{s(st.val)}</span>
                    <span style={{ color: st.val !== 'idle' ? '#a78bfa' : '#4b5563', fontWeight: 600 }}>{st.label}</span>
                    <span style={{ color: '#4b5563' }}>({st.model})</span>
                    {i < stages.length - 1 && <span style={{ color: '#4b5563' }}>→</span>}
                  </span>
                ))}
              </div>
              {pipeline.detail && (
                <div style={{ fontSize: 10, color: '#6d28d9', fontStyle: 'italic' }}>
                  {pipeline.loopState !== 'idle' && '⚙ '}{pipeline.detail || pipeline.loopState}
                  {pipeline.loopState !== 'idle' && (
                    <a href="/loop" style={{ marginLeft: 8, color: '#00eeff', textDecoration: 'underline' }}>→ Watch live</a>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #3d1060',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#00eeff', fontWeight: 700, fontSize: 14, letterSpacing: 2 }}>
            GINO&apos;S SHOP // CHAT
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setTtsEnabled(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
              title={ttsEnabled ? 'Voice ON (click to mute)' : 'Voice OFF (VibeVoice server needed)'}>
              {ttsEnabled ? '🔊' : '🔇'}
            </button>
            <button onClick={runBotTest}
              style={{ background: isBotRunning ? '#dc2626' : '#7c3aed', border: 'none',
                color: '#fff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11,
                animation: isBotRunning ? 'pulse 1s infinite' : 'none' }}>
              {isBotRunning ? `⏹ STOP (${botStep}/${BOT_SCRIPT.length})` : '🤖 BOT TEST'}
            </button>
            <button onClick={resetChat}
              style={{ background: '#3d1060', border: '1px solid #7c3aed', color: '#c084fc',
                borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}>
              Reset
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => (
            msg.role === 'system' ? (
              <div key={i} style={{ textAlign: 'center', color: '#4ade80', fontSize: 12,
                padding: '6px 10px', border: '1px solid #4ade80', borderRadius: 8,
                background: 'rgba(74,222,128,0.08)', animation: 'pulse 2s infinite' }}>
                {msg.content}
              </div>
            ) : (
            <div key={i} style={{ display: 'flex', justifyContent: (msg.role === 'user' || msg.role === 'bot') ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                background: msg.role === 'user' ? 'rgba(0,238,255,0.12)' : msg.role === 'bot' ? 'rgba(168,85,247,0.15)' : 'rgba(124,58,237,0.15)',
                border: `1px solid ${msg.role === 'user' ? '#00eeff55' : msg.role === 'bot' ? '#a855f788' : '#7c3aed88'}`,
                color: msg.role === 'user' ? '#a5f3fc' : msg.role === 'bot' ? '#e9d5ff' : '#ddd6fe'
              }}>
                {msg.role === 'bot' ? '🤖 ' + msg.content : msg.content}
              </div>
            </div>
            )
          ))}
          {isLoading && (
            <div style={{ display: 'flex', gap: 4, paddingLeft: 8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed',
                  animation: `bounce 1s ${i*0.2}s infinite` }} />
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: 12, borderTop: '1px solid #3d1060' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Describe your game idea…"
              disabled={isLoading}
              style={{ flex: 1, background: '#1a0533', color: '#e2d9f3',
                border: '1px solid #5b21b6', borderRadius: 8, padding: '8px 12px',
                fontSize: 13, outline: 'none' }}
            />
            <button type="button" onClick={handleVoiceInput} disabled={isLoading}
              title="Voice input"
              style={{ background: isRecording ? '#ef4444' : '#5b21b6',
                border: 'none', borderRadius: '50%', width: 36, height: 36,
                cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: isRecording ? 'pulse 1s infinite' : 'none' }}>
              {isRecording ? '🔴' : '🎤'}
            </button>
            <button type="submit" disabled={isLoading || !inputValue.trim()}
              style={{ background: isLoading || !inputValue.trim() ? '#2d1b69' : '#00eeff',
                color: isLoading || !inputValue.trim() ? '#666' : '#000',
                border: 'none', borderRadius: 8, padding: '8px 14px',
                fontWeight: 700, cursor: isLoading || !inputValue.trim() ? 'default' : 'pointer',
                fontSize: 12, transition: 'all 0.2s' }}>
              SEND
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:0.6; transform: scale(1); } 50% { opacity:1; transform: scale(1.15); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}
