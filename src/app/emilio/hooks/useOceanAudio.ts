'use client'

import { useState, useRef, useEffect } from 'react'

interface UseOceanAudioReturn {
  enabled: boolean
  toggle: () => void
}

export function useOceanAudio(): UseOceanAudioReturn {
  const [enabled, setEnabled] = useState<boolean>(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const toggle = (): void => {
    if (typeof window === 'undefined') return

    if (!enabled) {
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx

      const gainNode = audioCtx.createGain()
      gainNode.gain.value = 0
      gainNode.connect(audioCtx.destination)
      gainRef.current = gainNode

      const osc1 = audioCtx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.value = 0.8
      osc1.connect(gainNode)
      osc1.start()

      const osc2 = audioCtx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = 1.2
      osc2.connect(gainNode)
      osc2.start()

      intervalRef.current = setInterval(() => {
        if (gainRef.current) {
          gainRef.current.gain.value = 0.04 * Math.abs(Math.sin(Date.now() / 3000))
        }
      }, 100)

      setEnabled(true)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime)
      }

      setTimeout(() => {
        if (audioCtxRef.current?.state === 'running') {
          audioCtxRef.current.suspend()
        }
        setEnabled(false)
      }, 300)
    }
  }

  useEffect(() => {
    return (): void => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      audioCtxRef.current?.close()
    }
  }, [])

  return { enabled, toggle }
}
