'use client';

import { useEffect, useState } from 'react';

interface SpeechBubbleProps {
  message: string;
  emotion: string;
  isLoading: boolean;
}

export default function SpeechBubble({ message, emotion, isLoading }: SpeechBubbleProps): React.JSX.Element {
  const [opacity, setOpacity] = useState<0 | 1>(0);

  useEffect(() => {
    setOpacity(0);
    const timer = setTimeout(() => setOpacity(1), 50);
    return () => clearTimeout(timer);
  }, [message]);

  const emotionBadge: Record<string, string> = {
    excited: '✨',
    thinking: '💭',
    proud: '🎯',
    focused: '🔍',
    relaxed: '🌊',
    neutral: ''
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '52%',
        left: '28%',
        transform: 'translateX(-50%)',
        maxWidth: '280px',
        zIndex: 10,
        pointerEvents: 'none',
        opacity,
        transition: 'opacity 300ms ease-out'
      }}
    >
      <div
        style={{
          background: 'rgba(7,7,26,0.82)',
          border: '1px solid rgba(0,212,255,0.35)',
          borderRadius: '14px',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 0 24px rgba(0,212,255,0.12)',
          padding: '12px 16px',
          color: '#e2e8f0',
          fontSize: '13px',
          lineHeight: '1.5',
          fontFamily: 'JetBrains Mono, monospace',
          position: 'relative'
        }}
      >
        {emotionBadge[emotion] && (
          <span style={{ fontSize: 16, position: 'absolute', top: -10, right: -8 }}>
            {emotionBadge[emotion]}
          </span>
        )}

        {isLoading ? (
          <span style={{ display: 'inline-block' }}>
            <style>{`
              @keyframes emilioBounce {
                0%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-6px); }
              }
            `}</style>
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00d4ff',
                margin: '0 2px',
                animation: 'emilioBounce 1s ease-in-out infinite',
                animationDelay: '0s'
              }}
            />
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00d4ff',
                margin: '0 2px',
                animation: 'emilioBounce 1s ease-in-out infinite',
                animationDelay: '0.15s'
              }}
            />
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#00d4ff',
                margin: '0 2px',
                animation: 'emilioBounce 1s ease-in-out infinite',
                animationDelay: '0.3s'
              }}
            />
          </span>
        ) : (
          message
        )}

        <div
          style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(0,212,255,0.35)'
          }}
        />
      </div>
    </div>
  );
}
