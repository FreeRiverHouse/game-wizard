'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Message = { role: 'user' | 'shopkeeper' | 'system'; content: string }

function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const left = audioBuffer.getChannelData(0)
  let channelData = left
  if (audioBuffer.numberOfChannels > 1) {
    const right = audioBuffer.getChannelData(1)
    channelData = new Float32Array(left.length)
    for (let i = 0; i < left.length; i++) channelData[i] = (left[i] + right[i]) / 2
  }
  const length = channelData.length * 2
  const buffer = new ArrayBuffer(44 + length)
  const view = new DataView(buffer)
  const ws = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)) }
  ws(0, 'RIFF'); view.setUint32(4, 36 + length, true)
  ws(8, 'WAVE'); ws(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true); view.setUint16(34, 16, true)
  ws(36, 'data'); view.setUint32(40, length, true)
  let offset = 44
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

export default function BubblePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const lastCountRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const speakEmilio = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'en-US'; utt.rate = 1.0; utt.pitch = 1.0
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Samantha'))
      ?? voices.find(v => v.lang === 'en-US')
    if (preferred) utt.voice = preferred
    window.speechSynthesis.speak(utt)
  }, [])

  // Poll conversation history
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/shop/chat')
        if (!res.ok) return
        const data = await res.json() as Message[]
        if (!Array.isArray(data)) return
        setMessages(data)
        // Speak new Emilio messages
        if (data.length > lastCountRef.current) {
          const newMsgs = data.slice(lastCountRef.current)
          for (const m of newMsgs) {
            if (m.role === 'shopkeeper' && m.content) speakEmilio(m.content)
          }
        }
        lastCountRef.current = data.length
      } catch { /* non-fatal */ }
    }
    poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  }, [speakEmilio])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    setIsLoading(true)
    try {
      await fetch('/api/shop/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), clientAudio: true })
      })
    } catch { /* non-fatal */ }
    setIsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const msg = inputValue.trim()
    if (!msg) return
    setInputValue('')
    await sendMessage(msg)
  }

  const handleReset = async () => {
    await fetch('/api/shop/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__reset__' })
    })
    setMessages([])
    lastCountRef.current = 0
  }

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      mediaRecorderRef.current = null
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)
        setIsProcessing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const arrayBuf = await blob.arrayBuffer()
          const audioCtx = new AudioContext()
          const decoded = await audioCtx.decodeAudioData(arrayBuf)
          audioCtx.close()
          const wav = encodeWAV(decoded)
          const formData = new FormData()
          formData.append('audio', new Blob([wav], { type: 'audio/wav' }), 'recording.wav')
          const res = await fetch('/api/stt', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json() as { text: string }
            if (data.text?.trim()) await sendMessage(data.text.trim())
          }
        } catch (err) { console.error('[bubble] STT error:', err) }
        setIsProcessing(false)
      }
      mr.start(100)
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch (err) { console.error('[bubble] mic error:', err) }
  }, [isRecording])

  const micLabel = isProcessing ? '⏳' : isRecording ? '🔴' : '🎙'

  return (
    <main style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#02020c', fontFamily: 'monospace', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: '#a855f7', fontWeight: 700, letterSpacing: 3, fontSize: 14 }}>BUBBLE</span>
          <span style={{ color: 'rgba(168,85,247,0.5)', fontSize: 11, marginLeft: 8 }}>// MATTIA @ 192.168.1.79</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'rgba(168,85,247,0.5)' }}>EMILIO →</span>
          <span style={{ fontSize: 10, color: '#00d4ff' }}>192.168.1.234:3001</span>
          <button
            onClick={handleReset}
            style={{ background: 'transparent', border: '1px solid rgba(168,85,247,0.3)', color: 'rgba(168,85,247,0.6)', borderRadius: 4, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace' }}
          >RESET</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ color: 'rgba(168,85,247,0.3)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            Waiting for conversation...
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === 'system') return (
            <div key={i} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 10, padding: '2px 0' }}>
              {m.content}
            </div>
          )
          const isEmilio = m.role === 'shopkeeper'
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isEmilio ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '75%',
                background: isEmilio ? 'rgba(0,212,255,0.08)' : 'rgba(168,85,247,0.12)',
                border: `1px solid ${isEmilio ? 'rgba(0,212,255,0.25)' : 'rgba(168,85,247,0.35)'}`,
                borderRadius: isEmilio ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.5,
                color: isEmilio ? '#a8e0f0' : '#d8b4fe',
              }}>
                <div style={{ fontSize: 9, color: isEmilio ? 'rgba(0,212,255,0.5)' : 'rgba(168,85,247,0.5)', marginBottom: 4, letterSpacing: 2 }}>
                  {isEmilio ? 'EMILIO' : 'MATTIA'}
                </div>
                {m.content}
              </div>
            </div>
          )
        })}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '4px 16px 16px 16px', padding: '10px 14px', fontSize: 13, color: 'rgba(0,212,255,0.5)' }}>
              ···
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ padding: '12px 20px', borderTop: '1px solid rgba(168,85,247,0.2)', display: 'flex', gap: 8 }}>
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Talk to Emilio as Mattia..."
          disabled={isLoading}
          style={{
            flex: 1, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: 8, padding: '10px 14px', color: '#d8b4fe', fontFamily: 'monospace',
            fontSize: 13, outline: 'none'
          }}
        />
        <button
          type="button"
          onClick={toggleRecording}
          disabled={isProcessing}
          style={{
            background: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.1)',
            border: `1px solid ${isRecording ? '#ef4444' : 'rgba(168,85,247,0.4)'}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 18, cursor: 'pointer'
          }}
        >{micLabel}</button>
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          style={{
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 8, padding: '10px 20px', color: '#a855f7', fontFamily: 'monospace',
            fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1
          }}
        >SEND</button>
      </form>
    </main>
  )
}
