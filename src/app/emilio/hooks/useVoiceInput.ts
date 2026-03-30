'use client'

import { useRef, useState, useCallback } from 'react'

// WAV encoder — ported from onde-vibe/App.tsx
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

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
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
            if (data.text?.trim()) onTranscript(data.text.trim())
          }
        } catch (e) {
          console.error('[useVoiceInput] STT failed:', e)
        }
        setIsProcessing(false)
      }
      mr.start(100)
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch (e) {
      console.error('[useVoiceInput] mic access failed:', e)
    }
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  return { isRecording, isProcessing, startRecording, stopRecording, toggleRecording }
}
