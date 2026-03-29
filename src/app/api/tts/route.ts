import { NextRequest } from 'next/server';

export async function POST(request: Request): Promise<Response> {
  try {
    const { text, speaker } = await request.json();
    
    const response = await fetch('http://localhost:5001/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        speaker: speaker || 'it-Spk1_man'
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'TTS unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'TTS unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(): Promise<Response> {
  try {
    const response = await fetch('http://localhost:5001/health');
    
    if (!response.ok) {
      return new Response(JSON.stringify({ status: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

